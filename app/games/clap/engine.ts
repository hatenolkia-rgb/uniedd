/**
 * Audio engine for the Clap Rhythm trainer:
 * - one AudioContext for playback AND the microphone, so clap timestamps and
 *   the song share one clock
 * - an AudioWorklet clap detector (high-passed energy spike, adaptive noise
 *   floor, debounce) that reports sample-accurate onset times
 * - a tiny synth for the melody, chords, bass, metronome and guide claps
 */

import { beatToTime, chordMidis, type ClapSong } from "./songs";

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

  /** Output latency the browser reports (seconds): time from scheduling to the speaker. */
  get outputLatency() {
    const c = this.ctx as AudioContext & { outputLatency?: number };
    const v = c.outputLatency || c.baseLatency || 0;
    return Number.isFinite(v) ? Math.max(0, Math.min(0.5, v)) : 0;
  }

  // Smoothed "heard clock": ctx.currentTime - outputLatency, but ctx.currentTime only
  // moves in audio-callback steps, so we run it through a tiny phase-locked loop driven
  // by performance.now() for a jitter-free, drift-free value every animation frame.
  private est = 0;
  private estPerf = -1;
  private lastRaw = -1;
  private step = 0;
  private lat = -1;

  private updateClock(nowPerf: number) {
    const cur = this.ctx.currentTime;
    if (this.lastRaw >= 0 && cur > this.lastRaw) {
      const jump = cur - this.lastRaw;
      if (jump < 0.05) this.step = this.step ? this.step * 0.9 + jump * 0.1 : jump;
    }
    // outputLatency can wobble from callback to callback; follow it slowly so markers never jump
    const L = this.outputLatency;
    this.lat = this.lat < 0 || Math.abs(L - this.lat) > 0.1 ? L : this.lat + (L - this.lat) * 0.02;
    // Fallback: currentTime marks the end of the block just handed to the device, so the
    // sample at the speaker right now is ~half a callback behind it, minus output latency.
    let raw = cur - this.step / 2 - this.lat;
    // Preferred: the browser's own (context time, performance time) pair for the sample
    // reaching the output right now — already includes the device/OS latency.
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime && ts.performanceTime) {
      const viaTs = ts.contextTime + (nowPerf - ts.performanceTime) / 1000;
      if (Math.abs(viaTs - raw) < 0.15) raw = viaTs;
    }
    this.lastRaw = cur;
    if (this.ctx.state !== "running" || this.estPerf < 0) {
      this.est = raw;
    } else {
      const pred = this.est + (nowPerf - this.estPerf) / 1000;
      const err = raw - pred;
      this.est = Math.abs(err) > 0.04 ? raw : pred + err * 0.06;
    }
    this.estPerf = nowPerf;
  }

  /**
   * Context time of the sound reaching the listener's ears at performance time `perfT`
   * (= ctx.currentTime - outputLatency, smoothed). Visuals and input judging use this.
   */
  heardAt(perfT = performance.now()) {
    const nowPerf = performance.now();
    if (nowPerf - this.estPerf > 1 || this.estPerf < 0) this.updateClock(nowPerf);
    return this.est - (nowPerf - perfT) / 1000;
  }

  /** Back-compat alias. */
  heardNow(perfNow = performance.now()) {
    return this.heardAt(perfNow);
  }

  /** Convert an event timestamp (performance.now domain) to heard context time. */
  eventToCtx(eventTimeStamp: number) {
    return this.heardAt(eventTimeStamp);
  }

  // ---------- decoded audio files ----------
  private buffers = new Map<string, Promise<AudioBuffer>>();

  /** Fetch + decode an audio file once into an AudioBuffer (sample-exact playback). */
  loadBuffer(url: string) {
    let p = this.buffers.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((ab) => this.ctx.decodeAudioData(ab));
      p.catch(() => this.buffers.delete(url));
      this.buffers.set(url, p);
    }
    return p;
  }

  /**
   * Play `buffer` so that buffer position `offset` sounds at context time `when`,
   * at `rate` (pitch follows the rate, which keeps it locked to the audio clock).
   */
  playBuffer(buffer: AudioBuffer, when: number, offset: number, rate: number, vol = 0.95) {
    const src = this.track(this.ctx.createBufferSource());
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.master);
    src.start(when, Math.max(0, offset));
    return src;
  }

  // ---------- lookahead scheduler ----------
  private timer: number | null = null;

  /**
   * Schedule `events` (each with an exact context time) a little ahead of the audio
   * clock, Web-Audio style: a JS timer wakes every 25 ms and queues anything due in
   * the next ~500 ms with sample-accurate start times.
   */
  runSchedule(events: { at: number; play: (at: number) => void }[]) {
    this.stopSchedule();
    const list = [...events].sort((a, b) => a.at - b.at);
    let i = 0;
    const pump = () => {
      if (this.ctx.state !== "running") return;
      const ahead = typeof document !== "undefined" && document.hidden ? 1.5 : 0.5;
      const horizon = this.ctx.currentTime + ahead;
      while (i < list.length && list[i].at < horizon) {
        const ev = list[i++];
        if (ev.at < this.ctx.currentTime - 0.03) continue; // too late, skip rather than smear
        ev.play(Math.max(ev.at, this.ctx.currentTime));
      }
      if (i >= list.length) this.stopSchedule();
    };
    pump();
    this.timer = window.setInterval(pump, 25);
  }

  stopSchedule() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
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
    this.stopSchedule();
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

  /** Guide click: a short, crisp tick exactly on a marker time. */
  guideClick(at: number, vol = 0.5) {
    const o = this.track(this.ctx.createOscillator());
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(1250, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol * 0.5, at + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 0.06);
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
   * Build the timed sound events for a play-through. Every time is in SONG seconds and
   * converted with `toCtx` — the same mapping the markers use — so sound and visuals
   * share one clock. `guideTimes` are the marker times (one click per marker).
   */
  songEvents(
    song: ClapSong,
    toCtx: (songT: number) => number,
    rate: number,
    opts: { melody: boolean; backing: boolean; metronome: boolean; guideTimes: number[] | null },
  ) {
    const out: { at: number; play: (at: number) => void }[] = [];
    const spb = 60 / song.bpm; // song seconds per beat
    const bt = (beat: number) => beatToTime(song, beat);
    if (opts.melody && !song.audio) {
      for (const n of song.notes) {
        if (n.midi === undefined) continue;
        const midi = n.midi;
        const dur = (n.len * spb * 0.92) / rate;
        out.push({ at: toCtx(bt(n.beat)), play: (at) => this.tone(midi, at, dur) });
      }
    }
    if (opts.backing && !song.audio && song.chords) {
      const bars = Math.ceil(song.lengthBeats / song.beatsPerBar);
      for (let bar = 0; bar < bars; bar++) {
        const parts = (song.chords[bar] || "").split(/\s+/).filter(Boolean);
        parts.forEach((name, i) => {
          const midis = chordMidis(name);
          if (!midis) return;
          const len = song.beatsPerBar / parts.length;
          const beat = bar * song.beatsPerBar + i * len;
          out.push({ at: toCtx(bt(beat)), play: (at) => this.pad(midis, at, (len * spb) / rate) });
        });
      }
    }
    if (opts.metronome) {
      const beats =
        song.beatTimes && song.beatTimes.length > 1
          ? song.beatTimes.filter((t) => t >= (song.offset ?? 0) - 0.01)
          : Array.from({ length: Math.ceil(song.lengthBeats) }, (_, b) => bt(b));
      beats.forEach((t, b) => out.push({ at: toCtx(t), play: (at) => this.click(at, b % song.beatsPerBar === 0, 0.35) }));
    }
    if (opts.guideTimes) for (const t of opts.guideTimes) out.push({ at: toCtx(t), play: (at) => this.guideClick(at) });
    return out;
  }

  close() {
    this.stopAll();
    this.stopMic();
    void this.ctx.close();
  }
}
