/* UniEDD Karaoke Maker — AI vocal separation worker.
 *
 * Runs entirely on the user's device. The song never leaves the browser:
 * this worker only downloads the (open, MIT-licensed) HT-Demucs vocals model
 * once, keeps it in the browser cache, and processes the audio locally in
 * 7.8 s chunks with overlap-add.
 *
 * Messages in:  { type: "separate", left, right, preferGpu }
 * Messages out: { type: "status", stage, ... } | { type: "done", vocalsL, vocalsR, backend, seconds }
 *               | { type: "error", message, code }
 */
const ORT_BASE = new URL("./ort/", self.location.href).href;
const MODEL_REV = "2ef0d757d3e226d0da85fb8c71514f464fcabdd0";
const MODEL_URL =
  "https://huggingface.co/StemSplitio/htdemucs-ft-vocals-onnx/resolve/" + MODEL_REV + "/htdemucs_ft_vocals_fp16weights.onnx";
const MODEL_BYTES = 165612636;
const CACHE_NAME = "uniedd-karaoke-model-v1";
const SEG = 343980; // 7.8 s at 44.1 kHz — fixed by the model graph
const OVERLAP = Math.floor(SEG / 4);
const STRIDE = SEG - OVERLAP;
const VOCALS_ROW = 3; // [drums, bass, other, vocals]

let ort = null;
let session = null;
let backend = null;

function post(msg, transfer) {
  self.postMessage(msg, transfer || []);
}

async function gpuAvailable() {
  try {
    if (!self.navigator || !self.navigator.gpu) return false;
    const adapter = await self.navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

async function loadOrt(useGpu) {
  const file = useGpu ? "ort.webgpu.min.mjs" : "ort.wasm.min.mjs";
  const mod = await import(ORT_BASE + file);
  mod.env.wasm.wasmPaths = ORT_BASE;
  const threads = self.crossOriginIsolated ? Math.max(1, Math.min(8, (self.navigator.hardwareConcurrency || 4) - 1)) : 1;
  mod.env.wasm.numThreads = threads;
  return { mod, threads };
}

async function fetchModel() {
  let cache = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(MODEL_URL);
    if (hit) {
      post({ type: "status", stage: "download", loaded: MODEL_BYTES, total: MODEL_BYTES, cached: true });
      return new Uint8Array(await hit.arrayBuffer());
    }
  } catch {
    cache = null; // Cache Storage can be unavailable (private mode); just download.
  }
  const res = await fetch(MODEL_URL, { mode: "cors" });
  if (!res.ok || !res.body) throw Object.assign(new Error("Model download failed (" + res.status + ")"), { code: "download" });
  const total = Number(res.headers.get("content-length")) || MODEL_BYTES;
  const buf = new Uint8Array(total);
  const reader = res.body.getReader();
  let loaded = 0;
  let last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (loaded + value.length > buf.length) throw Object.assign(new Error("Unexpected model size"), { code: "download" });
    buf.set(value, loaded);
    loaded += value.length;
    const now = Date.now();
    if (now - last > 150) {
      last = now;
      post({ type: "status", stage: "download", loaded, total, cached: false });
    }
  }
  post({ type: "status", stage: "download", loaded, total, cached: false });
  const bytes = loaded === buf.length ? buf : buf.slice(0, loaded);
  if (cache) {
    try {
      await cache.put(MODEL_URL, new Response(bytes, { headers: { "content-type": "application/octet-stream" } }));
    } catch {
      /* quota exceeded — fine, it just downloads again next time */
    }
  }
  return bytes;
}

async function createSession(bytes, useGpu) {
  const { mod, threads } = await loadOrt(useGpu);
  ort = mod;
  // Graph optimisation is off on purpose: folding the fp16 weights to fp32
  // during optimisation runs out of WASM memory (std::bad_alloc).
  const opts = { graphOptimizationLevel: "disabled", enableMemPattern: false, enableCpuMemArena: false };
  if (useGpu) {
    opts.executionProviders = ["webgpu"];
  } else {
    opts.executionProviders = ["wasm"];
  }
  session = await ort.InferenceSession.create(bytes, opts);
  backend = useGpu ? "webgpu" : "wasm-" + threads + (threads === 1 ? "-thread" : "-threads");
}

