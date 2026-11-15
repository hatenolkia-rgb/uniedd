/** Canvas drawing for Piano Falling Notes: the note highway and the on-screen keyboard. */

import { isBlack, midiLabel, SHARP_NAMES } from "./charts";

export type StageNote = {
  midi: number;
  t: number;
  dur: number;
  hand: "R" | "L";
  scored: boolean;
  state: "pending" | "perfect" | "good" | "miss";
  hitAt: number;
};

export type Popup = { text: string; color: string; x: number; born: number };
export type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export type KeyLight = { color: string; until: number };

export type StageState = {
  width: number;
  height: number;
  dpr: number;
  lo: number;
  hi: number;
  notes: StageNote[];
  songT: number;
  rate: number;
  now: number; // performance.now() seconds, for animations
  lookahead: number; // real seconds a note takes to fall to the line
  labels: "letters" | "sargam" | "off";
  tonic: number;
  pressed: Map<number, KeyLight>;
  guideKeys: Set<number>;
  keyHints: Map<number, string>;
  popups: Popup[];
  sparks: Spark[];
  hud: {
    title: string;
    score: number;
    combo: number;
    accuracy: number | null;
    progress: number;
    countIn: number | null;
    banner: string | null;
    hearing: string | null;
    sub: string;
  };
};

export type Layout = {
  whiteW: number;
  kbTop: number;
  kbH: number;
  blackW: number;
  blackH: number;
  hitY: number;
  topPad: number;
  x: (midi: number) => { x: number; w: number; black: boolean };
};

export function layout(width: number, height: number, lo: number, hi: number): Layout {
  let whites = 0;
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites++;
  const whiteW = width / Math.max(1, whites);
  const kbH = Math.max(70, Math.min(height * 0.26, whiteW * 5.2, 220));
  const kbTop = height - kbH;
  const blackW = whiteW * 0.6;
  const blackH = kbH * 0.62;
  const whiteIndex = new Map<number, number>();
  let wi = 0;
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whiteIndex.set(m, wi++);
  const x = (midi: number) => {
    if (!isBlack(midi)) return { x: (whiteIndex.get(midi) ?? 0) * whiteW, w: whiteW, black: false };
    const left = whiteIndex.get(midi - 1) ?? 0;
    return { x: (left + 1) * whiteW - blackW / 2, w: blackW, black: true };
  };
  return { whiteW, kbTop, kbH, blackW, blackH, hitY: kbTop - 4, topPad: 64, x };
}

/** Which key is under a point on the keyboard (black keys first), or null. */
export function keyAt(l: Layout, lo: number, hi: number, px: number, py: number): number | null {
  if (py < l.kbTop) return null;
  if (py < l.kbTop + l.blackH) {
    for (let m = lo; m <= hi; m++) {
      if (!isBlack(m)) continue;
      const k = l.x(m);
      if (px >= k.x && px <= k.x + k.w) return m;
    }
  }
  for (let m = lo; m <= hi; m++) {
    if (isBlack(m)) continue;
    const k = l.x(m);
    if (px >= k.x && px < k.x + k.w) return m;
  }
  return null;
}

