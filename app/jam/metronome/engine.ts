// Web Audio engine for the Jam metronome.
//
//   click layer ─► clickBus (own on/off + volume) ─┐
//                                                  ├─► master ─► limiter ─► speakers
//   voice layer ─► voiceBus (own on/off + volume) ─┘
//
// Both layers are scheduled on the AudioContext clock by one look-ahead scheduler
// (25 ms timer running in a Web Worker so background tabs keep time, ~100 ms
// schedule-ahead). Each tick is planned separately for click and voice
// (timeline.ts), so a beat's click and its spoken count are started at the same
// AudioContext time but neither depends on the other being on.
// The voice is pre-recorded, pre-decoded AudioBuffers (no speechSynthesis), and
// each word is started slightly early by its measured onset so the vowel lands
// on the beat.

import { renderClick, type SoundKit } from "./sounds";
import {
  planWindow,
  VOICE_WORDS,
  type ClickKind,
  type PlannedEvent,
  type Tick,
  type TimelineSettings,
  type VoiceWord,
} from "./timeline";

export type VoiceId = "female" | "male";

export interface EngineSettings extends TimelineSettings {
  kit: SoundKit;
  clickOn: boolean;
  clickVolume: number; // 0..1 slider
  voiceOn: boolean;
  voiceVolume: number; // 0..1 slider
  voice: VoiceId;
}

interface VoiceSample {
  buffer: AudioBuffer;
  start: number; // seconds into the buffer where sound begins (skips any codec padding)
  onset: number; // seconds from `start` to the perceived beat point of the word
}

export const LOOKAHEAD_MS = 25;
export const SCHEDULE_AHEAD = 0.1;
const SCHEDULE_AHEAD_HIDDEN = 1.0; // background tabs: timers can be throttled, so plan further ahead
const MAX_VOICE_LEAD = 0.18; // the earliest a word may start before its beat

/** Slider (0..1) to gain: squared for a natural-feeling volume taper. */
export const sliderToGain = (v: number) => Math.max(0, Math.min(1, v)) ** 2;

/**
 * Where in a decoded word the sound begins, and where its perceived beat point
 * (P-centre) is. The P-centre of a spoken word sits near its vowel onset, not on
 * a leading "t" / "th" / "s", so it is measured on the low band (<~1.2 kHz, two
 * one-pole low-passes) where vowels carry their energy: the point the 20 ms
 * envelope first reaches 50% of its maximum.
 */
export function analyseVoice(data: Float32Array, sampleRate: number): { start: number; onset: number } {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak === 0) return { start: 0, onset: 0 };
  // first sample louder than -45 dB re peak = start of sound (minus 5 ms to keep the consonant)
  const th = peak * 10 ** (-45 / 20);
  let first = 0;
  while (first < data.length && Math.abs(data[first]) < th) first++;
  const startSample = Math.max(0, first - Math.round(sampleRate * 0.005));

  const a = Math.exp((-2 * Math.PI * 1200) / sampleRate);
  const win = Math.max(1, Math.round(sampleRate * 0.02));
  const env = new Float32Array(data.length);
  let l1 = 0, l2 = 0, acc = 0;
  const lo = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    l1 = (1 - a) * data[i] + a * l1;
    l2 = (1 - a) * l1 + a * l2;
    lo[i] = l2;
    acc += l2 * l2;
    if (i >= win) acc -= lo[i - win] * lo[i - win];
    env[i] = Math.sqrt(Math.max(0, acc) / win);
  }
  let max = 0;
  for (let i = 0; i < env.length; i++) if (env[i] > max) max = env[i];
  let half = 0;
  while (half < env.length && env[half] < max * 0.5) half++;
  // the envelope is a trailing window: shift back by half a window
  const onsetSample = Math.max(startSample, half - Math.round(win / 2));
  return { start: startSample / sampleRate, onset: Math.min(MAX_VOICE_LEAD, (onsetSample - startSample) / sampleRate) };
}

export class MetronomeEngine {
  ctx: AudioContext | null = null;
  private clickBus!: GainNode;
  private voiceBus!: GainNode;
  private master!: GainNode;
  private clickBuffers = new Map<string, AudioBuffer>();
  private voices = new Map<VoiceId, Map<VoiceWord, VoiceSample>>();
  private voiceLoading = new Map<VoiceId, Promise<boolean>>();
  private settings: EngineSettings;
  private next: Tick = { time: 0, beat: 0, sub: 0 };
  private running = false;
  private worker: Worker | null = null;
  private fallbackTimer: number | null = null;
  private live: { src: AudioBufferSourceNode; end: number }[] = [];
  private lastVoice: { gain: GainNode; src: AudioBufferSourceNode; end: number } | null = null;
  /** Ticks already scheduled, for the visual beat indicator. */
  private visualQueue: Tick[] = [];
  onVoiceState: (state: "idle" | "loading" | "ready" | "error") => void = () => {};