function transitionWindow() {
  const w = new Float32Array(SEG).fill(1);
  for (let i = 0; i < OVERLAP; i++) {
    const v = i / (OVERLAP - 1);
    w[i] = v;
    w[SEG - 1 - i] = v;
  }
  return w;
}

async function runChunk(input) {
  const tensor = new ort.Tensor("float32", input, [1, 2, SEG]);
  const out = await session.run({ mix: tensor });
  const stems = out.stems;
  const data = stems.data;
  const base = VOCALS_ROW * 2 * SEG;
  const voc = data.slice(base, base + 2 * SEG);
  if (typeof stems.dispose === "function") stems.dispose();
  return voc;
}

function finite(arr) {
  for (let i = 0; i < arr.length; i += 997) if (!Number.isFinite(arr[i])) return false;
  return true;
}

function energy(a, from, to) {
  let e = 0;
  for (let i = from; i < to; i += 7) e += a[i] * a[i];
  return e;
}

/** A vocals estimate can't be much louder than the mix it came from. */
function plausible(voc, input) {
  const ev = energy(voc, 0, voc.length);
  const em = energy(input, 0, input.length);
  return ev <= em * 4 + 1e-6;
}

async function separate(left, right, preferGpu) {
  const t0 = performance.now();
  post({ type: "status", stage: "download", loaded: 0, total: MODEL_BYTES, cached: false });
  const bytes = await fetchModel();
  post({ type: "status", stage: "init" });
  let useGpu = preferGpu && (await gpuAvailable());
  try {
    await createSession(bytes, useGpu);
  } catch (err) {
    if (!useGpu) throw err;
    useGpu = false;
    await createSession(bytes, false);
  }
  const N = left.length;
  const nChunks = Math.max(1, Math.ceil(N / STRIDE));
  const win = transitionWindow();
  const outL = new Float32Array(N);
  const outR = new Float32Array(N);
  const weight = new Float32Array(N);
  const input = new Float32Array(2 * SEG);
  const tStart = performance.now();
  post({ type: "status", stage: "separate", done: 0, total: nChunks, backend });
  for (let c = 0; c < nChunks; c++) {
    const start = c * STRIDE;
    const end = Math.min(start + SEG, N);
    const len = end - start;
    input.fill(0);
    input.set(left.subarray(start, end), 0);
    input.set(right.subarray(start, end), SEG);
    let voc = null;
    try {
      voc = await runChunk(input);
    } catch (err) {
      if (backend !== "webgpu") throw err;
    }
    if (backend === "webgpu" && (!voc || !finite(voc) || !plausible(voc, input))) {
      // Some GPUs/drivers fail or produce NaNs — switch to the CPU path.
      try {
        await session.release();
      } catch {
        /* ignore */
      }
      await createSession(bytes, false);
      post({ type: "status", stage: "separate", done: c, total: nChunks, backend });
      voc = await runChunk(input);
    }
    for (let i = 0; i < len; i++) {
      const w = win[i];
      outL[start + i] += voc[i] * w;
      outR[start + i] += voc[SEG + i] * w;
      weight[start + i] += w;
    }
    const elapsed = (performance.now() - tStart) / 1000;
    post({ type: "status", stage: "separate", done: c + 1, total: nChunks, backend, eta: (elapsed / (c + 1)) * (nChunks - c - 1) });
  }
  for (let i = 0; i < N; i++) {
    const w = weight[i] > 1e-8 ? weight[i] : 1e-8;
    outL[i] /= w;
    outR[i] /= w;
  }
  try {
    await session.release();
  } catch {
    /* ignore */
  }
  session = null;
  post(
    { type: "done", vocalsL: outL, vocalsR: outR, backend, seconds: (performance.now() - t0) / 1000, separateSeconds: (performance.now() - tStart) / 1000 },
    [outL.buffer, outR.buffer],
  );
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type !== "separate") return;
  separate(m.left, m.right, m.preferGpu !== false).catch((err) => {
    const msg = String((err && err.message) || err);
    const oom = /memory|alloc|RangeError|Out of bounds/i.test(msg);
    post({ type: "error", message: msg, code: (err && err.code) || (oom ? "memory" : "model") });
  });
};
