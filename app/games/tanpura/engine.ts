// Tanpura + Tabla audio engine (Web Audio). Runs entirely in the browser.
// The tanpura is synthesised (synth.ts) so every key/tuning is exact; the
// tabla is built from recorded single strokes (any taal, any tempo) or plays
// a real recorded groove at its own tempo.

import { mulberry32, renderPluck, renderSwarmandal } from "./synth";
import {
  REC_TUNINGS,
  SWARMANDAL_SCALES,
  defaultStrings,
  recordedSaHz,
  pluckOffsets,
  saHz,
  stringHz,
  swarRatio,
  tablaRate,
  type StringSpec,
  type SwarId,
  type Temperament,
  type Voice,
} from "./theory";
import { TAALS, cycleEvents, pickLayer, type StrokeId, type Taal, type TablaEvent } from "./taals";

export const ASSET_BASE = "/tanpura-tabla";

export type TanpuraSettings = {
  /** Real recorded tanpura (default) or the synthesised one. */
  source: "recorded" | "synth";
  key: number;
  voice: Voice;
  octaveShift: -1 | 0 | 1;
  cents: number;
  a4: number;
  temperament: Temperament;
  first: SwarId;
  count: 4 | 5 | 6;
  strings: StringSpec[];
  /** Seconds for one round of all strings. */
  cycle: number;
  jawari: number;
  reverb: number;
  volume: number;
  shimmer: boolean;
  shimmerScale: string;
  shimmerVolume: number;
};

export type TablaSettings = {
  mode: "strokes" | "recording";
  taal: string;
  bpm: number;
  volume: number;
  bayan: number;
  tune: "S" | "P" | "off";
  tuneCents: number;
  humanize: number;
  loop: string;
};

export type KitSlot = { start: number; dur: number; onset: number; vel: number; rr: number; peak: number };
export type KitJson = { sampleRate: number; duration: number; dayanSaHz: number; slots: Record<StrokeId, KitSlot[]> };
export type LoopInfo = { id: string; bpm: number; beats: number; duration: number; onset: number };

const DAYAN: StrokeId[] = ["na", "tin", "tun", "ti"];
const DAMPS: Partial<Record<StrokeId, "dayan" | "bayan">> = { ti: "dayan", ke: "bayan", gem: "bayan" };

export const REC_BASE = "/tanpura-rec";

export type RecFile = { id: string; saHz: number; loop: number; duration: number; rho: number; onsets: number[]; shift: number };
export type RecManifest = { crossfade: number; sampleRate: number; files: Record<string, Record<string, RecFile>> };

/** True when the recorded tanpura plays for these settings (Pa, Ma and Ni tunings have recordings). */
export function usesRecording(s: Pick<TanpuraSettings, "source" | "first">) {
  return s.source === "recorded" && REC_TUNINGS.includes(s.first);
}

export function tanpuraFrequencies(s: TanpuraSettings) {
  if (usesRecording(s)) {
    const sa = recordedSaHz(s.key, { a4: s.a4, cents: s.cents });
    return { sa, strings: defaultStrings(4, s.first).map((st) => stringHz(sa, st, "just")) };
  }
  const sa = saHz(s.key, s.voice, { a4: s.a4, cents: s.cents, octaveShift: s.octaveShift });
  return { sa, strings: s.strings.map((st) => stringHz(sa, st, s.temperament)) };
}

const KEY_FILE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Correlation-aware equal-power crossfade curves (keeps loudness steady across the loop seam). */
export function crossfadeCurves(rho: number, n = 128) {
  const fin = new Float32Array(n);
  const fout = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = Math.sin((t * Math.PI) / 2);
    const b = Math.cos((t * Math.PI) / 2);
    const g = Math.sqrt(1 + 2 * rho * a * b);
    fin[i] = a / g;
    fout[i] = b / g;
  }
  return { fin, fout };
}

/** Pick the compressed format this browser decodes (Opus, else AAC). */
export function audioExt(): "ogg" | "m4a" {
  if (typeof document === "undefined") return "ogg";
  const a = document.createElement("audio");
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const safari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Android/.test(ua);
  if (!safari && a.canPlayType('audio/ogg; codecs="opus"')) return "ogg";
  return "m4a";
}

function makeImpulse(ctx: BaseAudioContext, seconds = 2.6) {
  const len = Math.round(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const rnd = mulberry32(42);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      const n = rnd() * 2 - 1;
      lp += (n - lp) * (0.25 + 0.5 * Math.exp(-t * 1.5));
      d[i] = lp * Math.exp(-t * 2.4) * (t < 0.01 ? t / 0.01 : 1);
    }
  }
  return buf;
}

