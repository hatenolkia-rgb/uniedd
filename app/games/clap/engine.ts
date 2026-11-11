/**
 * Audio engine for the Clap Rhythm trainer:
 * - one AudioContext for playback AND the microphone, so clap timestamps and
 *   the song share one clock
 * - an AudioWorklet clap detector (high-passed energy spike, adaptive noise
 *   floor, debounce) that reports sample-accurate onset times
 * - a tiny synth for the melody, chords, bass, metronome and guide claps
 */

import { chordMidis, clapNotes, type ClapSong } from "./songs";

export const midiFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const WORKLET = `
class ClapDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.floor = 0.002;
    this.recent = 0.002;
    this.last = -1;
    this.sens = 0.6;
    this.debounce = 0.08;
    this.n = 0;
    this.peak = 0;
    this.port.onmessage = (e) => {
      if (typeof e.data.sens === "number") this.sens = e.data.sens;
      if (typeof e.data.debounce === "number") this.debounce = e.data.debounce;
    };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / ch.length);
    const s = this.sens;
    const ratio = 2.2 + (1 - s) * 9;
    const absMin = 0.006 + (1 - s) * 0.05;
    const thr = Math.max(this.floor * ratio, absMin);
    const t = currentTime;
    if (rms > thr && rms > this.recent * 2.2 && t - this.last > this.debounce) {
      let idx = 0;
      const lim = thr * 1.5;
      for (let i = 0; i < ch.length; i++) { if (Math.abs(ch[i]) > lim) { idx = i; break; } }
      this.last = t;
      this.port.postMessage({ type: "onset", t: t + idx / sampleRate, level: rms });
    }
    // Adaptive noise floor: falls quickly, rises slowly so claps barely move it
    const a = rms > this.floor ? 0.0015 : 0.03;
    this.floor = Math.max(0.0005, this.floor + (rms - this.floor) * a);
    this.recent += (rms - this.recent) * 0.35;
    this.peak = Math.max(this.peak, rms);
    if (++this.n >= 8) {
      this.port.postMessage({ type: "level", rms: this.peak, floor: this.floor, thr });
      this.n = 0;
      this.peak = 0;
    }
    return true;
  }
}
registerProcessor("uniedd-clap-detector", ClapDetector);
`;

export type MicStatus = "off" | "asking" | "on" | "denied" | "unsupported";

export class ClapEngine {
  ctx: AudioContext;
  master: GainNode;
  musicBus: GainNode;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private workletReady = false;
  onClap: ((ctxTime: number, level: number) => void) | null = null;
  onLevel: ((rms: number, thr: number) => void) | null = null;
  private scheduled: AudioScheduledSourceNode[] = [];
  private noise: AudioBuffer;

