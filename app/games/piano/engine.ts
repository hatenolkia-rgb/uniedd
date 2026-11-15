/**
 * Audio engine for Piano Falling Notes. It builds on the Clap Rhythm engine, so the game
 * shares its "heard clock" (audio clock minus output latency, smoothed), its lookahead
 * scheduler and its mic-latency correction. Added here:
 * - a soft piano-like synth with held voices (for MIDI, keys and taps)
 * - an unpitched metronome tick (so the mic's pitch detector ignores it)
 * - a microphone listener: an AudioWorklet finds note onsets sample-accurately and hands
 *   ~50 ms of audio after each onset to a YIN pitch detector on the main thread.
 */

import { ClapEngine, type MicStatus } from "../clap/engine";
import { freqToMidi, midiToFreq, yin } from "./pitch";

const WORKLET = `
class PianoListener extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const p = (options && options.processorOptions) || {};
    this.need = p.need || 2400;            // samples handed to the pitch detector
    this.skip = p.skip || 480;             // skip the hammer noise right after the onset
    this.N = 16384;
    this.ring = new Float32Array(this.N);
    this.w = 0;
    this.fast = 0;
    this.slow = 0;
    this.floor = 0.003;
    this.rel = Math.exp(-1 / (0.012 * sampleRate));
    this.slowK = 1 - Math.exp(-1 / (0.04 * sampleRate));
    this.sens = 0.6;
    this.debounce = 0.07 * sampleRate;
    this.lastOnset = -1e12;
    this.pending = [];
    this.n = 0;
    this.peak = 0;
    this.sinceFrame = 0;
    this.port.onmessage = (e) => {
      if (typeof e.data.sens === "number") this.sens = e.data.sens;
    };
  }
  grab(start) {
    const out = new Float32Array(this.need);
    const mask = this.N - 1;
    for (let k = 0; k < this.need; k++) out[k] = this.ring[(start + k) & mask];
    return out;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    const s = this.sens;
    const ratio = 2.2 + (1 - s) * 6;
    const absMin = 0.006 + (1 - s) * 0.04;
    const thr = Math.max(this.floor * ratio, absMin);
    const mask = this.N - 1;
    let fast = this.fast;
    let slow = this.slow;
    let blockPeak = 0;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      this.ring[this.w & mask] = x;
      this.w++;
      const a = x < 0 ? -x : x;
      if (a > blockPeak) blockPeak = a;
      fast = a > fast ? a : fast * this.rel;
      const f = currentFrame + i;
      // a new key strike = a sudden RISE well above the lagging envelope (a ringing note decays)
      if (fast > thr && fast > slow * 1.6 && f - this.lastOnset > this.debounce) {
        this.lastOnset = f;
        this.pending.push({ frame: f, start: this.w + this.skip });
      }
      slow += (fast - slow) * this.slowK;
    }
    this.fast = fast;
    this.slow = slow;
    while (this.pending.length && this.w >= this.pending[0].start + this.need) {
      const p = this.pending.shift();
      const samples = this.grab(p.start);
      this.port.postMessage({ type: "onset", frame: p.frame, level: fast, samples }, [samples.buffer]);
    }
    this.sinceFrame += ch.length;
    if (this.sinceFrame >= 2048) {
      this.sinceFrame = 0;
      if (fast > thr * 0.5) {
        const samples = this.grab(this.w - this.need);
        this.port.postMessage({ type: "frame", samples }, [samples.buffer]);
      } else this.port.postMessage({ type: "frame", samples: null });
    }
    const quiet = currentFrame - this.lastOnset > 0.4 * sampleRate;
    if (quiet || blockPeak < this.floor) {
      const k = blockPeak > this.floor ? 0.01 : 0.05;
      this.floor = Math.max(0.0008, this.floor + (blockPeak - this.floor) * k);
    }
    this.peak = Math.max(this.peak, blockPeak);
    if (++this.n >= 8) {
      this.port.postMessage({ type: "level", rms: this.peak, thr });
      this.n = 0;
      this.peak = 0;
    }
    return true;
  }
}
registerProcessor("uniedd-piano-listener-v1", PianoListener);
`;

export type HeardNote = { heard: number; midi: number; cents: number; clarity: number; freq: number };

/** Freeze an envelope at time t (keeping the in-progress ramp's value) so a release can start there. */
function holdAt(p: AudioParam, t: number) {
  const q = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
  if (q.cancelAndHoldAtTime) q.cancelAndHoldAtTime(t);
  else p.cancelScheduledValues(t);
}

type Voice = { gain: GainNode; oscs: OscillatorNode[] };

export class PianoEngine extends ClapEngine {
  /** A note the mic heard: onset time on the heard clock + detected pitch. */
  onNote: ((n: HeardNote) => void) | null = null;
  /** Continuous "what is ringing now" (null = silence / unclear), for the display. */
  onHearing: ((midi: number | null) => void) | null = null;
  onMicLevel: ((peak: number, thr: number) => void) | null = null;
  private pStream: MediaStream | null = null;
  private pNode: AudioWorkletNode | null = null;
  private pReady = false;
  private voices = new Map<number, Voice>();
  private tickNoise: AudioBuffer;
  private pianoBus: GainNode;