function median(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

/** Codec delay: find where the first strong onset really is in a decoded buffer. */
function detectOnset(buf: AudioBuffer, expect: number, window = 0.09, rel = 0.25) {
  const d = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const a = Math.max(0, Math.floor((expect - 0.01) * sr));
  const b = Math.min(d.length, Math.ceil((expect + window) * sr));
  let pk = 0;
  for (let i = a; i < b; i++) pk = Math.max(pk, Math.abs(d[i]));
  if (pk < 1e-4) return expect;
  for (let i = a; i < b; i++) if (Math.abs(d[i]) >= pk * rel) return i / sr;
  return expect;
}

type Visual =
  | { kind: "pluck"; time: number; string: number }
  | { kind: "matra"; time: number; matra: number; sub: number; bol: string; avartan: number; dayan: boolean; bayan: boolean };

export type EngineListener = {
  onPluck?: (string: number) => void;
  onMatra?: (e: { matra: number; sub: number; bol: string; avartan: number; dayan: boolean; bayan: boolean }) => void;
  onKit?: (state: "loading" | "ready" | "error", message?: string) => void;
};

export class TanpuraTablaEngine {
  ctx: BaseAudioContext | null = null;
  private offline: boolean;
  private master!: GainNode;
  private tanBus!: GainNode;
  private recBus!: GainNode;
  private tabBus!: GainNode;
  private dayanBus!: GainNode;
  private bayanBus!: GainNode;
  private wet!: GainNode;
  private tabWet!: GainNode;
  private conv!: ConvolverNode;

  tanpura: TanpuraSettings;
  tabla: TablaSettings;
  listener: EngineListener = {};

  tanpuraOn = false;
  tablaOn = false;

  private pluckCache = new Map<string, AudioBuffer>();
  private recManifest: Promise<RecManifest> | null = null;
  private recBuffers = new Map<string, Promise<AudioBuffer>>();
  private rec: {
    info: RecFile;
    buf: AudioBuffer;
    rate: number;
    xf: number;
    next: number;
    first: boolean;
    voices: { src: AudioBufferSourceNode; g: GainNode; end: number }[];
  } | null = null;
  private recSig = "";
  private recRestart: ReturnType<typeof setTimeout> | null = null;
  /** Message for the UI when the recording couldn't load and the synth took over. */
  recError: string | null = null;
  private lastPluck: ({ src: AudioBufferSourceNode; g: GainNode } | null)[] = [];
  private nextCycle = 0;
  private cycleCount = 0;
  private rnd = mulberry32(1234);

  private kit: { json: KitJson; buf: AudioBuffer; lead: number; layers: Record<string, KitSlot[][]>; rr: Record<string, number> } | null = null;
  private kitPromise: Promise<void> | null = null;
  private ringing: Record<"dayan" | "bayan", { src: AudioBufferSourceNode; g: GainNode; t: number }[]> = { dayan: [], bayan: [] };
  private tabTaal: Taal = TAALS[0];
  private tabEvents: TablaEvent[] = [];
  private tabIdx = 0;
  private tabNext = 0;
  private tabAvartan = 0;
  private loopBuffers = new Map<string, Promise<{ buf: AudioBuffer; lead: number }>>();
  private loopSrc: AudioBufferSourceNode | null = null;
  private loopStart = 0;
  private loopInfo: LoopInfo | null = null;
  private loopLastBeat = -1;

  private visuals: Visual[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private raf = 0;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(tanpura: TanpuraSettings, tabla: TablaSettings, ctx?: BaseAudioContext) {
    this.tanpura = tanpura;
    this.tabla = tabla;
    this.offline = !!ctx && typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext;
    if (ctx) this.build(ctx);
  }

  private build(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.conv = ctx.createConvolver();
    this.conv.buffer = makeImpulse(ctx);
    this.wet = ctx.createGain();
    this.tabWet = ctx.createGain();
    this.conv.connect(this.master);
    this.tanBus = ctx.createGain();
    this.tanBus.connect(this.master);
    this.tanBus.connect(this.wet);
    this.recBus = ctx.createGain();
    this.recBus.gain.value = 2.9; // recordings sit at −21 dBFS RMS; match the synth's loudness
    this.recBus.connect(this.tanBus);
    this.wet.connect(this.conv);
    this.tabBus = ctx.createGain();
    this.tabBus.connect(this.master);
    this.tabBus.connect(this.tabWet);
    this.tabWet.connect(this.conv);
    this.dayanBus = ctx.createGain();
    this.bayanBus = ctx.createGain();
    this.dayanBus.connect(this.tabBus);
    this.bayanBus.connect(this.tabBus);
    this.applyMix();
  }

  /** Create/resume the real-time AudioContext (must be called from a tap). */
  async ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.build(new AC({ latencyHint: "playback" }));
    }
    const ctx = this.ctx as AudioContext;
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  }

  private applyMix(ramp = 0.08) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (p: AudioParam, v: number) => {
      p.cancelScheduledValues(t);
      p.setTargetAtTime(v, t, ramp / 3);
    };
    set(this.tanBus.gain, Math.pow(this.tanpura.volume, 1.6) * 0.5);
    set(this.wet.gain, this.tanpura.reverb * 0.9);
    set(this.tabWet.gain, this.tanpura.reverb * 0.25);
    set(this.tabBus.gain, Math.pow(this.tabla.volume, 1.6) * 0.9);
    set(this.bayanBus.gain, this.tabla.bayan * 1.1);
    set(this.dayanBus.gain, 1);
    if (!this.fadeTimer) set(this.master.gain, 1);
  }

  setTanpura(s: TanpuraSettings) {
    const wasRec = usesRecording(this.tanpura);
    const isRec = usesRecording(s);
    if (this.tanpuraOn && (wasRec || isRec) && this.recSignature(s) !== this.recSig) {
      // switch file / retune the recording: crossfade to a new voice chain (debounced for sliders)
      this.tanpura = s;
      this.applyMix();
      if (this.recRestart) clearTimeout(this.recRestart);
      this.recRestart = setTimeout(() => {
        this.recRestart = null;
        void this.restartTanpura();
      }, this.offline ? 0 : 160);
      if (this.tablaOn && this.tabla.mode === "strokes") this.updateTablaRate();
      return;
    }
    const pitchChanged =
      JSON.stringify(tanpuraFrequencies(s)) !== JSON.stringify(tanpuraFrequencies(this.tanpura)) ||
      s.jawari !== this.tanpura.jawari || s.voice !== this.tanpura.voice;
    this.tanpura = s;
    this.applyMix();
    if (this.lastPluck.length !== s.strings.length) this.lastPluck = s.strings.map(() => null);
    if (pitchChanged && this.tanpuraOn) void this.prerender();
    if (this.tablaOn && this.tabla.mode === "strokes") this.updateTablaRate();
  }

  setTabla(s: TablaSettings) {
    const prev = this.tabla;
    this.tabla = s;
    this.applyMix();
    if (!this.tablaOn) return;
    if (s.mode !== prev.mode || (s.mode === "recording" && s.loop !== prev.loop)) {
      this.stopTablaSources();
      void this.startTabla();
      return;
    }
    if (s.mode === "strokes" && (s.taal !== prev.taal || s.bpm !== prev.bpm)) this.retime(s.taal !== prev.taal);
  }

  // ---------------- Tanpura ----------------

  private pluckKey(hz: number) {
    const s = this.tanpura;
    return `${hz.toFixed(3)}|${s.jawari.toFixed(2)}|${s.voice}`;
  }

  private pluckBuffer(hz: number, seed: number) {
    const ctx = this.ctx!;
    const key = this.pluckKey(hz);
    let buf = this.pluckCache.get(key);
    if (!buf) {
      const female = this.tanpura.voice === "female";
      const data = renderPluck(hz, {
        sampleRate: ctx.sampleRate,
        duration: female ? 5.5 : 7,
        jawari: this.tanpura.jawari,
        brightness: female ? 0.85 : 0.1,
        decay: female ? 2.4 : 3.3,
        seed,
      });
      buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      if (this.pluckCache.size > 40) this.pluckCache.delete(this.pluckCache.keys().next().value as string);
      this.pluckCache.set(key, buf);
    }
    return buf;
  }

  /** Render all string buffers, yielding between strings so the page stays responsive. */
  async prerender() {
    const { strings } = tanpuraFrequencies(this.tanpura);
    for (let i = 0; i < strings.length; i++) {
      if (!this.pluckCache.has(this.pluckKey(strings[i]))) {
        this.pluckBuffer(strings[i], i + 1);
        if (!this.offline) await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  private schedulePluck(i: number, hz: number, spec: StringSpec, when: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.pluckBuffer(hz, i + 1);
    const g = ctx.createGain();
    const human = 1 + (this.rnd() - 0.5) * 0.18;
    const level = spec.volume * human * (spec.octave < 0 ? 1.05 : 0.85);
    g.gain.setValueAtTime(level, when);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      const n = this.tanpura.strings.length;
      pan.pan.value = n > 1 ? -0.35 + (0.7 * i) / (n - 1) : 0;
      src.connect(g).connect(pan).connect(this.tanBus);
    } else src.connect(g).connect(this.tanBus);
    // re-plucking a string damps its previous vibration
    const prev = this.lastPluck[i];
    if (prev) {
      try {
        prev.g.gain.setTargetAtTime(0, when, 0.04);
        prev.src.stop(when + 0.4);
      } catch {}
    }
    src.start(when);
    this.lastPluck[i] = { src, g };
    this.visuals.push({ kind: "pluck", time: when, string: i });
  }

  private scheduleShimmer(when: number, sa: number) {
    const ctx = this.ctx!;
    const scale = SWARMANDAL_SCALES.find((x) => x.id === this.tanpura.shimmerScale) ?? SWARMANDAL_SCALES[0];
    const notes: number[] = [];
    for (let oct = 0; oct < 2; oct++) for (const sw of scale.notes) notes.push(sa * swarRatio(sw, this.tanpura.temperament) * Math.pow(2, oct + 1));
    notes.push(sa * 8);
    const step = scale.notes.length <= 2 ? 0.11 : 0.06;
    notes.forEach((hz, j) => {
      const key = `sw|${hz.toFixed(2)}`;
      let buf = this.pluckCache.get(key);
      if (!buf) {
        const d = renderSwarmandal(hz, ctx.sampleRate, j + 11);
        buf = ctx.createBuffer(1, d.length, ctx.sampleRate);
        buf.copyToChannel(d as Float32Array<ArrayBuffer>, 0);
        this.pluckCache.set(key, buf);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = this.tanpura.shimmerVolume * 0.22 * (0.75 + 0.25 * this.rnd());
      src.connect(g).connect(this.tanBus);
      src.start(when + j * step + this.rnd() * 0.012);
    });
  }

  private recSignature(s: TanpuraSettings) {
    if (!usesRecording(s)) return `synth`;
    return `${s.first}|${s.key}|${s.a4}|${s.cents}`;
  }

  loadRecManifest() {
    if (!this.recManifest) {
      this.recManifest = fetch(`${REC_BASE}/manifest.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`manifest ${r.status}`);
          return r.json() as Promise<RecManifest>;
        })
        .catch((e) => {
          this.recManifest = null;
          throw e;
        });
    }
    return this.recManifest;
  }

  private loadRecBuffer(info: RecFile) {
    let p = this.recBuffers.get(info.id);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(`${REC_BASE}/${info.id}.${audioExt()}`)
        .then((r) => {
          if (!r.ok) throw new Error(`tanpura ${r.status}`);
          return r.arrayBuffer();
        })
        .then((raw) => ctx.decodeAudioData(raw));
      p.catch(() => this.recBuffers.delete(info.id));
      if (this.recBuffers.size > 6) this.recBuffers.delete(this.recBuffers.keys().next().value as string);
      this.recBuffers.set(info.id, p);
    }
    return p;
  }

  /** Load the recording for the current settings (null if this tuning has none). */
  async prepareRecording() {
    const s = this.tanpura;
    if (!usesRecording(s)) return null;
    const man = await this.loadRecManifest();
    const info = man.files[s.first]?.[KEY_FILE[s.key]];
    if (!info) return null;
    const buf = await this.loadRecBuffer(info);
    const sa = recordedSaHz(s.key, { a4: s.a4, cents: s.cents });
    return { info, buf, rate: sa / info.saHz, xf: man.crossfade };
  }

  private fadeOutRec(t: number, tc = 0.12) {
    if (!this.rec) return;
    for (const v of this.rec.voices) {
      try {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setTargetAtTime(0, t, tc);
        v.src.stop(t + tc * 8);
      } catch {}
    }
    this.rec = null;
  }

  private scheduleRecorded(until: number) {
    const r = this.rec;
    if (!r) return;
    const ctx = this.ctx!;
    const { fin, fout } = crossfadeCurves(r.info.rho);
    while (r.next < until) {
      const t = r.next;
      const loopDur = r.info.loop / r.rate;
      const xf = r.xf / r.rate;
      const src = ctx.createBufferSource();
      src.buffer = r.buf;
      src.playbackRate.value = r.rate;
      const g = ctx.createGain();
      src.connect(g).connect(this.recBus);
      if (r.first) {
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + 0.5);
      } else g.gain.setValueCurveAtTime(fin, t, xf);
      g.gain.setValueCurveAtTime(fout, t + loopDur, xf);
      src.start(t, 0);
      const end = t + loopDur + xf + 0.05;
      src.stop(end);
      r.voices = r.voices.filter((v) => v.end > ctx.currentTime);
      r.voices.push({ src, g, end });
      r.info.onsets.forEach((o, i) => this.visuals.push({ kind: "pluck", time: t + o / r.rate, string: i % 4 }));
      r.first = false;
      r.next = t + loopDur;
    }
  }

  private async restartTanpura() {
    if (!this.tanpuraOn || !this.ctx) return;
    const ctx = this.ctx;
    const sig = this.recSignature(this.tanpura);
    this.recSig = sig;
    let prepared: Awaited<ReturnType<TanpuraTablaEngine["prepareRecording"]>> = null;
    if (usesRecording(this.tanpura)) {
      try {
        prepared = await this.prepareRecording();
        this.recError = null;
      } catch (e) {
        this.recError = `Couldn't load the recorded tanpura (${(e as Error)?.message ?? e}); playing the synth tanpura instead.`;
      }
      if (this.recSig !== sig || !this.tanpuraOn) return; // settings moved on while loading
    }
    const t = ctx.currentTime + 0.05;
    this.fadeOutRec(t, 0.15);
    // stop synth strings
    for (const p of this.lastPluck) {
      if (!p) continue;
      try {
        p.g.gain.setTargetAtTime(0, t, 0.2);
        p.src.stop(t + 1.5);
      } catch {}
    }
    this.lastPluck = this.tanpura.strings.map(() => null);
    this.visuals = this.visuals.filter((v) => v.kind !== "pluck");
    if (prepared) {
      this.rec = { ...prepared, next: t, first: true, voices: [] };
    } else {
      await this.prerender();
    }
    this.nextCycle = t;
    this.cycleCount = 0;
  }

  private scheduleTanpura(until: number) {
    if (this.rec) {
      this.scheduleRecorded(until);
      // swarmandal shimmer keeps its own clock (every ~10 s) over the recording
      while (this.nextCycle < until) {
        if (this.tanpura.shimmer && this.cycleCount % 2 === 1) this.scheduleShimmer(this.nextCycle + 0.6, tanpuraFrequencies(this.tanpura).sa);
        this.cycleCount++;
        this.nextCycle += 5;
      }
      return;
    }
    const s = this.tanpura;
    const { sa, strings } = tanpuraFrequencies(s);
    const offs = pluckOffsets(s.strings.length);
    while (this.nextCycle < until) {
      const t0 = this.nextCycle;
      s.strings.forEach((spec, i) => {
        if (!spec.on) return;
        const jitter = (this.rnd() - 0.5) * 0.04 * s.cycle * (i === 0 ? 0 : 1);
        this.schedulePluck(i, strings[i], spec, t0 + offs[i] * s.cycle + Math.max(0, jitter));
      });
      if (s.shimmer && this.cycleCount % 2 === 1) this.scheduleShimmer(t0 + s.cycle * 0.12, sa);
      this.cycleCount++;
      this.nextCycle = t0 + s.cycle;
    }
  }

  async startTanpura(at?: number) {
    const ctx = this.offline ? this.ctx! : await this.ensureContext();
    this.recSig = this.recSignature(this.tanpura);
    let prepared: Awaited<ReturnType<TanpuraTablaEngine["prepareRecording"]>> = null;
    if (usesRecording(this.tanpura)) {
      try {
        prepared = await this.prepareRecording();
        this.recError = null;
      } catch (e) {
        this.recError = `Couldn't load the recorded tanpura (${(e as Error)?.message ?? e}); playing the synth tanpura instead.`;
      }
    }
    if (!prepared) await this.prerender();
    this.tanpuraOn = true;
    this.lastPluck = this.tanpura.strings.map(() => null);
    const t0 = at ?? ctx.currentTime + 0.08;
    this.rec = prepared ? { ...prepared, next: t0, first: true, voices: [] } : null;
    this.nextCycle = t0;
    this.cycleCount = 0;
    this.applyMix();
    this.loop();
  }

  stopTanpura() {
    this.tanpuraOn = false;
    const t = this.ctx?.currentTime ?? 0;
    if (this.recRestart) clearTimeout(this.recRestart);
    this.recRestart = null;
    this.fadeOutRec(t, 0.25);
    for (const p of this.lastPluck) {
      if (!p) continue;
      try {
        p.g.gain.setTargetAtTime(0, t, 0.25);
        p.src.stop(t + 1.5);
      } catch {}
    }
    this.lastPluck = this.lastPluck.map(() => null);
    this.visuals = this.visuals.filter((v) => v.kind !== "pluck");
    this.maybeIdle();
  }

  // ---------------- Tabla ----------------

  loadKit(): Promise<void> {
    if (this.kitPromise) return this.kitPromise;
    const ctx = this.ctx!;
    this.listener.onKit?.("loading");
    this.kitPromise = (async () => {
      const ext = audioExt();
      const [json, raw] = await Promise.all([
        fetch(`${ASSET_BASE}/kit.json`).then((r) => r.json() as Promise<KitJson>),
        fetch(`${ASSET_BASE}/kit.${ext}`).then((r) => {
          if (!r.ok) throw new Error(`kit ${r.status}`);
          return r.arrayBuffer();
        }),
      ]);
      const buf = await ctx.decodeAudioData(raw);
      const diffs: number[] = [];
      const all = Object.values(json.slots).flat();
      for (const sl of all) diffs.push(detectOnset(buf, sl.onset, 0.09, 0.08) - sl.onset);
      const lead = Math.max(-0.01, Math.min(0.08, median(diffs)));
      const layers: Record<string, KitSlot[][]> = {};
      const rr: Record<string, number> = {};
      for (const [id, slots] of Object.entries(json.slots)) {
        const vels = [...new Set(slots.map((x) => x.vel))].sort((a, b) => a - b);
        layers[id] = vels.map((v) => slots.filter((x) => x.vel === v));
        rr[id] = 0;
      }
      this.kit = { json, buf, lead, layers, rr };
      this.listener.onKit?.("ready");
    })().catch((e) => {
      this.kitPromise = null;
      this.listener.onKit?.("error", String(e?.message ?? e));
      throw e;
    });
    return this.kitPromise;
  }

  /** The recording now playing (QA). */
  get recInfo() {
    return this.rec ? { id: this.rec.info.id, rate: this.rec.rate, loop: this.rec.info.loop, xf: this.rec.xf, saHz: this.rec.info.saHz * this.rec.rate } : null;
  }

  /** Codec lead time detected when the kit was decoded (for QA). */
  get kitLead() {
    return this.kit?.lead ?? null;
  }

  private dayanRate = 1;

  private updateTablaRate() {
    if (!this.kit) return;
    const { sa } = tanpuraFrequencies(this.tanpura);
    const t = this.tabla.tune;
    const r = t === "off" ? 1 : tablaRate(sa, this.kit.json.dayanSaHz, t).rate;
    this.dayanRate = r * Math.pow(2, this.tabla.tuneCents / 1200);
  }

  /** Dayan pitch (Hz) the tabla is tuned to right now. */
  get dayanHz() {
    return this.kit ? this.kit.json.dayanSaHz * this.dayanRate : null;
  }

  private playStroke(stroke: StrokeId, when: number, vel: number) {
    const kit = this.kit!;
    const ctx = this.ctx!;
    const layers = kit.layers[stroke];
    if (!layers?.length) return;
    const v = Math.max(0, Math.min(1, (vel - 0.45) / 0.55));
    const layer = layers[pickLayer(v, layers.length)];
    const slot = layer[kit.rr[stroke]++ % layer.length];
    const isDayan = DAYAN.includes(stroke);
    const rate = isDayan ? this.dayanRate : 1;
    const src = ctx.createBufferSource();
    src.buffer = kit.buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const gain = (0.75 + 0.5 * vel) * Math.min(2.2, 0.32 / Math.max(0.05, slot.peak)) * (0.55 + 0.45 * vel);
    g.gain.setValueAtTime(gain, when);
    src.connect(g).connect(isDayan ? this.dayanBus : this.bayanBus);
    const group: "dayan" | "bayan" = isDayan ? "dayan" : "bayan";
    // closed strokes damp the ringing open strokes on the same drum
    if (DAMPS[stroke] === group) {
      for (const r of this.ringing[group]) {
        if (r.t < when) {
          try {
            r.g.gain.setTargetAtTime(0, when, 0.025);
          } catch {}
        }
      }
      this.ringing[group] = [];
    }
    const offset = Math.max(0, slot.start + kit.lead);
    src.start(when, offset, slot.dur);
    this.ringing[group].push({ src, g, t: when });
    if (this.ringing[group].length > 6) this.ringing[group].shift();
  }

  private retime(taalChanged: boolean) {
    const ctx = this.ctx!;
    const taal = TAALS.find((t) => t.id === this.tabla.taal) ?? TAALS[0];
    if (taalChanged) {
      // start the new taal from its sam on the next beat
      this.tabTaal = taal;
      this.tabEvents = cycleEvents(taal, 60);
      this.tabIdx = 0;
      this.tabAvartan = 0;
      this.visuals = this.visuals.filter((v) => v.kind !== "matra" || v.time <= ctx.currentTime);
      this.tabNext = Math.max(ctx.currentTime + 0.1, this.tabNext);
    }
  }

  private scheduleTabla(until: number) {
    if (!this.kit) return;
    const beat = 60 / this.tabla.bpm;
    const evs = this.tabEvents; // computed at 60 BPM → time is in beats
    const h = this.tabla.humanize;
    while (this.tabNext < until) {
      const e = evs[this.tabIdx];
      const nextIdx = (this.tabIdx + 1) % evs.length;
      const nextPos = nextIdx === 0 ? this.tabTaal.matras : evs[nextIdx].time;
      const gapBeats = nextPos - e.time;
      const gapSec = gapBeats * beat;
      const jitter = this.offline ? 0 : (this.rnd() - 0.5) * 2 * h * Math.min(0.007, gapSec * 0.06);
      const when = this.tabNext + (e.time === 0 && e.matra === 0 ? 0 : jitter);
      const vel = Math.max(0.05, Math.min(1, e.vel + (this.offline ? 0 : (this.rnd() - 0.5) * 0.16 * h)));
      for (const st of e.strokes) this.playStroke(st, when, st === "ge" ? vel * 0.95 : vel);
      this.visuals.push({
        kind: "matra", time: when, matra: e.matra, sub: e.sub, bol: e.bol, avartan: this.tabAvartan,
        dayan: e.strokes.some((s) => DAYAN.includes(s)), bayan: e.strokes.some((s) => !DAYAN.includes(s)),
      });
      this.tabNext += gapSec;
      if (nextIdx === 0) this.tabAvartan++;
      this.tabIdx = nextIdx;
    }
  }

  private loopsPromise: Promise<LoopInfo[]> | null = null;

  loadLoops(): Promise<LoopInfo[]> {
    if (!this.loopsPromise) {
      this.loopsPromise = fetch(`${ASSET_BASE}/loops.json`)
        .then((r) => r.json() as Promise<LoopInfo[]>)
        .catch((e) => {
          this.loopsPromise = null;
          throw e;
        });
    }
    return this.loopsPromise;
  }

  private loadLoop(info: LoopInfo) {
    let p = this.loopBuffers.get(info.id);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(`${ASSET_BASE}/loops/${info.id}.${audioExt()}`)
        .then((r) => {
          if (!r.ok) throw new Error(`loop ${r.status}`);
          return r.arrayBuffer();
        })
        .then((raw) => ctx.decodeAudioData(raw))
        .then((buf) => ({ buf, lead: Math.max(0, Math.min(0.08, detectOnset(buf, info.onset, 0.09, 0.08) - info.onset)) }));
      p.catch(() => this.loopBuffers.delete(info.id));
      this.loopBuffers.set(info.id, p);
    }
    return p;
  }

  async startTabla(at?: number) {
    const ctx = this.offline ? this.ctx! : await this.ensureContext();
    this.tablaOn = true;
    this.applyMix();
    if (this.tabla.mode === "recording") {
      try {
        const loops = await this.loadLoops();
        const info = loops.find((l) => l.id === this.tabla.loop) ?? loops[0];
        this.listener.onKit?.("loading");
        const { buf, lead } = await this.loadLoop(info);
        this.listener.onKit?.("ready");
        if (!this.tablaOn || this.tabla.mode !== "recording") return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = lead;
        src.loopEnd = lead + info.duration;
        src.connect(this.tabBus);
        const when = at ?? ctx.currentTime + 0.06;
        src.start(when, lead);
        this.loopSrc = src;
        this.loopStart = when;
        this.loopInfo = info;
        this.loopLastBeat = -1;
      } catch (e) {
        this.listener.onKit?.("error", String((e as Error)?.message ?? e));
        this.tablaOn = false;
        return;
      }
    } else {
      await this.loadKit();
      if (!this.tablaOn) return;
      this.updateTablaRate();
      this.tabTaal = TAALS.find((t) => t.id === this.tabla.taal) ?? TAALS[0];
      this.tabEvents = cycleEvents(this.tabTaal, 60);
      this.tabIdx = 0;
      this.tabAvartan = 0;
      this.tabNext = at ?? ctx.currentTime + 0.08;
    }
    this.loop();
  }

  private stopTablaSources() {
    const t = this.ctx?.currentTime ?? 0;
    if (this.loopSrc) {
      try {
        this.loopSrc.stop(t + 0.02);
      } catch {}
      this.loopSrc = null;
    }
    for (const grp of ["dayan", "bayan"] as const) {
      for (const r of this.ringing[grp]) {
        try {
          r.g.gain.setTargetAtTime(0, t, 0.05);
          r.src.stop(t + 0.5);
        } catch {}
      }
      this.ringing[grp] = [];
    }
    this.visuals = this.visuals.filter((v) => v.kind !== "matra");
  }

  stopTabla() {
    this.tablaOn = false;
    this.stopTablaSources();
    this.maybeIdle();
  }

  // ---------------- transport ----------------

  private tick = () => {
    const ctx = this.ctx;
    if (!ctx) return;
    const ahead = ctx.currentTime + 0.35;
    if (this.tanpuraOn) this.scheduleTanpura(ahead);
    if (this.tablaOn && this.tabla.mode === "strokes") this.scheduleTabla(ahead);
  };

  private frame = () => {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime - ((ctx as AudioContext).outputLatency || 0);
    if (this.visuals.length) {
      const due = this.visuals.filter((v) => v.time <= now);
      if (due.length) {
        this.visuals = this.visuals.filter((v) => v.time > now);
        for (const v of due) {
          if (v.kind === "pluck") this.listener.onPluck?.(v.string);
          else this.listener.onMatra?.(v);
        }
      }
    }
    if (this.loopSrc && this.loopInfo && now >= this.loopStart) {
      const beat = 60 / this.loopInfo.bpm;
      const b = Math.floor((now - this.loopStart) / beat);
      if (b !== this.loopLastBeat) {
        this.loopLastBeat = b;
        const m = b % this.loopInfo.beats;
        this.listener.onMatra?.({ matra: m, sub: 0, bol: "", avartan: Math.floor(b / this.loopInfo.beats), dayan: true, bayan: m % 4 === 0 });
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private loop() {
    if (this.offline) {
      return;
    }
    if (!this.timer) {
      this.tick();
      this.timer = setInterval(this.tick, 40);
    }
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
    this.updateMediaSession();
  }

  private maybeIdle() {
    if (this.tanpuraOn || this.tablaOn) {
      this.updateMediaSession();
      return;
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.updateMediaSession();
  }

  stopAll() {
    this.cancelStopTimer();
    this.stopTanpura();
    this.stopTabla();
  }

  /** Fade out and stop after `minutes` (0 = cancel). Returns the end time in ms since epoch. */
  setStopTimer(minutes: number, onDone: () => void): number | null {
    this.cancelStopTimer();
    if (!minutes) return null;
    const ms = minutes * 60_000;
    this.stopTimer = setTimeout(() => {
      const ctx = this.ctx;
      if (!ctx) return onDone();
      const t = ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + 5);
      this.fadeTimer = setTimeout(() => {
        this.fadeTimer = null;
        this.stopTanpura();
        this.stopTabla();
        this.master.gain.setValueAtTime(1, (this.ctx?.currentTime ?? 0) + 1.6);
        onDone();
      }, 5200);
    }, ms);
    return Date.now() + ms;
  }

  cancelStopTimer() {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = null;
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
      if (this.ctx) this.master.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
    }
  }

  mediaHandlers: { play?: () => void; pause?: () => void } = {};

  private updateMediaSession() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const playing = this.tanpuraOn || this.tablaOn;
    try {
      ms.playbackState = playing ? "playing" : "paused";
      if (playing && typeof MediaMetadata !== "undefined") {
        const keyNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
        const first = this.tanpura.strings[0]?.swar ?? "P";
        const firstName = { P: "Pa", m: "Ma", N: "Ni", n: "komal Ni", S: "Sa" }[first as string] ?? first;
        const parts = [];
        if (this.tanpuraOn) parts.push(`Tanpura ${keyNames[this.tanpura.key]} · ${firstName}`);
        if (this.tablaOn)
          parts.push(this.tabla.mode === "recording" ? "Tabla groove" : `${(TAALS.find((t) => t.id === this.tabla.taal) ?? TAALS[0]).name} ${this.tabla.bpm} BPM`);
        ms.metadata = new MediaMetadata({
          title: parts.join(" + "),
          artist: "UNIEDD Tanpura & Tabla",
          album: "UNIEDD Games",
          artwork: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
        });
      }
      ms.setActionHandler("play", () => this.mediaHandlers.play?.());
      ms.setActionHandler("pause", () => this.mediaHandlers.pause?.());
      ms.setActionHandler("stop", () => this.mediaHandlers.pause?.());
    } catch {}
  }

  /** Offline (non-real-time) scheduling for QA renders: schedule everything up to `seconds`. */
  async scheduleOffline(seconds: number) {
    if (this.tanpuraOn) this.scheduleTanpura(seconds);
    if (this.tablaOn && this.tabla.mode === "strokes") this.scheduleTabla(seconds);
  }

  /** Scheduled tabla hit times (QA): drains the visual queue. */
  drainVisuals() {
    const v = this.visuals;
    this.visuals = [];
    return v;
  }

  dispose() {
    this.stopAll();
    if (this.ctx && "close" in this.ctx && !this.offline) void (this.ctx as AudioContext).close();
    this.ctx = null;
  }
}

/** Render tanpura and/or tabla offline (used by the in-browser QA check). */
export async function renderOffline(opts: {
  tanpura: TanpuraSettings;
  tabla: TablaSettings;
  seconds: number;
  withTanpura: boolean;
  withTabla: boolean;
  sampleRate?: number;
}) {
  const sr = opts.sampleRate ?? 44100;
  const ctx = new OfflineAudioContext(2, Math.round(opts.seconds * sr), sr);
  const eng = new TanpuraTablaEngine({ ...opts.tanpura, reverb: 0 }, { ...opts.tabla, humanize: 0 }, ctx);
  if (opts.withTanpura) await eng.startTanpura(0.05);
  if (opts.withTabla) await eng.startTabla(0.05);
  await eng.scheduleOffline(opts.seconds);
  const visuals = eng.drainVisuals();
  const buf = await ctx.startRendering();
  return { buffer: buf, visuals, kitLead: eng.kitLead, dayanHz: eng.dayanHz, rec: eng.recInfo };
}