  constructor() {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    // a soft echo for a roomier synth
    const delay = this.ctx.createDelay(1);
    delay.delayTime.value = 0.18;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.22;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.18;
    this.musicBus.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(this.master);
    this.noise = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.25), this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  async resume() {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  /** Context time of the sound the listener is hearing right now. */
  heardNow(perfNow = performance.now()) {
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
      return ts.contextTime + (perfNow - ts.performanceTime) / 1000;
    }
    return this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0);
  }

  /** Convert an event timestamp (performance.now domain) to heard context time. */
  eventToCtx(eventTimeStamp: number) {
    return this.heardNow(eventTimeStamp);
  }

  get micOn() {
    return !!this.stream;
  }

  async startMic(): Promise<MicStatus> {
    if (this.stream) return "on";
    if (!navigator.mediaDevices?.getUserMedia || !this.ctx.audioWorklet) return "unsupported";
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      return "denied";
    }
    await this.resume();
    if (!this.workletReady) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.workletReady = true;
    }
    const src = this.ctx.createMediaStreamSource(this.stream);
    // Claps are bright, broadband bursts — keep the highs, drop voice and hum
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    hp.Q.value = 0.7;
    const hp2 = this.ctx.createBiquadFilter();
    hp2.type = "highpass";
    hp2.frequency.value = 1800;
    hp2.Q.value = 0.7;
    this.node = new AudioWorkletNode(this.ctx, "uniedd-clap-detector", { numberOfInputs: 1, numberOfOutputs: 1 });
    this.node.port.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type: string; t: number; level: number; rms: number; thr: number };
      if (msg.type === "onset") this.onClap?.(msg.t, msg.level);
      else if (msg.type === "level") this.onLevel?.(msg.rms, msg.thr);
    };
    // keep the worklet pulled by the graph without making any sound
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    src.connect(hp).connect(hp2).connect(this.node).connect(mute).connect(this.ctx.destination);
    return "on";
  }

  setSensitivity(sens: number) {
    this.node?.port.postMessage({ sens });
  }

  stopMic() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.node?.disconnect();
    this.node = null;
  }

  private track<T extends AudioScheduledSourceNode>(n: T) {
    this.scheduled.push(n);
    n.onended = () => {
      this.scheduled = this.scheduled.filter((x) => x !== n);
    };
    return n;
  }

  stopAll() {
    for (const n of this.scheduled) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.scheduled = [];
  }

  /** Wood-block style click — a low sine so the clap detector ignores it. */
  click(at: number, accent = false, vol = 0.5) {
    const o = this.track(this.ctx.createOscillator());
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(accent ? 880 : 660, at);
    o.frequency.exponentialRampToValueAtTime(accent ? 600 : 440, at + 0.06);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol * (accent ? 0.5 : 0.32), at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 0.1);
  }

  /** Synth hand clap (noise burst). Loud & bright — mic users should wear headphones. */
  clap(at: number, vol = 0.35) {
    for (const [dt, v] of [[0, 0.6], [0.011, 0.8], [0.022, 1]] as const) {
      const s = this.track(this.ctx.createBufferSource());
      s.buffer = this.noise;
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1300;
      bp.Q.value = 1.2;
      const g = this.ctx.createGain();
      const t = at + dt;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * v, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dt === 0.022 ? 0.14 : 0.02));
      s.connect(bp).connect(g).connect(this.master);
      s.start(t);
      s.stop(t + 0.2);
    }
  }

  /** Bell-ish melody voice (soft attack keeps it out of the clap detector). */
  tone(midi: number, at: number, dur: number, vol = 0.16) {
    const f = midiFreq(midi);
    const end = at + Math.max(0.12, dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.018);
    g.gain.exponentialRampToValueAtTime(vol * 0.45, at + Math.min(0.25, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.12);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    g.connect(lp).connect(this.musicBus);
    for (const [type, mult, v] of [["triangle", 1, 1], ["sine", 2, 0.25]] as const) {
      const o = this.track(this.ctx.createOscillator());
      o.type = type;
      o.frequency.value = f * mult;
      const og = this.ctx.createGain();
      og.gain.value = v;
      o.connect(og).connect(g);
      o.start(at);
      o.stop(end + 0.15);
    }
  }

  pad(midis: number[], at: number, dur: number, vol = 0.035) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.08);
    g.gain.setValueAtTime(vol, at + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1100;
    g.connect(lp).connect(this.musicBus);
    for (const m of midis) {
      const o = this.track(this.ctx.createOscillator());
      o.type = "sawtooth";
      o.frequency.value = midiFreq(m + 12);
      o.detune.value = (Math.random() - 0.5) * 10;
      o.connect(g);
      o.start(at);
      o.stop(at + dur + 0.05);
    }
    // bass on the root
    const b = this.track(this.ctx.createOscillator());
    const bg = this.ctx.createGain();
    b.type = "sine";
    b.frequency.value = midiFreq(midis[0] - 12);
    bg.gain.setValueAtTime(0.0001, at);
    bg.gain.exponentialRampToValueAtTime(vol * 4, at + 0.02);
    bg.gain.exponentialRampToValueAtTime(0.0001, at + Math.min(dur, 1.2));
    b.connect(bg).connect(this.musicBus);
    b.start(at);
    b.stop(at + dur + 0.05);
  }

  /**
   * Schedule a synth performance of the song. `start` = context time of beat 0,
   * `rate` = speed (1 = original tempo). Returns nothing; use stopAll() to cut.
   */
  scheduleSong(
    song: ClapSong,
    start: number,
    rate: number,
    opts: { melody: boolean; backing: boolean; metronome: boolean; guideClaps: boolean },
  ) {
    const spb = 60 / song.bpm / rate;
    if (opts.melody) {
      for (const n of song.notes) if (n.midi !== undefined) this.tone(n.midi, start + n.beat * spb, n.len * spb * 0.92);
    }
    if (opts.guideClaps) for (const n of clapNotes(song)) this.clap(start + n.beat * spb, 0.22);
    const bars = Math.ceil(song.lengthBeats / song.beatsPerBar);
    if (opts.backing && song.chords) {
      for (let bar = 0; bar < bars; bar++) {
        const parts = (song.chords[bar] || "").split(/\s+/).filter(Boolean);
        parts.forEach((name, i) => {
          const midis = chordMidis(name);
          if (!midis) return;
          const len = song.beatsPerBar / parts.length;
          this.pad(midis, start + (bar * song.beatsPerBar + i * len) * spb, len * spb);
        });
      }
    }
    if (opts.metronome) {
      for (let b = 0; b < song.lengthBeats; b++) this.click(start + b * spb, b % song.beatsPerBar === 0, 0.35);
    }
  }

  close() {
    this.stopAll();
    this.stopMic();
    void this.ctx.close();
  }
}