  constructor() {
    super();
    this.tickNoise = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.05), this.ctx.sampleRate);
    const d = this.tickNoise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.pianoBus = this.ctx.createGain();
    this.pianoBus.gain.value = 1;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.pianoBus.connect(comp).connect(this.master);
  }

  get pianoMicOn() {
    return !!this.pStream;
  }

  private buildVoice(midi: number, at: number, vel: number): Voice {
    const f = midiToFreq(midi);
    const peak = 0.07 + 0.16 * Math.max(0.05, Math.min(1, vel));
    const decay = Math.max(0.7, Math.min(4, 3.2 - (midi - 60) * 0.045));
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(peak * 0.35, at + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0002, at + decay);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(16000, f * 8), at);
    lp.frequency.exponentialRampToValueAtTime(Math.min(12000, f * 3), at + 0.6);
    gain.connect(lp).connect(this.pianoBus);
    const oscs: OscillatorNode[] = [];
    const partials: [number, number][] = [[1, 1], [2, 0.5], [3, 0.22], [4, 0.12], [5, 0.06], [6, 0.03]];
    for (const [h, amp] of partials) {
      if (f * h > 15000) break;
      const o = this.track(this.ctx.createOscillator());
      o.type = "sine";
      // a hint of piano-string stretch on the upper partials
      o.frequency.value = f * h * (1 + 0.0004 * h * h);
      const og = this.ctx.createGain();
      og.gain.value = amp / (1 + (midi > 72 ? (midi - 72) * 0.02 * h : 0));
      o.connect(og).connect(gain);
      o.start(at);
      o.stop(at + decay + 0.1);
      oscs.push(o);
    }
    return { gain, oscs };
  }

  /** A scheduled note with a known length (demo, accompaniment, guide melody). */
  pianoNote(midi: number, at: number, dur: number, vel = 0.7) {
    const v = this.buildVoice(midi, at, vel);
    const end = at + Math.max(0.08, dur);
    holdAt(v.gain.gain, end);
    v.gain.gain.setTargetAtTime(0.0001, end, 0.07);
    for (const o of v.oscs) {
      try {
        o.stop(end + 0.5);
      } catch {
        /* ignore */
      }
    }
  }

  /** Start a held note now (MIDI note-on, key press, tap). */
  noteOn(midi: number, vel = 0.8) {
    this.noteOff(midi);
    this.voices.set(midi, this.buildVoice(midi, this.ctx.currentTime, vel));
  }

  noteOff(midi: number) {
    const v = this.voices.get(midi);
    if (!v) return;
    this.voices.delete(midi);
    const t = this.ctx.currentTime;
    holdAt(v.gain.gain, t);
    v.gain.gain.setTargetAtTime(0.0001, t, 0.08);
    for (const o of v.oscs) {
      try {
        o.stop(t + 0.6);
      } catch {
        /* ignore */
      }
    }
  }

  allNotesOff() {
    for (const m of [...this.voices.keys()]) this.noteOff(m);
  }

  /** Unpitched wood-block tick (band-passed noise), so the mic's pitch detector ignores it. */
  tick(at: number, accent = false, vol = 0.5) {
    const s = this.track(this.ctx.createBufferSource());
    s.buffer = this.tickNoise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = accent ? 2600 : 2000;
    bp.Q.value = 1.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol * (accent ? 1 : 0.6), at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
    s.connect(bp).connect(g).connect(this.master);
    s.start(at);
    s.stop(at + 0.05);
  }

  async startPianoMic(): Promise<MicStatus> {
    if (this.pStream) return "on";
    if (!navigator.mediaDevices?.getUserMedia || !this.ctx.audioWorklet) return "unsupported";
    try {
      // Raw mic like the clap game: no echo cancellation / noise suppression / AGC.
      this.pStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0 } as MediaTrackConstraints,
      });
    } catch {
      return "denied";
    }
    await this.resume();
    if (!this.pReady) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.pReady = true;
    }
    const settings = this.pStream.getAudioTracks()[0]?.getSettings() as MediaTrackSettings & { latency?: number };
    const lat = Number(settings?.latency);
    this.inputLatency = Number.isFinite(lat) && lat > 0 && lat < 0.5 ? lat : 0;
    const sr = this.ctx.sampleRate;
    const src = this.ctx.createMediaStreamSource(this.pStream);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 50; // drop rumble and hum, keep the piano's lowest notes we chart
    this.pNode = new AudioWorkletNode(this.ctx, "uniedd-piano-listener-v1", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      processorOptions: { need: Math.round(sr * 0.05), skip: Math.round(sr * 0.01) },
    });
    let lastHearing: number | null = null;
    this.pNode.port.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type: string; frame: number; level: number; samples: Float32Array | null; rms: number; thr: number };
      if (msg.type === "onset" && msg.samples) {
        const p = yin(msg.samples, sr, { minFreq: 60, maxFreq: 2200, threshold: 0.15 });
        if (!p || p.clarity < 0.75) return;
        const { midi, cents } = freqToMidi(p.freq);
        this.onNote?.({ heard: this.micFrameToHeard(msg.frame / sr), midi, cents, clarity: p.clarity, freq: p.freq });
      } else if (msg.type === "frame") {
        let m: number | null = null;
        if (msg.samples) {
          const p = yin(msg.samples, sr, { minFreq: 60, maxFreq: 2200, threshold: 0.15 });
          if (p && p.clarity > 0.8) m = freqToMidi(p.freq).midi;
        }
        if (m !== lastHearing) {
          lastHearing = m;
          this.onHearing?.(m);
        }
      } else if (msg.type === "level") this.onMicLevel?.(msg.rms, msg.thr);
    };
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    src.connect(hp).connect(this.pNode).connect(mute).connect(this.ctx.destination);
    return "on";
  }

  setPianoSensitivity(sens: number) {
    this.pNode?.port.postMessage({ sens });
  }

  stopPianoMic() {
    this.pStream?.getTracks().forEach((t) => t.stop());
    this.pStream = null;
    this.pNode?.disconnect();
    this.pNode = null;
  }

  close() {
    this.allNotesOff();
    this.stopPianoMic();
    super.close();
  }
}
