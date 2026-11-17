/**
 * Audio for the Alternate Picking & Strumming Coach.
 * Re-uses the Clap Rhythm engine (one AudioContext for playback and the mic, a
 * sample-accurate onset detector, heard-clock smoothing) and adds a small guitar
 * synth for the demo, plus the browser's speech voice for calling out patterns.
 */

import { ClapEngine, midiFreq } from "../clap/engine";
import { CHORDS, type Dir } from "./patterns";
import { chromaFromSpectrum } from "./chroma";
import { OnsetTracker, STRUM_MERGE_S, analyzeOnset, type PluckKind, type PluckVerdict } from "./pluck";

/** Copies raw mic samples to the main thread in 1024-sample blocks with their frame index. */
const TAP_WORKLET = `
class UniPluckTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(1024); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === 1024) {
        this.port.postMessage({ frame: currentFrame + i + 1 - 1024, data: this.buf.slice(0) });
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor("uniedd-pluck-tap-v1", UniPluckTap);
`;

const RING = 1 << 16; // ~1.4 s of raw audio
const PRE_S = 0.1; // analysis window: 100 ms before the onset …
const POST_S = 0.3; // … to 300 ms after it

const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

export class PickEngine extends ClapEngine {
  private analyser: AnalyserNode | null = null;
  private spec: Float32Array<ArrayBuffer> | null = null;
  private wave: Float32Array<ArrayBuffer> | null = null;
  private floor = 0.002;

  // ---- "is it a guitar string?" listener: raw samples → onsets → analysis
  private tapNode: AudioWorkletNode | null = null;
  private tapReady = false;
  private ring = new Float32Array(RING);
  private ringEnd = -1; // absolute frame just after the newest sample
  private tracker: OnsetTracker | null = null;
  private trackerStart = 0;
  private pending: number[] = [];
  private lastOnset = -1e12;
  /** Single picked notes or strums — decides which checks `analyzeOnset` uses. */
  pluckKind: PluckKind = "note";
  /** Every onset heard, once it has been analysed (frame = absolute input frame). */
  onPluck: ((verdict: PluckVerdict, frame: number) => void) | null = null;
  private pluckSens = 0.6;

