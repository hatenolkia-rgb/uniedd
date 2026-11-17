// Karaoke Maker — browser audio engine: decode, separate (worker), live
// preview with pitch shift, offline render and file export.
// Everything happens on the user's device; nothing is uploaded.

import type { StretchNode } from "signalsmith-stretch";
import { SAMPLE_RATE, floatToInt16, mixKaraoke, preventClipping, type Stereo } from "./dsp";

export const MODEL_DOWNLOAD_BYTES = 165612636;

export class KaraokeError extends Error {
  constructor(message: string, readonly code: "decode" | "download" | "memory" | "model" | "cancelled" | "unsupported" | "render") {
    super(message);
  }
}

export function audioSupported(): boolean {
  return typeof window !== "undefined" && typeof window.OfflineAudioContext === "function" && typeof window.AudioWorkletNode === "function";
}

/** Decode any browser-supported audio file to 44.1 kHz stereo. */
export async function decodeFile(file: File): Promise<Stereo & { duration: number }> {
  let data: ArrayBuffer;
  try {
    data = await file.arrayBuffer();
  } catch {
    throw new KaraokeError("We couldn't open this file.", "decode");
  }
  let buf: AudioBuffer;
  try {
    const ctx = new OfflineAudioContext(2, 1, SAMPLE_RATE);
    buf = await ctx.decodeAudioData(data);
  } catch (e) {
    if (e instanceof RangeError) throw new KaraokeError("This song is too big for your device's memory.", "memory");
    throw new KaraokeError("We couldn't read this file. Try an MP3, WAV, M4A, AAC, OGG or FLAC song.", "decode");
  }
  if (!buf.length) throw new KaraokeError("This file has no sound in it.", "decode");
  const left = buf.getChannelData(0).slice();
  const right = buf.numberOfChannels > 1 ? buf.getChannelData(1).slice() : left.slice();
  return { left, right, duration: buf.duration };
}

// ---------------------------------------------------------------------------
// AI separation in a Web Worker.

export type SeparationStatus =
  | { stage: "download"; loaded: number; total: number; cached: boolean }
  | { stage: "init" }
  | { stage: "separate"; done: number; total: number; backend: string; eta?: number };

export type SeparationResult = Stereo & { backend: string; seconds: number };

export function separateVocals(
  song: Stereo,
  opts: { preferGpu: boolean; onStatus: (s: SeparationStatus) => void },
): { promise: Promise<SeparationResult>; cancel: () => void } {
  let worker: Worker | null = null;
  let rejectFn: ((e: unknown) => void) | null = null;
  const promise = new Promise<SeparationResult>((resolve, reject) => {
    rejectFn = reject;
    try {
      worker = new Worker("/karaoke/separator-worker.js", { type: "module" });
    } catch {
      reject(new KaraokeError("Your browser can't run the AI helper. Try Quick mode.", "unsupported"));
      return;
    }
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "status") opts.onStatus(m as SeparationStatus);
      else if (m.type === "done") {
        resolve({ left: m.vocalsL, right: m.vocalsR, backend: m.backend, seconds: m.seconds });
        worker?.terminate();
      } else if (m.type === "error") {
        const code = m.code === "download" ? "download" : m.code === "memory" ? "memory" : "model";
        const msg =
          code === "download"
            ? "We couldn't download the AI helper. Check your internet connection, or use Quick mode."
            : code === "memory"
              ? "Your device ran out of memory. Try Quick mode or a shorter song."
              : "The AI helper stopped working on this device. Try Quick mode.";
        reject(new KaraokeError(msg, code));
        worker?.terminate();
      }
    };
    worker.onerror = () => {
      reject(new KaraokeError("The AI helper couldn't start in this browser. Try Quick mode.", "unsupported"));
      worker?.terminate();
    };
    // Copies — the worker owns (and frees) them.
    const left = song.left.slice();
    const right = song.right.slice();
    worker.postMessage({ type: "separate", left, right, preferGpu: opts.preferGpu }, [left.buffer, right.buffer]);
  });
  return {
    promise,
    cancel: () => {
      worker?.terminate();
      rejectFn?.(new KaraokeError("Cancelled", "cancelled"));
    },
  };
}

// ---------------------------------------------------------------------------
// Offline render: mix + time-preserving pitch shift (Signalsmith Stretch).

type StretchFactory = typeof import("signalsmith-stretch").default;

