// Small synthesized board sounds (no audio files).
let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function knock(freq: number, gain: number, dur: number, delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * dur * 0.18));
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 3;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t);
}

function tone(freq: number, delay: number, dur = 0.16, gain = 0.12) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sounds = {
  move: () => knock(1400, 1.6, 0.06),
  capture: () => {
    knock(900, 2.2, 0.08);
    knock(1600, 1.2, 0.05, 0.03);
  },
  check: () => {
    knock(1400, 1.6, 0.06);
    tone(880, 0.02, 0.12, 0.06);
  },
  correct: () => {
    tone(660, 0, 0.12);
    tone(990, 0.09, 0.2);
  },
  wrong: () => {
    tone(330, 0, 0.18, 0.1);
    tone(247, 0.12, 0.25, 0.1);
  },
  solved: () => {
    tone(523, 0, 0.14);
    tone(659, 0.1, 0.14);
    tone(784, 0.2, 0.28);
  },
};

export function moveSound(san: string, captured: boolean) {
  if (san.includes("+") || san.includes("#")) sounds.check();
  else if (captured) sounds.capture();
  else sounds.move();
}
