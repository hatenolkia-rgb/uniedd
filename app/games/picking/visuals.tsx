"use client";

import { useMemo } from "react";
import { CHORDS, type Exercise, type Judgement } from "./patterns";

// ---------------------------------------------------------------- mascot

export type Mood = "happy" | "wow" | "oops" | "listen" | "sleep";

/** "Picky" — a cheerful guitar pick who bounces on the beat. */
export function Mascot({ mood = "happy", beat = 0, size = 92 }: { mood?: Mood; beat?: number; size?: number }) {
  const mouth =
    mood === "wow" ? (
      <ellipse cx="50" cy="66" rx="9" ry="10" fill="#7c2d12" />
    ) : mood === "oops" ? (
      <path d="M38 70 Q50 60 62 70" stroke="#7c2d12" strokeWidth="4" fill="none" strokeLinecap="round" />
    ) : mood === "listen" ? (
      <circle cx="50" cy="66" r="5" fill="#7c2d12" />
    ) : mood === "sleep" ? (
      <path d="M42 66 h16" stroke="#7c2d12" strokeWidth="4" strokeLinecap="round" />
    ) : (
      <path d="M36 61 Q50 77 64 61" stroke="#7c2d12" strokeWidth="4" fill="#fff" strokeLinecap="round" />
    );
  const eyes =
    mood === "sleep" ? (
      <>
        <path d="M34 46 q5 4 10 0" stroke="#1e1b4b" strokeWidth="3" fill="none" />
        <path d="M56 46 q5 4 10 0" stroke="#1e1b4b" strokeWidth="3" fill="none" />
      </>
    ) : mood === "wow" ? (
      <>
        <path d="M33 46 l6 -7 l6 7" stroke="#1e1b4b" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M55 46 l6 -7 l6 7" stroke="#1e1b4b" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="39" cy="45" r="6" fill="#1e1b4b" />
        <circle cx="61" cy="45" r="6" fill="#1e1b4b" />
        <circle cx="41" cy="43" r="2" fill="#fff" />
        <circle cx="63" cy="43" r="2" fill="#fff" />
      </>
    );
  return (
    <div key={beat} className={beat ? "pk-bounce" : "pk-float"} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id="pk-pick" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde047" />
            <stop offset="0.55" stopColor="#fb923c" />
            <stop offset="1" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        <path d="M50 96 C30 80 8 52 10 30 C12 10 30 5 50 5 C70 5 88 10 90 30 C92 52 70 80 50 96 Z" fill="url(#pk-pick)" stroke="#9a3412" strokeWidth="3" />
        <ellipse cx="30" cy="22" rx="10" ry="5" fill="#fff8" transform="rotate(-25 30 22)" />
        {eyes}
        <circle cx="28" cy="57" r="5" fill="#f9a8d4" opacity=".8" />
        <circle cx="72" cy="57" r="5" fill="#f9a8d4" opacity=".8" />
        {mouth}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- chord diagram

const FINGER_COLORS = ["#94a3b8", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6"];
const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];

export function ChordDiagram({ name, size = 170, dim = false, className = "" }: { name: string; size?: number; dim?: boolean; className?: string }) {
  const shape = CHORDS[name];
  if (!shape) return null;
  const base = shape.base ?? 1;
  const frets = 4;
  const W = 140;
  const H = 175;
  const left = 22;
  const top = 42;
  const sx = (W - left * 2) / 5;
  const fy = (H - top - 22) / frets;
  const x = (s: number) => left + s * sx;
  const y = (f: number) => top + (f - base + 0.5) * fy;
  return (
    <figure className={`inline-flex flex-col items-center ${dim ? "opacity-70" : ""} ${className}`} aria-label={`${shape.spoken} chord diagram`}>
      <svg viewBox={`0 0 ${W} ${H}`} width={className ? "100%" : size} height={className ? undefined : (size * H) / W} style={className ? { height: "auto" } : undefined} role="img">
        <title>{`${shape.spoken} chord`}</title>
        <rect x={left - 8} y={top - 4} width={W - 2 * left + 16} height={frets * fy + 8} rx="10" fill="#fff7ed" />
        {/* frets */}
        {Array.from({ length: frets + 1 }, (_, i) => (
          <line key={`f${i}`} x1={left} x2={W - left} y1={top + i * fy} y2={top + i * fy} stroke={i === 0 && base === 1 ? "#1f2937" : "#cbd5e1"} strokeWidth={i === 0 && base === 1 ? 6 : 2} strokeLinecap="round" />
        ))}
        {/* strings */}
        {STRING_NAMES.map((_, s) => (
          <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={top} y2={top + frets * fy} stroke="#a16207" strokeWidth={1.4 + (5 - s) * 0.35} />
        ))}
        {base > 1 ? (
          <text x={W - left + 6} y={top + fy * 0.62} fontSize="12" fontWeight="700" fill="#475569">
            {base}fr
          </text>
        ) : null}
        {/* open / muted markers */}
        {shape.frets.map((f, s) =>
          f <= 0 ? (
            <text key={`m${s}`} x={x(s)} y={top - 12} textAnchor="middle" fontSize="15" fontWeight="800" fill={f < 0 ? "#e11d48" : "#16a34a"}>
              {f < 0 ? "✕" : "○"}
            </text>
          ) : null,
        )}
        {/* barre */}
        {shape.barre ? (
          <rect
            x={x(shape.barre.from) - 9}
            y={y(shape.barre.fret) - 9}
            width={x(shape.barre.to) - x(shape.barre.from) + 18}
            height={18}
            rx={9}
            fill={FINGER_COLORS[1]}
          />
        ) : null}
        {/* finger dots */}
        {shape.frets.map((f, s) => {
          if (f <= 0) return null;
          const finger = shape.fingers[s];
          if (shape.barre && finger === 1 && f === shape.barre.fret && s !== shape.barre.from) return null;
          return (
            <g key={`d${s}`}>
              <circle cx={x(s)} cy={y(f)} r={10} fill={FINGER_COLORS[finger] || "#64748b"} stroke="#fff" strokeWidth="2" />
              <text x={x(s)} y={y(f) + 4.5} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">
                {finger || ""}
              </text>
            </g>
          );
        })}
        {STRING_NAMES.map((n, s) => (
          <text key={`n${s}`} x={x(s)} y={H - 4} textAnchor="middle" fontSize="11" fill="#64748b">
            {n}
          </text>
        ))}
      </svg>
      <figcaption className="-mt-1 text-center">
        <span className="text-2xl font-black text-slate-800">{shape.name}</span>
        <span className="block text-xs text-slate-500">{shape.spoken}</span>
      </figcaption>
    </figure>
  );
}

export function FingerLegend() {
  return (
    <p className="flex flex-wrap justify-center gap-2 text-xs text-slate-600">
      {["Pointer", "Middle", "Ring", "Pinky"].map((f, i) => (
        <span key={f} className="inline-flex items-center gap-1">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: FINGER_COLORS[i + 1] }}>
            {i + 1}
          </span>
          {f}
        </span>
      ))}
    </p>
  );
}

