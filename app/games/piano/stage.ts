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
  /** length in quarter beats (for hollow half-note heads on the staff) */
  len: number;
  /** the other hand in Treble/Bass Clef mode: not drawn at all (one clean lane of notes) */
  hidden?: boolean;
};

export type Popup = { text: string; color: string; x: number; born: number };
export type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export type KeyLight = { color: string; until: number };

export type Clef = "treble" | "bass" | "beast";

export type StaffInfo = {
  show: boolean;
  clef: Clef;
  /** bar lines, song seconds */
  barTimes: number[];
  /** diatonic range of the song (see diatonic()) */
  minD: number;
  maxD: number;
};

/** Diatonic step number (C4 = 28, E4 = 30, A3 = 26) and whether the note is spelled with a sharp. */
export function diatonic(midi: number): { d: number; sharp: boolean } {
  const pc = ((midi % 12) + 12) % 12;
  const LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];
  return { d: (Math.floor(midi / 12) - 1) * 7 + LETTER[pc], sharp: SHARP[pc] };
}

/** Geometry of the grand staff strip under the HUD (null when hidden). */
export function staffGeom(W: number, H: number, kbH: number, st: StaffInfo | null) {
  if (!st || !st.show) return null;
  const top = W < 600 ? 48 : 56;
  const dTop = Math.max(38, st.maxD) + 2;
  const dBot = Math.min(18, st.minD) - 2;
  const avail = H - kbH - top;
  const sp = Math.max(2.2, Math.min(5.5, (avail * 0.36) / (dTop - dBot)));
  const height = (dTop - dBot) * sp;
  return { top, height, bottom: top + height, sp, dTop, dBot, y: (d: number) => top + (dTop - d) * sp };
}

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
  staff: StaffInfo | null;
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

export function layout(width: number, height: number, lo: number, hi: number, staff: StaffInfo | null = null): Layout {
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
  const sg = staffGeom(width, height, kbH, staff);
  return { whiteW, kbTop, kbH, blackW, blackH, hitY: kbTop - 4, topPad: sg ? sg.bottom + 10 : 64, x };
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
  const l = layout(W, H, s.lo, s.hi, s.staff);
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
    if (n.hidden) continue;
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
    g.rect(0, l.topPad - 6, W, l.hitY - l.topPad + 6);
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
  const scoreText = hud.score.toLocaleString() + (hud.accuracy !== null ? `  ·  ${Math.round(hud.accuracy * 100)}%` : "");
  g.fillText(scoreText, 14, 12);
  // the title and combo sit between the score and the buttons (top right, about 290px wide on wide screens)
  const roomL = 14 + g.measureText(scoreText).width + 20;
  const roomR = W - (W < 640 ? 150 : 300);
  const midX = Math.max(roomL + 40, Math.min(W / 2, (roomL + roomR) / 2));
  const roomW = Math.max(60, Math.min(W * 0.4, 2 * Math.min(midX - roomL, roomR - midX)));
  g.font = `600 ${W < 600 ? 11 : 13}px system-ui, sans-serif`;
  g.fillStyle = "rgba(255,255,255,0.65)";
  g.fillText(hud.sub + (hud.hearing !== null ? `  ·  🎤 ${hud.hearing}` : ""), 14, W < 600 ? 32 : 38);
  g.textAlign = "center";
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.font = `700 ${W < 600 ? 12 : 15}px system-ui, sans-serif`;
  // narrow portrait phones: the buttons need the space, so the title is left out
  if (W >= 500) {
    let title = hud.title;
    while (title.length > 4 && g.measureText(title).width > roomW) title = title.slice(0, -2).trimEnd() + "…";
    if (title !== hud.title) title = title.replace(/…+$/, "…");
    g.fillText(title, midX, 12);
  }
  if (hud.combo >= 2) {
    g.fillStyle = "#f472b6";
    g.font = `800 ${W < 600 ? 14 : 18}px system-ui, sans-serif`;
    g.fillText(`${hud.combo} combo`, W < 500 ? W * 0.44 : midX, W < 500 ? 14 : W < 600 ? 28 : 32);
  }
  drawStaff(g, s, l);
  if (hud.countIn !== null) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.font = `900 ${Math.min(120, H / 4)}px system-ui, sans-serif`;
    g.fillText(String(hud.countIn), W / 2, (l.topPad + l.hitY) / 2);
  }
  if (hud.banner) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `800 ${W < 600 ? 16 : 22}px system-ui, sans-serif`;
    const tw = g.measureText(hud.banner).width + 36;
    g.fillStyle = "rgba(124,58,237,0.85)";
    const by = l.topPad + (l.hitY - l.topPad) * 0.35;
    roundRect(g, W / 2 - tw / 2, by - 22, tw, 44, 22);
    g.fill();
    g.fillStyle = "#fff";
    g.fillText(hud.banner, W / 2, by);
  }
  g.restore();
}

const STAFF_WINDOW = 4.2; // real seconds of music shown on the staff

