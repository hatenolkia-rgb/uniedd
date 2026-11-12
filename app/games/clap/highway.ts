/** Canvas renderer for the Clap Rhythm highway. Pure drawing, no React. */

import type { ClapSong } from "./songs";

export type Judgement = "perfect" | "good" | "miss";

export type RunNote = {
  t: number; // song seconds
  end: number; // song seconds (tail end)
  lyric?: string;
  /** Lyric syllable continues the same word (no space before the next one). */
  joinNext?: boolean;
  /** Index of the lyric line this clap belongs to. */
  line: number;
  judged: Judgement | null;
  judgedAt: number; // performance.now()
};

export type Popup = { text: string; color: string; born: number; x: number; y: number; big?: boolean };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

export type DrawState = {
  song: ClapSong;
  notes: RunNote[];
  now: number; // song seconds being heard
  rate: number;
  firstBeatTime: number; // song seconds of beat 0
  countInStart: number; // song seconds where count-in starts
  score: number;
  combo: number;
  multiplier: number;
  accuracy: number | null;
  progress: number;
  pulse: number; // 0..1 hit-line flash
  pulseColor: string;
  popups: Popup[];
  particles: Particle[];
  practice: boolean;
  paused: boolean;
  micLevel: number; // 0..1
  inputLabel: string;
  /** Lyric lines: note indices per line (karaoke strip). */
  lines: number[][];
};

const LOOKAHEAD = 2.3; // real seconds of notes visible above the hit line
const PERSP = 2.6;

export function layout(w: number, h: number) {
  const horizonY = h * 0.1;
  const hitY = h * 0.8;
  const hitW = Math.min(w * 0.62, 380);
  const cx = w / 2;
  return { horizonY, hitY, hitW, cx };
}

/** Screen position for a time offset (song seconds) ahead of now. */
function project(dt: number, rate: number, w: number, h: number) {
  const { horizonY, hitY, hitW, cx } = layout(w, h);
  const z = dt / (LOOKAHEAD * rate);
  const s = 1 / (1 + PERSP * Math.max(z, -0.3));
  const sMin = 1 / (1 + PERSP);
  const f = (s - sMin) / (1 - sMin);
  return { y: horizonY + (hitY - horizonY) * f, scale: s, half: (hitW / 2) * (0.22 + 0.78 * f), cx, z };
}

export function hitPoint(w: number, h: number) {
  const { hitY, cx } = layout(w, h);
  return { x: cx, y: hitY };
}

export function spawnBurst(ps: Particle[], x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 5;
    ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 1, color, size: 2 + Math.random() * 3 });
  }
}

