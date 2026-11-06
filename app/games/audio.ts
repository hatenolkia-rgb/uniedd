import { midiToFreq } from "./theory";

let ctx: AudioContext | null = null;

export function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function playTone(
  freq: number,
  duration = 0.45,
  type: OscillatorType = "triangle",
  gain = 0.12,
  when = 0,
) {
  const audio = getAudioContext();
  if (!audio) return;
  const t = audio.currentTime + when;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function playMidi(midi: number, duration = 0.45, type: OscillatorType = "triangle") {
  playTone(midiToFreq(midi), duration, type);
}

export function playChordMidi(midis: number[], duration = 0.8) {
  midis.forEach((m, i) => playTone(midiToFreq(m), duration, i % 2 ? "triangle" : "sine", 0.08));
}

export function playClick(accent = false) {
  playTone(accent ? 1400 : 900, 0.07, "square", accent ? 0.1 : 0.06);
}

export function playSuccess() {
  playTone(523.25, 0.12, "sine", 0.1);
  playTone(659.25, 0.16, "sine", 0.08, 0.1);
  playTone(783.99, 0.22, "sine", 0.08, 0.2);
}

export function playMiss() {
  playTone(196, 0.2, "sawtooth", 0.05);
}

export function playSequence(midis: number[], gap = 0.38) {
  midis.forEach((midi, i) => {
    const audio = getAudioContext();
    if (!audio) return;
    playTone(midiToFreq(midi), gap * 0.85, "triangle", 0.12, i * gap);
  });
  return midis.length * gap * 1000;
}