// ---------------------------------------------------------------- pattern lane

const JUDGE_STYLE: Record<Judgement, { bg: string; fg: string; badge: string }> = {
  perfect: { bg: "#22c55e", fg: "#fff", badge: "⭐" },
  good: { bg: "#facc15", fg: "#713f12", badge: "👍" },
  wrong: { bg: "#a855f7", fg: "#fff", badge: "↻" },
  miss: { bg: "#e2e8f0", fg: "#94a3b8", badge: "·" },
};

/**
 * The arrows of an exercise, grouped by beat. `active` is the slot index being played,
 * `results` the judgement of each *step* (non-rest slot) in order.
 */
export function PatternLane({ ex, active, results, compact }: { ex: Exercise; active: number; results: (Judgement | null)[]; compact?: boolean }) {
  const groups = useMemo(() => {
    const out: { beat: number; slots: { slot: (typeof ex.slots)[number]; i: number; step: number }[]; chord?: string }[] = [];
    let step = 0;
    ex.slots.forEach((slot, i) => {
      let g = out[out.length - 1];
      if (!g || g.beat !== slot.group) {
        g = { beat: slot.group, slots: [] };
        out.push(g);
      }
      g.slots.push({ slot, i, step: slot.rest ? -1 : step });
      if (!slot.rest) step++;
    });
    let last = "";
    for (const g of out) {
      const ch = g.slots[0]?.slot.chord;
      if (ch && ch !== last) g.chord = ch;
      last = ch || "";
    }
    return out;
  }, [ex]);
  const dense = ex.maxGrid >= 4 || ex.slots.length > 24;
  const tile = compact || dense ? "h-9 w-6 text-base sm:h-12 sm:w-9 sm:text-xl" : "h-12 w-9 text-xl sm:h-16 sm:w-14 sm:text-3xl";
  return (
    <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-2 sm:gap-x-2 sm:gap-y-3" data-testid="pattern-lane">
      {groups.map((g) => (
        <div key={g.beat} className="relative flex flex-col items-center">
          <span className="mb-1 h-4 text-xs font-black text-violet-700">{g.chord ? `🎸 ${g.chord}` : ""}</span>
          <div className="flex gap-0.5 rounded-2xl bg-white/70 p-1 shadow-sm ring-1 ring-violet-200 sm:gap-1 sm:p-1.5">
            {g.slots.map(({ slot, i, step }) => {
              const r = step >= 0 ? results[step] : null;
              const st = r ? JUDGE_STYLE[r] : null;
              const isActive = i === active;
              if (slot.rest) {
                return (
                  <span
                    key={i}
                    className={`pk-tile flex ${tile} items-center justify-center rounded-xl border-2 border-dashed border-violet-200 text-violet-300 ${isActive ? "pk-glow" : ""}`}
                    title="Rest — air stroke"
                  >
                    {slot.dir === "D" ? "⇣" : "⇡"}
                  </span>
                );
              }
              const down = slot.dir === "D";
              return (
                <span
                  key={i}
                  data-dir={slot.dir}
                  data-result={r || ""}
                  className={`pk-tile relative flex ${tile} items-center justify-center rounded-xl font-black shadow ${isActive ? "pk-glow" : ""} ${r ? "pk-pop" : ""}`}
                  style={{
                    background: st ? st.bg : down ? "#3b82f6" : "#ec4899",
                    color: st ? st.fg : "#fff",
                    outline: slot.accent ? "3px solid #f97316" : undefined,
                    outlineOffset: 1,
                  }}
                  title={`${down ? "Down" : "Up"} stroke${slot.accent ? " (accent)" : ""}`}
                >
                  {down ? "↓" : "↑"}
                  {r ? <span className="absolute -right-1.5 -top-2 text-xs">{st?.badge}</span> : null}
                </span>
              );
            })}
          </div>
          <span className="mt-1 text-[11px] font-bold text-violet-500">{(g.beat % 4) + 1}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- confetti & stars

const CONFETTI_COLORS = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#fde047"];

export function Confetti({ burst, pieces = 46 }: { burst: number; pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: burst ? pieces : 0 }, (_, i) => {
        // deterministic-ish pseudo random per burst so React renders stay pure
        const r = (k: number) => {
          const v = Math.sin(burst * 97.13 + i * 12.9898 + k * 78.233) * 43758.5453;
          return v - Math.floor(v);
        };
        return {
          left: `${r(1) * 100}%`,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          delay: `${r(2) * 0.5}s`,
          dur: `${1.4 + r(3) * 1.2}s`,
          rot: `${360 + r(4) * 720}deg`,
          round: r(5) > 0.6,
        };
      }),
    [burst, pieces],
  );
  if (!burst) return null;
  return (
    <div key={burst} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="pk-confetti"
          style={{ left: b.left, background: b.color, borderRadius: b.round ? "50%" : 3, ["--delay" as string]: b.delay, ["--dur" as string]: b.dur, ["--rot" as string]: b.rot }}
        />
      ))}
    </div>
  );
}

export function Stars({ n, size = "text-4xl" }: { n: number; size?: string }) {
  return (
    <span className={`inline-flex gap-1 ${size}`} aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="pk-star" style={{ animationDelay: `${i * 0.15}s`, filter: i < n ? "none" : "grayscale(1) opacity(.3)" }}>
          ⭐
        </span>
      ))}
    </span>
  );
}