  constructor(initial: EngineSettings) {
    this.settings = { ...initial, beats: [...initial.beats] };
  }

  get isRunning() {
    return this.running;
  }

  /** Must be called from a user gesture (tap / click / key). Creates + unlocks audio on iOS too. */
  unlock(): AudioContext {
    if (!this.ctx) {
      // iOS 17+: play through the ring/silent switch like a media app.
      try {
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = "playback";
      } catch {
        /* not supported */
      }
      const Ctx: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx({ latencyHint: "interactive" });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      // Brick-wall-ish limiter: catches click + voice peaks so nothing ever clips.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;
      this.master.connect(limiter);
      limiter.connect(ctx.destination);
      this.clickBus = ctx.createGain();
      this.voiceBus = ctx.createGain();
      this.clickBus.connect(this.master);
      this.voiceBus.connect(this.master);
      this.applyBusGains(true);
      this.renderKit(this.settings.kit);
    }
    const ctx = this.ctx;
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    // iOS Safari only unlocks after a sound is started inside the gesture.
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    silent.connect(ctx.destination);
    silent.start(0);
    return ctx;
  }

  private renderKit(kit: SoundKit) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const kind of ["accent", "beat", "sub"] as ClickKind[]) {
      const key = `${kit}:${kind}`;
      if (this.clickBuffers.has(key)) continue;
      const data = renderClick(kit, kind, ctx.sampleRate);
      const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.clickBuffers.set(key, buf);
    }
  }

  private applyBusGains(immediate = false) {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = this.settings;
    const c = s.clickOn ? sliderToGain(s.clickVolume) : 0;
    const v = s.voiceOn ? sliderToGain(s.voiceVolume) : 0;
    if (immediate) {
      this.clickBus.gain.value = c;
      this.voiceBus.gain.value = v;
    } else {
      // short glide: instant to the ear, but no zipper noise
      this.clickBus.gain.setTargetAtTime(c, ctx.currentTime, 0.012);
      this.voiceBus.gain.setTargetAtTime(v, ctx.currentTime, 0.012);
    }
  }

  update(patch: Partial<EngineSettings>) {
    const prev = this.settings;
    this.settings = { ...prev, ...patch, beats: [...(patch.beats ?? prev.beats)] };
    if (patch.kit && this.ctx) this.renderKit(patch.kit);
    if (
      patch.clickOn !== undefined ||
      patch.clickVolume !== undefined ||
      patch.voiceOn !== undefined ||
      patch.voiceVolume !== undefined
    )
      this.applyBusGains();
    if ((patch.voiceOn || patch.voice) && this.settings.voiceOn) void this.loadVoice(this.settings.voice);
    // bar got shorter: wrap the pending tick so it never points past the bar
    if (this.next.beat >= this.settings.beats.length) this.next = { ...this.next, beat: 0, sub: 0 };
    if (this.next.sub >= this.settings.subdivision) this.next = { ...this.next, beat: (this.next.beat + 1) % this.settings.beats.length, sub: 0 };
  }

  loadVoice(id: VoiceId): Promise<boolean> {
    const existing = this.voiceLoading.get(id);
    if (existing) {
      if (this.voices.has(id)) this.onVoiceState("ready");
      return existing;
    }
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(false);
    this.onVoiceState("loading");
    const p = (async () => {
      try {
        const map = new Map<VoiceWord, VoiceSample>();
        await Promise.all(
          VOICE_WORDS.map(async (w) => {
            const res = await fetch(`/metronome/voice/${id}/${w}.mp3`);
            if (!res.ok) throw new Error(`voice ${w}: ${res.status}`);
            const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
            const { start, onset } = analyseVoice(buffer.getChannelData(0), buffer.sampleRate);
            map.set(w, { buffer, start, onset });
          }),
        );
        this.voices.set(id, map);
        if (this.settings.voice === id) this.onVoiceState("ready");
        return true;
      } catch {
        this.voiceLoading.delete(id);
        if (this.settings.voice === id) this.onVoiceState("error");
        return false;
      }
    })();
    this.voiceLoading.set(id, p);
    return p;
  }

  start() {
    const ctx = this.unlock();
    if (this.running) return;
    this.running = true;
    if (this.settings.voiceOn) void this.loadVoice(this.settings.voice);
    // leave room for the voice to start a little before beat 1
    this.next = { time: ctx.currentTime + 0.15, beat: 0, sub: 0 };
    this.visualQueue = [];
    this.tickScheduler();
    this.startTimer();
  }

  stop() {
    this.running = false;
    this.stopTimer();
    const ctx = this.ctx;
    if (ctx) {
      const now = ctx.currentTime;
      for (const { src } of this.live) {
        try {
          src.stop(now + 0.005);
        } catch {
          /* already stopped */
        }
      }
    }
    this.live = [];
    this.lastVoice = null;
    this.visualQueue = [];
  }

  dispose() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  /** The most recent tick that is audible right now (compensates for output latency). */
  currentVisualTick(): Tick | null {
    const ctx = this.ctx;
    if (!ctx || !this.running) return null;
    const heard = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    let cur: Tick | null = null;
    while (this.visualQueue.length && this.visualQueue[0].time <= heard) cur = this.visualQueue.shift()!;
    return cur;
  }

  // --- scheduler ---------------------------------------------------------------

  private startTimer() {
    if (!this.worker && typeof Worker !== "undefined") {
      try {
        const src = `let id=null;onmessage=e=>{if(e.data==='start'){clearInterval(id);id=setInterval(()=>postMessage(0),${LOOKAHEAD_MS});}else{clearInterval(id);id=null;}}`;
        const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
        this.worker = new Worker(url);
        URL.revokeObjectURL(url);
        this.worker.onmessage = () => this.tickScheduler();
      } catch {
        this.worker = null;
      }
    }
    if (this.worker) this.worker.postMessage("start");
    else this.fallbackTimer = window.setInterval(() => this.tickScheduler(), LOOKAHEAD_MS);
  }

  private stopTimer() {
    this.worker?.postMessage("stop");
    if (this.fallbackTimer != null) window.clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  private tickScheduler() {
    const ctx = this.ctx;
    if (!ctx || !this.running) return;
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    const ahead = hidden ? SCHEDULE_AHEAD_HIDDEN : SCHEDULE_AHEAD;
    // If the device stalled (suspended tab, CPU spike) don't fire a burst of stale notes: resync.
    if (this.next.time < ctx.currentTime - 0.05) {
      this.next = { ...this.next, time: ctx.currentTime + 0.05 };
    }
    // plan far enough ahead that a word can start before its beat
    const { events, next } = planWindow(this.next, this.settings, ctx.currentTime + ahead + MAX_VOICE_LEAD);
    this.next = next;
    for (const ev of events) this.scheduleEvent(ev);
    const now = ctx.currentTime;
    this.live = this.live.filter((l) => l.end > now);
  }

  private scheduleEvent(ev: PlannedEvent) {
    const ctx = this.ctx!;
    const t = ev.tick.time;
    // CLICK layer: always scheduled (gated by clickBus) so toggling clicks back on is instant.
    if (ev.click) {
      const buf = this.clickBuffers.get(`${this.settings.kit}:${ev.click}`);
      if (buf) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.clickBus);
        src.start(Math.max(t, ctx.currentTime));
        this.live.push({ src, end: t + buf.duration });
      }
    }
    // VOICE layer: independent of the click (plays on muted beats and with clicks off).
    if (ev.voice) {
      const sample = this.voices.get(this.settings.voice)?.get(ev.voice);
      if (sample) this.scheduleVoice(sample, ev.voice, t);
    }
    if (ev.tick.sub === 0) {
      this.visualQueue.push(ev.tick);
      if (this.visualQueue.length > 64) this.visualQueue.splice(0, this.visualQueue.length - 64);
    }
  }

  private scheduleVoice(sample: VoiceSample, word: VoiceWord, beatTime: number) {
    const ctx = this.ctx!;
    let when = beatTime - sample.onset;
    let offset = sample.start;
    if (when < ctx.currentTime) {
      offset += ctx.currentTime - when;
      when = ctx.currentTime;
    }
    // A word still ringing gets a 10 ms fade right as the next one starts, so fast counts stay clean.
    const prev = this.lastVoice;
    if (prev && prev.end > when) {
      prev.gain.gain.setValueAtTime(prev.gain.gain.value || 1, when);
      prev.gain.gain.linearRampToValueAtTime(0, when + 0.012);
      try {
        prev.src.stop(when + 0.015);
      } catch {
        /* ignore */
      }
    }
    const g = ctx.createGain();
    const isNumber = word.length === 1 && word >= "1" && word <= "7";
    g.gain.value = isNumber ? (word === "1" ? 1 : 0.9) : 0.7;
    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;
    src.connect(g);
    g.connect(this.voiceBus);
    src.start(when, offset);
    const end = when + (sample.buffer.duration - offset);
    this.live.push({ src, end });
    this.lastVoice = { gain: g, src, end };
  }
}