/** Loaded at runtime from /karaoke/ort (copied unmodified from node_modules by scripts/copy-ort.mjs). */
async function loadStretch(): Promise<StretchFactory> {
  const url = "/karaoke/ort/SignalsmithStretch.mjs";
  const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);
  return mod.default as StretchFactory;
}

export async function renderMix(
  orig: Stereo,
  vocals: Stereo | null,
  vocalLevel: number,
  semitones: number,
  onProgress?: (fraction: number) => void,
  signal?: { cancelled: boolean },
): Promise<Stereo> {
  const mixed = vocals ? mixKaraoke(orig, vocals, vocalLevel) : { left: orig.left.slice(), right: orig.right.slice() };
  if (!semitones) {
    preventClipping(mixed);
    onProgress?.(1);
    return mixed;
  }
  const n = mixed.left.length;
  const ctx = new OfflineAudioContext(2, n, SAMPLE_RATE);
  const SignalsmithStretch = await loadStretch();
  const node: StretchNode = await SignalsmithStretch(ctx);
  await node.addBuffers([mixed.left, mixed.right]);
  await node.schedule({ active: true, input: 0, rate: 1, semitones, output: 0 });
  node.connect(ctx.destination);
  const dur = n / SAMPLE_RATE;
  const step = Math.max(5, Math.ceil(dur / 40));
  const out = await new Promise<AudioBuffer>((resolve, reject) => {
    for (let t = step; t < dur; t += step) {
      const at = t;
      ctx.suspend(at).then(() => {
        onProgress?.(at / dur);
        if (signal?.cancelled) {
          reject(new KaraokeError("Cancelled", "cancelled")); // leave it suspended; the context is dropped
          return;
        }
        void ctx.resume();
      });
    }
    ctx.startRendering().then(resolve, () =>
      reject(new KaraokeError("Making the file failed — your device may be low on memory.", "render")),
    );
  });
  if (signal?.cancelled) throw new KaraokeError("Cancelled", "cancelled");
  const res = { left: out.getChannelData(0).slice(), right: out.getChannelData(1).slice() };
  preventClipping(res);
  onProgress?.(1);
  return res;
}

export async function encodeMp3(s: Stereo, kbps = 192, onProgress?: (f: number) => void, signal?: { cancelled: boolean }): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const enc = new Mp3Encoder(2, SAMPLE_RATE, kbps);
  const block = 1152 * 20;
  const parts: BlobPart[] = [];
  const n = s.left.length;
  let lastYield = performance.now();
  for (let i = 0; i < n; i += block) {
    const end = Math.min(n, i + block);
    const chunk = enc.encodeBuffer(floatToInt16(s.left, i, end), floatToInt16(s.right, i, end));
    if (chunk.length) parts.push(new Uint8Array(chunk));
    if (performance.now() - lastYield > 40) {
      onProgress?.(end / n);
      await new Promise((r) => setTimeout(r, 0));
      if (signal?.cancelled) throw new KaraokeError("Cancelled", "cancelled");
      lastYield = performance.now();
    }
  }
  const tail = enc.flush();
  if (tail.length) parts.push(new Uint8Array(tail));
  onProgress?.(1);
  return new Blob(parts, { type: "audio/mpeg" });
}

// ---------------------------------------------------------------------------
// Live preview player.

export class KaraokePlayer {
  private ctx: AudioContext | null = null;
  private stretch: StretchNode | null = null;
  private stretchReady: Promise<void> | null = null;
  private sum: GainNode | null = null;
  private master: GainNode | null = null;
  private gOrig: GainNode | null = null;
  private gVoc: GainNode | null = null;
  private srcs: AudioBufferSourceNode[] = [];
  private origBuf: AudioBuffer | null = null;
  private vocBuf: AudioBuffer | null = null;
  private startedAt = 0;
  private offset = 0;
  private semis = 0;
  private vocalLevel = 0;
  private original = false;
  playing = false;
  duration = 0;
  onEnded: (() => void) | null = null;