const HAND_COLORS = {
  R: { white: ["#38bdf8", "#0ea5e9"], black: ["#0284c7", "#075985"] },
  L: { white: ["#fb923c", "#f97316"], black: ["#ea580c", "#9a3412"] },
};

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function draw(g: CanvasRenderingContext2D, s: StageState) {
  const { width: W, height: H } = s;
  const l = layout(W, H, s.lo, s.hi);
  g.save();
  g.scale(s.dpr, s.dpr);
  // background
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#05040f");
  bg.addColorStop(1, "#14103a");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // lanes: faint lines at every C and F, darker strips over black keys
  for (let m = s.lo; m <= s.hi; m++) {
    const k = l.x(m);
    if (k.black) {
      g.fillStyle = "rgba(255,255,255,0.025)";
      g.fillRect(k.x, 0, k.w, l.hitY);
    } else if (m % 12 === 0 || m % 12 === 5) {
      g.fillStyle = m % 12 === 0 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)";
      g.fillRect(k.x, 0, 1, l.hitY);
    }
  }

  // guide glow on the keys that should be played right now
  for (const m of s.guideKeys) {
    const k = l.x(m);
    const grad = g.createLinearGradient(0, l.hitY - 120, 0, l.hitY);
    grad.addColorStop(0, "rgba(250,204,21,0)");
    grad.addColorStop(1, "rgba(250,204,21,0.22)");
    g.fillStyle = grad;
    g.fillRect(k.x, l.hitY - 120, k.w, 120);
  }

  // falling notes
  const pxPerSec = (l.hitY - l.topPad) / s.lookahead;
  for (const n of s.notes) {
    const dtReal = (n.t - s.songT) / s.rate;
    const durReal = n.dur / s.rate;
    const yBottom = l.hitY - dtReal * pxPerSec;
    const h = Math.max(12, durReal * pxPerSec - 3);
    const yTop = yBottom - h;
    if (yTop > l.hitY + 4 && n.state !== "pending") continue;
    if (yBottom < -10 || yTop > H) continue;
    const k = l.x(n.midi);
    const pad = k.black ? 1 : Math.max(1.5, k.w * 0.08);
    const x = k.x + pad;
    const w = k.w - pad * 2;
    const pal = HAND_COLORS[n.hand][k.black ? "black" : "white"];
    let alpha = n.scored ? 1 : 0.38;
    if (n.state === "miss") alpha = 0.3;
    g.globalAlpha = alpha;
    // clip the part that has gone below the hit line
    g.save();
    g.beginPath();
    g.rect(0, 0, W, l.hitY);
    g.clip();
    const grad = g.createLinearGradient(x, yTop, x + w, yBottom);
    if (n.state === "miss") {
      grad.addColorStop(0, "#64748b");
      grad.addColorStop(1, "#334155");
    } else if (n.state === "perfect" || n.state === "good") {
      grad.addColorStop(0, n.state === "perfect" ? "#fde047" : "#67e8f9");
      grad.addColorStop(1, n.state === "perfect" ? "#f59e0b" : "#06b6d4");
    } else {
      grad.addColorStop(0, pal[0]);
      grad.addColorStop(1, pal[1]);
    }
    g.fillStyle = grad;
    roundRect(g, x, yTop, w, h, Math.min(8, w / 3));
    g.fill();
    if (n.scored && n.state === "pending") {
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.lineWidth = 1;
      g.stroke();
    }
    if (s.labels !== "off" && w >= 14 && h >= 16) {
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.font = `700 ${Math.max(9, Math.min(15, w * 0.42))}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "bottom";
      g.fillText(midiLabel(n.midi, s.labels, s.tonic), x + w / 2, yBottom - 3);
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // hit line
  const lineGrad = g.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0, "#22d3ee");
  lineGrad.addColorStop(0.5, "#facc15");
  lineGrad.addColorStop(1, "#f472b6");
  g.fillStyle = lineGrad;
  g.shadowColor = "#facc15";
  g.shadowBlur = 14;
  g.fillRect(0, l.hitY - 2, W, 4);
  g.shadowBlur = 0;

  // keyboard: whites, then blacks
  for (let m = s.lo; m <= s.hi; m++) {
    if (isBlack(m)) continue;
    const k = l.x(m);
    const lit = s.pressed.get(m);
    g.fillStyle = lit ? lit.color : s.guideKeys.has(m) ? "#fff7d6" : "#f8fafc";
    roundRect(g, k.x + 1, l.kbTop, k.w - 2, l.kbH - 2, 5);
    g.fill();
    g.fillStyle = "rgba(15,23,42,0.08)";
    g.fillRect(k.x + 1, l.kbTop, k.w - 2, 6);
    const hint = s.keyHints.get(m);
    const fs = Math.max(8, Math.min(13, k.w * 0.36));
    g.textAlign = "center";
    if (m % 12 === 0 && k.w >= 16) {
      g.fillStyle = "#64748b";
      g.font = `600 ${fs}px system-ui, sans-serif`;
      g.textBaseline = "bottom";
      g.fillText(`C${Math.floor(m / 12) - 1}`, k.x + k.w / 2, l.kbTop + l.kbH - 6);
    }
    if (hint && k.w >= 14) {
      g.fillStyle = "#7c3aed";
      g.font = `700 ${fs}px ui-monospace, monospace`;
      g.textBaseline = "bottom";
      g.fillText(hint, k.x + k.w / 2, l.kbTop + l.kbH - (m % 12 === 0 ? 8 + fs : 6));
    }
  }
  for (let m = s.lo; m <= s.hi; m++) {
    if (!isBlack(m)) continue;
    const k = l.x(m);
    const lit = s.pressed.get(m);
    const grad = g.createLinearGradient(0, l.kbTop, 0, l.kbTop + l.blackH);
    grad.addColorStop(0, lit ? lit.color : s.guideKeys.has(m) ? "#a16207" : "#1e293b");
    grad.addColorStop(1, lit ? lit.color : s.guideKeys.has(m) ? "#713f12" : "#0f172a");
    g.fillStyle = grad;
    roundRect(g, k.x, l.kbTop, k.w, l.blackH, 3);
    g.fill();
    const hint = s.keyHints.get(m);
    if (hint && k.w >= 12) {
      g.fillStyle = "#c4b5fd";
      g.font = `700 ${Math.max(8, Math.min(12, k.w * 0.5))}px ui-monospace, monospace`;
      g.textAlign = "center";
      g.textBaseline = "bottom";
      g.fillText(hint, k.x + k.w / 2, l.kbTop + l.blackH - 4);
    }
  }

  // sparks
  for (const p of s.sparks) {
    g.globalAlpha = Math.max(0, p.life);
    g.fillStyle = p.color;
    g.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  g.globalAlpha = 1;

  // judgement popups
  for (const p of s.popups) {
    const age = s.now - p.born;
    if (age > 0.7) continue;
    g.globalAlpha = 1 - age / 0.7;
    g.fillStyle = p.color;
    g.font = `800 ${Math.max(14, Math.min(22, W / 40))}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(p.text, Math.min(W - 50, Math.max(50, p.x)), l.hitY - 34 - age * 40);
  }
  g.globalAlpha = 1;

  // HUD
  const hud = s.hud;
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.fillRect(0, 0, W, 4);
  g.fillStyle = "#facc15";
  g.fillRect(0, 0, W * Math.max(0, Math.min(1, hud.progress)), 4);
  g.textBaseline = "top";
  g.textAlign = "left";
  g.fillStyle = "#fff";
  g.font = `800 ${W < 600 ? 18 : 24}px system-ui, sans-serif`;
  g.fillText(hud.score.toLocaleString(), 14, 14);
  g.font = `600 ${W < 600 ? 11 : 13}px system-ui, sans-serif`;
  g.fillStyle = "rgba(255,255,255,0.65)";
  g.fillText(hud.sub, 14, W < 600 ? 36 : 42);
  g.textAlign = "center";
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.font = `700 ${W < 600 ? 12 : 15}px system-ui, sans-serif`;
  g.fillText(hud.title, W / 2, 14);
  if (hud.combo >= 2) {
    g.fillStyle = "#f472b6";
    g.font = `800 ${W < 600 ? 14 : 18}px system-ui, sans-serif`;
    g.fillText(`${hud.combo} combo`, W / 2, W < 600 ? 32 : 36);
  }
  g.textAlign = "right";
  g.fillStyle = "#fff";
  g.font = `800 ${W < 600 ? 16 : 20}px system-ui, sans-serif`;
  if (hud.accuracy !== null) g.fillText(`${Math.round(hud.accuracy * 100)}%`, W - 14, 14);
  if (hud.hearing !== null) {
    g.font = `700 ${W < 600 ? 11 : 13}px system-ui, sans-serif`;
    g.fillStyle = "#86efac";
    g.fillText(`🎤 ${hud.hearing}`, W - 14, W < 600 ? 36 : 42);
  }
  if (hud.countIn !== null) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.font = `900 ${Math.min(120, H / 4)}px system-ui, sans-serif`;
    g.fillText(String(hud.countIn), W / 2, l.hitY / 2);
  }
  if (hud.banner) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `800 ${W < 600 ? 16 : 22}px system-ui, sans-serif`;
    const tw = g.measureText(hud.banner).width + 36;
    g.fillStyle = "rgba(124,58,237,0.85)";
    roundRect(g, W / 2 - tw / 2, l.hitY * 0.42 - 22, tw, 44, 22);
    g.fill();
    g.fillStyle = "#fff";
    g.fillText(hud.banner, W / 2, l.hitY * 0.42);
  }
  g.restore();
}

export function stepEffects(s: StageState, dt: number) {
  for (const p of s.sparks) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 600 * dt;
    p.life -= dt * 1.6;
  }
  s.sparks = s.sparks.filter((p) => p.life > 0);
  s.popups = s.popups.filter((p) => s.now - p.born < 0.7);
  for (const [m, k] of s.pressed) if (k.until > 0 && k.until < s.now) s.pressed.delete(m);
}

export function burst(s: StageState, x: number, y: number, color: string, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI - Math.PI;
    const v = 120 + Math.random() * 220;
    s.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
  }
}

export { SHARP_NAMES };