  /** Start the onset listener on the mic (needs startMic first). */
  async startPluckListener() {
    if (this.tapNode || !this.micSource) return !!this.tapNode;
    if (!this.tapReady) {
      const url = URL.createObjectURL(new Blob([TAP_WORKLET], { type: "application/javascript" }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.tapReady = true;
    }
    if (!this.micSource) return false;
    const node = new AudioWorkletNode(this.ctx, "uniedd-pluck-tap-v1", { numberOfInputs: 1, numberOfOutputs: 1 });
    node.port.onmessage = (e: MessageEvent) => this.onRaw(e.data as { frame: number; data: Float32Array });
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.micSource.connect(node).connect(mute).connect(this.ctx.destination);
    this.tapNode = node;
    this.tracker = null;
    this.pending = [];
    this.ringEnd = -1;
    return true;
  }

  setPluckSensitivity(s: number) {
    this.pluckSens = s;
    this.tracker?.setSensitivity(s);
  }

  /** Copy of raw input frames [from, to), or null if no longer (or not yet) buffered. */
  rawRange(from: number, to: number) {
    if (to > this.ringEnd || from < this.ringEnd - RING || to <= from) return null;
    const out = new Float32Array(to - from);
    for (let i = 0; i < out.length; i++) out[i] = this.ring[(from + i) & (RING - 1)];
    return out;
  }

  private onRaw(msg: { frame: number; data: Float32Array }) {
    const { frame, data } = msg;
    if (this.ringEnd >= 0 && frame !== this.ringEnd) {
      // a gap (tab was asleep): start over
      this.tracker = null;
      this.pending = [];
    }
    for (let i = 0; i < data.length; i++) this.ring[(frame + i) & (RING - 1)] = data[i];
    this.ringEnd = frame + data.length;
    if (!this.tracker) {
      this.tracker = new OnsetTracker(this.ctx.sampleRate);
      this.tracker.setSensitivity(this.pluckSens);
      this.trackerStart = frame;
    }
    for (const rel of this.tracker.push(data)) {
      const at = this.trackerStart + rel;
      // in a strum the strings sound one after another: keep only the first onset
      if (this.pluckKind === "strum" && at - this.lastOnset < STRUM_MERGE_S * this.ctx.sampleRate) continue;
      this.lastOnset = at;
      this.pending.push(at);
    }
    const sr = this.ctx.sampleRate;
    const post = Math.round(POST_S * sr);
    const pre = Math.round(PRE_S * sr);
    while (this.pending.length && this.ringEnd >= this.pending[0] + post) {
      const at = this.pending.shift()!;
      const next = this.pending[0];
      const buf = this.rawRange(at - pre, at + post);
      if (!buf) continue;
      const verdict = analyzeOnset(buf, sr, pre, {
        kind: this.pluckKind,
        end: next !== undefined && next < at + post ? pre + (next - at) : undefined,
      });
      const dbgV = (globalThis as unknown as { __uniPickDebug?: { verdicts?: unknown[] } }).__uniPickDebug;
      if (dbgV) (dbgV.verdicts = [...(dbgV.verdicts ?? []).slice(-49), { at, ...verdict }]);
      this.onPluck?.(verdict, at);
    }
  }

  /** Listen to the mic for chords/notes (needs startMic first). */
  ensureAnalyser() {
    if (this.analyser || !this.micSource) return !!this.analyser;
    const a = this.ctx.createAnalyser();
    a.fftSize = 16384;
    a.smoothingTimeConstant = 0.25;
    this.micSource.connect(a);
    this.analyser = a;
    this.spec = new Float32Array(new ArrayBuffer(a.frequencyBinCount * 4));
    this.wave = new Float32Array(new ArrayBuffer(2048 * 4));
    return true;
  }

  /**
   * Current pitch-class profile from the mic plus a loudness gate: `loud` is true when
   * the input clearly stands above the room's noise floor (so silence never "matches").
   */
  readChroma(): { chroma: number[]; loud: boolean; rms: number } | null {
    const a = this.analyser;
    if (!a || !this.spec || !this.wave) return null;
    a.getFloatTimeDomainData(this.wave);
    let sum = 0;
    for (let i = 0; i < this.wave.length; i++) sum += this.wave[i] * this.wave[i];
    const rms = Math.sqrt(sum / this.wave.length);
    // slow-rising, fast-falling noise floor
    this.floor = rms < this.floor ? this.floor * 0.8 + rms * 0.2 : this.floor * 0.998 + rms * 0.002;
    a.getFloatFrequencyData(this.spec);
    const { chroma } = chromaFromSpectrum(this.spec, this.ctx.sampleRate, a.fftSize);
    return { chroma, loud: rms > Math.max(0.004, this.floor * 2.5), rms };
  }

  stopMic() {
    this.analyser?.disconnect();
    this.analyser = null;
    this.tapNode?.disconnect();
    this.tapNode = null;
    this.tracker = null;
    this.pending = [];
    super.stopMic();
  }

  /** One plucked guitar-like note (demo only — the mic is ignored while the demo plays). */
  pluck(at: number, midi: number, vol = 0.32, accent = false) {
    const ctx = this.ctx;
    const f = midiFreq(midi);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), at);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 2), at + 0.6);
    const v = vol * (accent ? 1.35 : 1);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(v, at + 0.004);
    g.gain.exponentialRampToValueAtTime(v * 0.35, at + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    for (const [type, mul, gain] of [["sawtooth", 1, 0.55], ["triangle", 2, 0.35], ["sine", 1, 0.6]] as const) {
      const o = this.track(ctx.createOscillator());
      o.type = type;
      o.frequency.setValueAtTime(f * mul, at);
      const og = ctx.createGain();
      og.gain.value = gain;
      o.connect(og).connect(lp);
      o.start(at);
      o.stop(at + 1.15);
    }
    lp.connect(g).connect(this.musicBus);
  }

  /** A strum across a chord: down = low → high strings, up = high → low (top 4 strings). */
  strum(at: number, chord: string, dir: Dir, accent = false) {
    const shape = CHORDS[chord];
    if (!shape) return;
    let notes = shape.frets
      .map((fr, i) => (fr < 0 ? null : OPEN_STRINGS[i] + fr))
      .filter((m): m is number => m !== null);
    if (dir === "U") notes = notes.slice(-4).reverse();
    const gap = dir === "D" ? 0.011 : 0.008;
    notes.forEach((m, i) => this.pluck(at + i * gap, m, (dir === "D" ? 0.13 : 0.1) * (accent ? 1.3 : 1)));
  }
}

// ---------------------------------------------------------------- speech

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined && cachedVoice !== null) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en/i.test(v.lang));
  cachedVoice =
    en.find((v) => /en-IN/i.test(v.lang)) ||
    en.find((v) => /female|samantha|zira|google uk english female|google us english/i.test(v.name)) ||
    en[0] ||
    voices[0] ||
    null;
  return cachedVoice;
}

/**
 * Say `text` with a cheerful voice. Resolves when speech ends (or after a timeout,
 * because some browsers never fire `onend`). Never rejects.
 */
export function speak(text: string, opts: { rate?: number; pitch?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!speechSupported()) return resolve();
    const synth = window.speechSynthesis;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, 1500 + text.length * 95);
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/\b(DOWN|UP)\b/g, (w) => w.toLowerCase() + "!"));
      const voice = pickVoice();
      if (voice) u.voice = voice;
      u.lang = voice?.lang || "en-US";
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 1.15;
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
    } catch {
      finish();
    }
  });
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}