  /** Creates the audio graph. Only `play()` resumes the context (it needs a tap/click). */
  async ensure(resume = false): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx({ sampleRate: SAMPLE_RATE, latencyHint: "playback" });
      this.ctx = ctx;
      this.sum = ctx.createGain();
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.gOrig = ctx.createGain();
      this.gVoc = ctx.createGain();
      this.gOrig.connect(this.sum);
      this.gVoc.connect(this.sum);
      // The pitch-shift worklet only finishes starting once the context runs,
      // so don't wait for it here — it is plugged in as soon as it is ready.
      this.stretchReady = loadStretch()
        .then((SignalsmithStretch) => SignalsmithStretch(ctx))
        .then(async (node) => {
          if (this.ctx !== ctx) return;
          this.stretch = node;
          node.connect(this.master!);
          await node.schedule({ active: true, semitones: this.semis });
          this.route();
        })
        .catch(() => {
          this.stretch = null; // preview without pitch shift; the download still works
        });
      this.route();
      this.applyGains();
    }
    if (resume && this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  get pitchPreviewAvailable() {
    return !!this.stretch || !this.ctx;
  }

  private toBuffer(s: Stereo): AudioBuffer {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(2, s.left.length, SAMPLE_RATE);
    b.copyToChannel(s.left as Float32Array<ArrayBuffer>, 0);
    b.copyToChannel(s.right as Float32Array<ArrayBuffer>, 1);
    return b;
  }

  async load(orig: Stereo) {
    await this.ensure();
    this.stop();
    this.origBuf = this.toBuffer(orig);
    this.vocBuf = null;
    this.duration = this.origBuf.duration;
    this.offset = 0;
  }

  async setVocals(vocals: Stereo | null) {
    await this.ensure();
    const wasPlaying = this.playing;
    const t = this.currentTime();
    this.stop();
    this.vocBuf = vocals ? this.toBuffer(vocals) : null;
    this.offset = t;
    this.applyGains();
    if (wasPlaying) this.play();
  }

  private route() {
    if (!this.sum || !this.master) return;
    this.sum.disconnect();
    if (this.semis !== 0 && this.stretch) this.sum.connect(this.stretch);
    else this.sum.connect(this.master);
  }

  private applyGains() {
    if (!this.gOrig || !this.gVoc || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.gOrig.gain.setTargetAtTime(1, now, 0.01);
    const k = this.original || !this.vocBuf ? 0 : -(1 - this.vocalLevel);
    this.gVoc.gain.setTargetAtTime(k, now, 0.02);
  }

  setSemitones(n: number) {
    this.semis = n;
    if (this.stretch) void this.stretch.schedule({ active: true, semitones: n });
    this.route();
  }

  setVocalLevel(v: number) {
    this.vocalLevel = v;
    this.applyGains();
  }

  setOriginal(on: boolean) {
    this.original = on;
    this.applyGains();
  }

  currentTime(): number {
    if (!this.ctx || !this.playing) return this.offset;
    return Math.min(this.duration, this.offset + (this.ctx.currentTime - this.startedAt));
  }

  async play(from?: number) {
    await this.ensure(true);
    if (this.semis !== 0 && !this.stretch && this.stretchReady) {
      await Promise.race([this.stretchReady, new Promise((r) => setTimeout(r, 3000))]);
    }
    if (!this.origBuf || !this.ctx) return;
    this.stopSources();
    if (from !== undefined) this.offset = from;
    if (this.offset >= this.duration - 0.05) this.offset = 0;
    const ctx = this.ctx;
    const when = ctx.currentTime + 0.03;
    const mk = (buf: AudioBuffer, dest: AudioNode) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.connect(dest);
      s.start(when, this.offset);
      return s;
    };
    const main = mk(this.origBuf, this.gOrig!);
    this.srcs = [main];
    if (this.vocBuf) this.srcs.push(mk(this.vocBuf, this.gVoc!));
    main.onended = () => {
      if (this.srcs[0] !== main) return;
      this.playing = false;
      this.offset = 0;
      this.onEnded?.();
    };
    this.startedAt = when;
    this.playing = true;
  }

  pause() {
    this.offset = this.currentTime();
    this.stopSources();
    this.playing = false;
  }

  async seek(t: number) {
    const was = this.playing;
    this.offset = Math.max(0, Math.min(this.duration, t));
    if (was) await this.play();
  }

  private stopSources() {
    for (const s of this.srcs) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
    this.srcs = [];
  }

  stop() {
    this.stopSources();
    this.playing = false;
    this.offset = 0;
  }

  async close() {
    this.stop();
    const ctx = this.ctx;
    this.ctx = null;
    this.stretch = null;
    if (ctx) await ctx.close().catch(() => {});
  }
}