export function draw(ctx: CanvasRenderingContext2D, w: number, h: number, st: DrawState, perfNow: number) {
  const { song, rate, now } = st;
  const accent = song.accent;
  const spb = 60 / song.bpm;
  const { hitY, hitW, cx } = layout(w, h);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0b0820");
  bg.addColorStop(0.6, "#141038");
  bg.addColorStop(1, "#1c0f2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Beat pulse glow
  const beatPos = (now - st.firstBeatTime) / spb;
  const beatFrac = beatPos >= 0 ? beatPos - Math.floor(beatPos) : 1;
  const beatGlow = Math.max(0, 1 - beatFrac * 3);
  const rg = ctx.createRadialGradient(cx, hitY, 10, cx, hitY, Math.max(w, h) * 0.7);
  rg.addColorStop(0, hexA(accent, 0.18 + beatGlow * 0.12));
  rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);

  // Star dust drifting toward the player
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 40; i++) {
    const seed = (i * 9301 + 49297) % 233280;
    const x = (seed / 233280) * w;
    const y = ((i * 37 + now * 40 * (1 + (i % 3))) % h + h) % h;
    ctx.globalAlpha = 0.15 + (i % 5) * 0.08;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Highway surface
  const top = project(LOOKAHEAD * rate, rate, w, h);
  const bottomY = h;
  const bottomHalf = (hitW / 2) * 1.15;
  ctx.beginPath();
  ctx.moveTo(cx - top.half, top.y);
  ctx.lineTo(cx + top.half, top.y);
  ctx.lineTo(cx + bottomHalf, bottomY);
  ctx.lineTo(cx - bottomHalf, bottomY);
  ctx.closePath();
  const road = ctx.createLinearGradient(0, top.y, 0, bottomY);
  road.addColorStop(0, "rgba(40,30,90,0.25)");
  road.addColorStop(1, "rgba(60,40,120,0.75)");
  ctx.fillStyle = road;
  ctx.fill();

  // Rails
  for (const side of [-1, 1]) {
    const g = ctx.createLinearGradient(0, top.y, 0, bottomY);
    g.addColorStop(0, "rgba(26,159,212,0.1)");
    g.addColorStop(0.7, "#1a9fd4");
    g.addColorStop(1, "#e8962e");
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#1a9fd4";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx + side * top.half, top.y);
    ctx.lineTo(cx + side * bottomHalf, bottomY);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Beat and bar lines (exact beat times when the song has them, else from the tempo)
  const lines: { t: number; bar: boolean; barNo: number }[] = [];
  const winStart = now - 0.3 * rate;
  const winEnd = now + LOOKAHEAD * rate;
  if (song.beatTimes && song.beatTimes.length > 1) {
    const bt = song.beatTimes;
    let i0 = 0;
    for (let i = 1; i < bt.length; i++) if (Math.abs(bt[i] - st.firstBeatTime) < Math.abs(bt[i0] - st.firstBeatTime)) i0 = i;
    for (let i = 0; i < bt.length; i++) {
      if (bt[i] < winStart || bt[i] > winEnd) continue;
      const k = i - i0;
      const bar = ((k % song.beatsPerBar) + song.beatsPerBar) % song.beatsPerBar === 0;
      lines.push({ t: bt[i], bar, barNo: k >= 0 && bar ? k / song.beatsPerBar + 1 : 0 });
    }
  } else {
    const firstVisible = Math.ceil((winStart - st.firstBeatTime) / spb);
    const lastVisible = Math.floor((winEnd - st.firstBeatTime) / spb);
    for (let b = Math.max(firstVisible, -song.beatsPerBar); b <= Math.min(lastVisible, song.lengthBeats); b++) {
      const bar = ((b % song.beatsPerBar) + song.beatsPerBar) % song.beatsPerBar === 0;
      lines.push({ t: st.firstBeatTime + b * spb, bar, barNo: b >= 0 && bar ? b / song.beatsPerBar + 1 : 0 });
    }
  }
  for (const line of lines) {
    const p = project(line.t - now, rate, w, h);
    ctx.strokeStyle = line.bar ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)";
    ctx.lineWidth = line.bar ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx - p.half, p.y);
    ctx.lineTo(cx + p.half, p.y);
    ctx.stroke();
    if (line.barNo > 0 && p.z > 0.02) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${Math.round(10 + 4 * p.scale)}px system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(String(line.barNo), cx - p.half - 8, p.y + 4);
    }
  }

  // Hit line
  const pulse = st.pulse;
  ctx.shadowColor = st.pulseColor;
  ctx.shadowBlur = 18 + pulse * 30;
  ctx.strokeStyle = pulse > 0.05 ? st.pulseColor : "rgba(255,255,255,0.85)";
  ctx.lineWidth = 4 + pulse * 4;
  ctx.beginPath();
  ctx.moveTo(cx - hitW / 2 - 6, hitY);
  ctx.lineTo(cx + hitW / 2 + 6, hitY);
  ctx.stroke();
  // target ring
  const ringR = Math.min(34, hitW * 0.11);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(cx, hitY, ringR * (1 + pulse * 0.35), 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (pulse > 0.05) {
    ctx.strokeStyle = hexA(st.pulseColor, pulse * 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, hitY, ringR * (1.4 + (1 - pulse) * 1.6), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Notes (far to near so near ones draw on top)
  const visEnd = now + LOOKAHEAD * rate;
  for (let i = st.notes.length - 1; i >= 0; i--) {
    const n = st.notes[i];
    if (n.t > visEnd + 0.1 || n.t < now - 0.6 * rate) continue;
    const done = n.judged === "perfect" || n.judged === "good";
    if (done && perfNow - n.judgedAt > 160) continue;
    const p = project(n.t - now, rate, w, h);
    if (p.y > h + 40) continue;
    const r = ringR * p.scale;
    // tail shows how long the note rings
    if (!n.judged && n.end - n.t > 0.12) {
      const pe = project(Math.min(n.end, visEnd) - now, rate, w, h);
      const tg = ctx.createLinearGradient(0, pe.y, 0, p.y);
      tg.addColorStop(0, hexA(accent, 0));
      tg.addColorStop(1, hexA(accent, 0.45));
      ctx.fillStyle = tg;
      const tw = r * 0.55;
      ctx.beginPath();
      ctx.moveTo(cx - tw * (pe.scale / p.scale), pe.y);
      ctx.lineTo(cx + tw * (pe.scale / p.scale), pe.y);
      ctx.lineTo(cx + tw, p.y);
      ctx.lineTo(cx - tw, p.y);
      ctx.closePath();
      ctx.fill();
    }
    const fade = Math.min(1, (1 - p.z) * 3);
    ctx.globalAlpha = n.judged === "miss" ? 0.35 : Math.max(0.1, fade);
    if (done) {
      const k = (perfNow - n.judgedAt) / 160;
      ctx.globalAlpha = 1 - k;
    }
    const col = n.judged === "miss" ? "#64748b" : accent;
    const g = ctx.createRadialGradient(cx - r * 0.3, p.y - r * 0.3, r * 0.1, cx, p.y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, col);
    g.addColorStop(1, hexA(col, 0.6));
    ctx.shadowColor = col;
    ctx.shadowBlur = n.judged ? 0 : 18 * p.scale;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(r * 1.05)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("👏", cx, p.y + 1);
    ctx.textBaseline = "alphabetic";
    if (n.lyric && !n.judged) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `600 ${Math.round(11 + 7 * p.scale)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(n.lyric.replace(/-$/, ""), cx + p.half + 10, p.y + 5);
    }
    ctx.globalAlpha = 1;
  }

  // Particles
  for (const pt of st.particles) {
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Popups
  for (const pop of st.popups) {
    const age = (perfNow - pop.born) / 700;
    if (age > 1) continue;
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = pop.color;
    ctx.shadowColor = pop.color;
    ctx.shadowBlur = 14;
    ctx.font = `800 ${pop.big ? 30 : 16}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(pop.text, pop.x, pop.y - age * 40);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // HUD: score + accuracy (left), combo (right), progress (top)
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, 0, w, 4);
  const pg = ctx.createLinearGradient(0, 0, w, 0);
  pg.addColorStop(0, "#1a9fd4");
  pg.addColorStop(1, "#e8962e");
  ctx.fillStyle = pg;
  ctx.fillRect(0, 0, w * Math.min(1, Math.max(0, st.progress)), 4);

  const small = w < 520;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `600 ${small ? 10 : 12}px system-ui, sans-serif`;
  ctx.fillText(st.practice ? "PRACTICE" : "SCORE", 14, 26);
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${small ? 20 : 28}px system-ui, sans-serif`;
  ctx.fillText(st.practice ? song.title : st.score.toLocaleString(), 14, small ? 48 : 56);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `600 ${small ? 11 : 13}px system-ui, sans-serif`;
  ctx.fillText(st.accuracy === null ? "Accuracy —" : `Accuracy ${Math.round(st.accuracy * 100)}%`, 14, small ? 66 : 78);

  ctx.textAlign = "right";
  if (st.combo >= 2) {
    ctx.fillStyle = st.combo >= 20 ? "#facc15" : "#fff";
    ctx.shadowColor = st.combo >= 20 ? "#f59e0b" : "#1a9fd4";
    ctx.shadowBlur = 16;
    ctx.font = `900 ${small ? 26 : 38}px system-ui, sans-serif`;
    ctx.fillText(String(st.combo), w - 14, small ? 46 : 58);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `700 ${small ? 10 : 12}px system-ui, sans-serif`;
    ctx.fillText(st.multiplier > 1 ? `COMBO · x${st.multiplier}` : "COMBO", w - 14, small ? 62 : 78);
  }

  // Mic level / input badge (bottom-left)
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText(st.inputLabel, 14, h - 14);
  if (st.micLevel > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(14, h - 34, 80, 6);
    ctx.fillStyle = st.micLevel > 0.8 ? "#f43f5e" : "#22c55e";
    ctx.fillRect(14, h - 34, 80 * Math.min(1, st.micLevel), 6);
  }

  drawKaraoke(ctx, w, h, st);

  // Count-in
  if (now < st.firstBeatTime) {
    const beatsLeft = Math.ceil((st.firstBeatTime - now) / spb);
    if (now >= st.countInStart && beatsLeft >= 1 && beatsLeft <= song.beatsPerBar) {
      const frac = 1 - ((st.firstBeatTime - now) / spb - (beatsLeft - 1));
      ctx.globalAlpha = Math.max(0, 1 - frac * 0.9);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = accent;
      ctx.shadowBlur = 30;
      ctx.font = `900 ${Math.round(90 * (1 + frac * 0.3))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(beatsLeft), cx, h * 0.45);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    } else if (now < st.countInStart) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Get ready…", cx, h * 0.45);
    }
  }

  if (st.paused) {
    ctx.fillStyle = "rgba(5,5,20,0.65)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.font = "800 34px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Paused", cx, h * 0.45);
    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillText("Press P or tap Resume", cx, h * 0.45 + 30);
  }
}

