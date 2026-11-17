/**
 * Audio for the Alternate Picking & Strumming Coach.
 * Re-uses the Clap Rhythm engine (one AudioContext for playback and the mic, a
 * sample-accurate onset detector, heard-clock smoothing) and adds a small guitar
 * synth for the demo, plus the browser's speech voice for calling out patterns.
 */

import { ClapEngine, midiFreq } from "../clap/engine";
import { CHORDS, type Dir } from "./patterns";
import { chromaFromSpectrum } from "./chroma";

const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

export class PickEngine extends ClapEngine {
  private analyser: AnalyserNode | null = null;
  private spec: Float32Array<ArrayBuffer> | null = null;
  private wave: Float32Array<ArrayBuffer> | null = null;
  private floor = 0.002;

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