function drawStaff(g: CanvasRenderingContext2D, s: StageState, l: Layout) {
  const st = s.staff;
  const sg = staffGeom(s.width, s.height, l.kbH, st);
  if (!st || !sg) return;
  const W = s.width;
  const x0 = 8;
  const x1 = W - 8;
  const clefW = Math.max(46, sg.sp * 12);
  const nowX = x0 + clefW + sg.sp * 3;
  const pxPerSec = (x1 - nowX - 10) / STAFF_WINDOW;
  g.fillStyle = "rgba(18,14,44,0.92)";
  roundRect(g, x0, sg.top - 4, x1 - x0, sg.height + 8, 10);
  g.fill();
  const trebleOn = st.clef !== "bass";
  const bassOn = st.clef !== "treble";
  // the active clef is highlighted
  const band = (dHi: number, dLo: number, on: boolean) => {
    if (!on) return;
    g.fillStyle = "rgba(250,204,21,0.12)";
    roundRect(g, x0 + 2, sg.y(dHi) - sg.sp * 2, x1 - x0 - 4, sg.y(dLo) - sg.y(dHi) + sg.sp * 4, 8);
    g.fill();
  };
  band(38, 30, trebleOn);
  band(26, 18, bassOn);
  for (const [lines, on] of [
    [[30, 32, 34, 36, 38], trebleOn],
    [[18, 20, 22, 24, 26], bassOn],
  ] as const) {
    g.strokeStyle = on ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.28)";
    g.lineWidth = 1;
    for (const d of lines) {
      const y = Math.round(sg.y(d)) + 0.5;
      g.beginPath();
      g.moveTo(x0 + 6, y);
      g.lineTo(x1 - 6, y);
      g.stroke();
    }
  }
  g.strokeStyle = "rgba(255,255,255,0.6)";
  g.beginPath();
  g.moveTo(x0 + 6.5, sg.y(38));
  g.lineTo(x0 + 6.5, sg.y(18));
  g.stroke();
  // clef signs (music-font glyphs) plus their names in plain text
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  const glyphFont = "'Noto Music','Segoe UI Symbol','Apple Symbols',serif";
  g.fillStyle = trebleOn ? "#facc15" : "rgba(255,255,255,0.4)";
  g.font = `${sg.sp * 9.5}px ${glyphFont}`;
  g.fillText("\u{1D11E}", x0 + 10, sg.y(32) + sg.sp * 2.6);
  g.fillStyle = bassOn ? "#fb923c" : "rgba(255,255,255,0.4)";
  g.font = `${sg.sp * 7.4}px ${glyphFont}`;
  g.fillText("\u{1D122}", x0 + 12, sg.y(24) + sg.sp * 3.4);
  g.font = `700 ${Math.max(9, sg.sp * 2)}px system-ui, sans-serif`;
  g.fillStyle = trebleOn ? "#fde68a" : "rgba(255,255,255,0.4)";
  g.fillText("Treble", x0 + clefW * 0.5, sg.y(39) + 1);
  g.fillStyle = bassOn ? "#fed7aa" : "rgba(255,255,255,0.4)";
  g.fillText("Bass", x0 + clefW * 0.5, sg.y(17) + sg.sp * 2 + 2);
  // "now" line: notes slide left into it as they reach the keyboard
  g.fillStyle = "rgba(250,204,21,0.8)";
  g.fillRect(nowX - 1, sg.y(sg.dTop - 1), 2, sg.y(sg.dBot + 1) - sg.y(sg.dTop - 1));
  g.save();
  g.beginPath();
  g.rect(nowX - sg.sp * 3, sg.top - 4, x1 - nowX + sg.sp * 3, sg.height + 8);
  g.clip();
  const xAt = (t: number) => nowX + ((t - s.songT) / s.rate) * pxPerSec;
  g.fillStyle = "rgba(255,255,255,0.35)";
  for (const bt of st.barTimes) {
    const x = xAt(bt);
    if (x < nowX - 2 || x > x1) continue;
    g.fillRect(x, sg.y(38), 1, sg.y(30) - sg.y(38));
    g.fillRect(x, sg.y(26), 1, sg.y(18) - sg.y(26));
  }
  const rx = sg.sp * 1.25;
  const ry = sg.sp * 0.95;
  for (const n of s.notes) {
    if (n.hidden) continue;
    const x = xAt(n.t);
    if (x > x1 + rx) break;
    if (x < nowX - sg.sp * 3 || (n.state !== "pending" && x < nowX - 2)) continue;
    const { d, sharp } = diatonic(n.midi);
    const y = sg.y(d);
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 1;
    const ledgers: number[] = [];
    if (d === 28) ledgers.push(28);
    for (let L = 40; L <= d; L += 2) ledgers.push(L);
    for (let L = 16; L >= d; L -= 2) ledgers.push(L);
    for (const L of ledgers) {
      const ly = Math.round(sg.y(L)) + 0.5;
      g.beginPath();
      g.moveTo(x - rx * 1.7, ly);
      g.lineTo(x + rx * 1.7, ly);
      g.stroke();
    }
    const base = n.hand === "R" ? "#38bdf8" : "#fb923c";
    const color = n.state === "perfect" || n.state === "good" ? "#facc15" : n.state === "miss" ? "#64748b" : base;
    g.globalAlpha = n.scored ? 1 : 0.4;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x, y, rx, ry, -0.35, 0, Math.PI * 2);
    g.fill();
    if (n.len >= 2) {
      // half notes and longer are hollow, like printed music
      g.fillStyle = "#1a1640";
      g.beginPath();
      g.ellipse(x, y, rx * 0.55, ry * 0.45, -0.35, 0, Math.PI * 2);
      g.fill();
    }
    if (sharp) {
      g.fillStyle = color;
      g.font = `700 ${sg.sp * 3}px system-ui, sans-serif`;
      g.textAlign = "right";
      g.textBaseline = "middle";
      g.fillText("♯", x - rx - 1, y);
    }
    g.globalAlpha = 1;
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