export function stepEffects(st: DrawState, dt: number) {
  for (const p of st.particles) {
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += 0.25 * dt * 60;
    p.life -= dt * 1.6;
  }
  st.particles = st.particles.filter((p) => p.life > 0);
  st.pulse = Math.max(0, st.pulse - dt * 4);
}

function hexA(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(255,255,255,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Karaoke strip: the current lyric line with the syllable to clap next highlighted. */
function drawKaraoke(ctx: CanvasRenderingContext2D, w: number, h: number, st: DrawState) {
  if (!st.lines.length) return;
  const { notes, now, rate } = st;
  let idx = notes.findIndex((n) => n.t + 0.2 * rate > now);
  if (idx < 0) return;
  const lineNo = notes[idx].line;
  const line = st.lines[lineNo]?.filter((i) => notes[i].lyric);
  if (!line || !line.length) return;
  // Hide lines that are still far away (long instrumental gaps)
  if (notes[line[0]].t - now > 4 * rate) return;
  if (!notes[idx].lyric) idx = line.find((i) => notes[i].t + 0.2 * rate > now) ?? idx;
  const small = w < 520;
  let size = small ? 18 : 24;
  const pieces = line.map((i) => {
    const n = notes[i];
    const text = (n.lyric || "").replace(/-$/, "") + (n.joinNext || /-$/.test(n.lyric || "") ? "" : " ");
    return { i, text };
  });
  const measure = () => {
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    return pieces.reduce((sum, p) => sum + ctx.measureText(p.text).width, 0);
  };
  let total = measure();
  while (total > w * 0.86 && size > 11) {
    size -= 1;
    total = measure();
  }
  const y = small ? 96 : 116;
  ctx.fillStyle = "rgba(5,5,25,0.55)";
  const padX = 16;
  roundRect(ctx, (w - total) / 2 - padX, y - size - 8, total + padX * 2, size + 20, 14);
  ctx.fill();
  let x = (w - total) / 2;
  ctx.textAlign = "left";
  for (const p of pieces) {
    const n = notes[p.i];
    const active = p.i === idx;
    let color = "rgba(255,255,255,0.55)";
    if (n.judged === "perfect") color = "#facc15";
    else if (n.judged === "good") color = "#22d3ee";
    else if (n.judged === "miss") color = "#f87171";
    else if (active) color = "#ffffff";
    ctx.fillStyle = color;
    if (active) {
      ctx.shadowColor = st.song.accent;
      ctx.shadowBlur = 14;
    }
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    ctx.fillText(p.text, x, y);
    ctx.shadowBlur = 0;
    if (active) {
      const tw = ctx.measureText(p.text.trimEnd()).width;
      ctx.fillStyle = st.song.accent;
      ctx.fillRect(x, y + 5, tw, 3);
    }
    x += ctx.measureText(p.text).width;
  }
  // next line, smaller and dim
  const next = st.lines[lineNo + 1]?.filter((i) => notes[i].lyric);
  if (next && next.length && notes[next[0]].t - now < 8 * rate) {
    const text = next
      .map((i) => (notes[i].lyric || "").replace(/-$/, "") + (notes[i].joinNext || /-$/.test(notes[i].lyric || "") ? "" : " "))
      .join("")
      .trim();
    ctx.font = `600 ${Math.round(size * 0.62)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "center";
    ctx.fillText(text, w / 2, y + size * 0.62 + 14);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
