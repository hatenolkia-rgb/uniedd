"use client";

import {
  DOUBLE_FRET_MARKERS,
  FRET_MARKERS,
  FRETBOARD_FRETS,
  midiToName,
  noteAtFret,
  staffStepsFromBottom,
  STRING_NUMBERS_TOP_TO_BOTTOM,
  type ChordShape,
} from "../theory";

export function StaffNote({
  letter,
  octave,
  accidental = "",
  clef = "treble",
}: {
  letter: string;
  octave: number;
  accidental?: "" | "#" | "b";
  clef?: "treble" | "bass";
}) {
  const steps = staffStepsFromBottom(letter, octave, clef);
  const y = 92 - steps * 8;
  const ledgers: number[] = [];
  if (steps < 0) {
    for (let s = -2; s >= steps; s -= 2) ledgers.push(92 - s * 8);
  }
  if (steps > 8) {
    for (let s = 10; s <= steps; s += 2) ledgers.push(92 - s * 8);
  }

  return (
    <svg viewBox="0 0 220 140" className="mx-auto h-36 w-full max-w-sm" role="img" aria-label={`${letter}${accidental}${octave} on ${clef} clef`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1="28" x2="200" y1={92 - i * 16} y2={92 - i * 16} stroke="#1a1a1a" strokeWidth="1.6" />
      ))}
      <text x="36" y="86" fontSize="44" fontFamily="Georgia, serif" fill="#1a9fd4">
        {clef === "treble" ? "𝄞" : "𝄢"}
      </text>
      {ledgers.map((ly) => (
        <line key={ly} x1="118" x2="168" y1={ly} y2={ly} stroke="#1a1a1a" strokeWidth="1.6" />
      ))}
      {accidental ? (
        <text x="108" y={y + 6} fontSize="22" fontFamily="Georgia, serif">
          {accidental === "#" ? "♯" : "♭"}
        </text>
      ) : null}
      <ellipse cx="146" cy={y} rx="11" ry="8" fill="#1a1a1a" transform={`rotate(-18 146 ${y})`} />
      {steps < 6 ? <line x1="157" x2="157" y1={y} y2={y - 36} stroke="#1a1a1a" strokeWidth="2" /> : <line x1="135" x2="135" y1={y} y2={y + 36} stroke="#1a1a1a" strokeWidth="2" />}
    </svg>
  );
}

export function Fretboard({
  stringFromHigh = 0,
  fret = 0,
  interactive = false,
  onPick,
}: {
  stringFromHigh?: number;
  fret?: number;
  interactive?: boolean;
  onPick?: (stringFromHigh: number, fret: number) => void;
}) {
  const frets = Array.from({ length: FRETBOARD_FRETS + 1 }, (_, i) => i);
  const columns = `56px repeat(${frets.length}, minmax(22px, 1fr))`;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <p className="mb-2 text-center text-[11px] text-[var(--muted)]">
          Player view: string 6 (low E) on top, string 1 (high E) on the bottom, nut on the left
        </p>
        <div className="mb-1 grid items-center gap-1 text-center text-[10px] uppercase tracking-wide text-[var(--muted)]" style={{ gridTemplateColumns: columns }}>
          <span />
          {frets.map((f) => (
            <span key={f}>{f === 0 ? "open" : f}</span>
          ))}
        </div>
        {STRING_NUMBERS_TOP_TO_BOTTOM.map((stringNumber) => {
          const midi = noteAtFret(stringNumber, 0);
          const openName = stringNumber === 1 ? "e" : midiToName(midi);
          return (
            <div key={stringNumber} className="grid items-center gap-1 py-0.5" style={{ gridTemplateColumns: columns }}>
              <span className="text-right text-[11px] font-semibold leading-tight">
                {stringNumber} {openName}
                <span className="block text-[9px] font-normal text-[var(--muted)]">{stringNumber === 6 ? "low" : stringNumber === 1 ? "high" : ""}</span>
              </span>
              {frets.map((f) => {
                const on = stringNumber - 1 === stringFromHigh && f === fret;
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={!interactive}
                    onClick={() => onPick?.(stringNumber - 1, f)}
                    className={`h-7 rounded-md border text-xs transition ${
                      on
                        ? "border-[#e8962e] bg-[#e8962e] text-white shadow"
                        : "border-amber-200 bg-amber-50 hover:bg-amber-100"
                    }`}
                    aria-label={`String ${stringNumber} ${openName} fret ${f}`}
                  >
                    {on ? "●" : ""}
                  </button>
                );
              })}
            </div>
          );
        })}
        <div className="mt-1 grid items-center gap-1" style={{ gridTemplateColumns: columns }} aria-hidden>
          <span />
          {frets.map((f) => (
            <div key={f} className="flex h-4 items-center justify-center gap-0.5">
              {FRET_MARKERS.includes(f as (typeof FRET_MARKERS)[number]) ? (
                DOUBLE_FRET_MARKERS.includes(f as (typeof DOUBLE_FRET_MARKERS)[number]) ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-700/70" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-700/70" />
                  </>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-700/70" />
                )
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChordDiagram({ chord, showName = false }: { chord: ChordShape; showName?: boolean }) {
  const start = Math.max(1, Math.min(...chord.frets.filter((f) => f > 0), 1));
  return (
    <svg viewBox="0 0 140 170" className="mx-auto h-44 w-36" role="img" aria-label={showName ? `${chord.name} chord` : "Guitar chord diagram"}>
      {showName ? (
      <text x="70" y="20" textAnchor="middle" fontWeight="700" fontSize="16">
        {chord.name}
      </text>
      ) : (
      <text x="70" y="20" textAnchor="middle" fontSize="11" fill="#888">
        low E ← strings → high E
      </text>
      )}
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <line key={`s${s}`} x1={25 + s * 18} x2={25 + s * 18} y1="40" y2="150" stroke="#444" strokeWidth="1.5" />
      ))}
      {[0, 1, 2, 3, 4].map((f) => (
        <line key={`f${f}`} x1="25" x2="115" y1={40 + f * 22} y2={40 + f * 22} stroke="#444" strokeWidth={f === 0 ? 4 : 1.2} />
      ))}
      {chord.frets
        .slice()
        .reverse()
        .map((fret, i) => {
          const x = 25 + i * 18;
          if (fret < 0) {
            return (
              <text key={i} x={x} y="36" textAnchor="middle" fontSize="12">
                ×
              </text>
            );
          }
          if (fret === 0) {
            return (
              <circle key={i} cx={x} cy="32" r="5" fill="none" stroke="#1a9fd4" strokeWidth="2" />
            );
          }
          const y = 40 + (fret - start + 0.5) * 22;
          return <circle key={i} cx={x} cy={y} r="7" fill="#e8962e" />;
        })}
    </svg>
  );
}

const WHITE = ["C", "D", "E", "F", "G", "A", "B"] as const;
const BLACK_AFTER: Record<string, string> = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };

export function PianoKeys({
  startOctave = 4,
  whites = 14,
  active = [],
  onPlay,
}: {
  startOctave?: number;
  whites?: number;
  active?: string[];
  onPlay?: (name: string, midi: number) => void;
}) {
  const keys: { name: string; midi: number; white: boolean }[] = [];
  let octave = startOctave;
  for (let i = 0; i < whites; i++) {
    const letter = WHITE[i % 7];
    if (i > 0 && letter === "C") octave += 1;
    const midi = (octave + 1) * 12 + ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(letter);
    keys.push({ name: letter, midi, white: true });
  }

  const width = Math.max(whites * 28, 280);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} 130`} className="mx-auto h-36 w-full max-w-2xl" role="img" aria-label="Piano keyboard">
        {keys.map((key, i) => {
          const on = active.includes(key.name) || active.includes(`${key.name}${Math.floor(key.midi / 12) - 1}`);
          return (
            <rect
              key={`w${i}`}
              x={i * 28}
              y={0}
              width="26"
              height="128"
              rx="3"
              fill={on ? "#fde68a" : "#fffdf8"}
              stroke="#1a1a1a"
              className="cursor-pointer"
              onClick={() => onPlay?.(key.name, key.midi)}
            />
          );
        })}
        {keys.map((key, i) => {
          const sharp = BLACK_AFTER[key.name];
          if (!sharp) return null;
          const midi = key.midi + 1;
          const on = active.includes(sharp);
          return (
            <rect
              key={`b${i}`}
              x={i * 28 + 18}
              y={0}
              width="16"
              height="78"
              rx="2"
              fill={on ? "#e8962e" : "#1a1a1a"}
              className="cursor-pointer"
              onClick={() => onPlay?.(sharp, midi)}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function ChoiceGrid({
  choices,
  disabled,
  picked,
  answer,
  reveal,
  onPick,
}: {
  choices: string[];
  disabled?: boolean;
  picked?: number | null;
  answer?: number;
  reveal?: boolean;
  onPick: (index: number) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {choices.map((choice, i) => {
        const isPicked = picked === i;
        const isAnswer = reveal && i === answer;
        const isWrong = reveal && isPicked && i !== answer;
        return (
          <button
            key={`${choice}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(i)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
              isAnswer
                ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                : isWrong
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : isPicked
                    ? "border-[var(--brand-blue)] bg-sky-50"
                    : "border-[var(--border)] bg-white hover:border-[var(--brand-blue)]"
            }`}
          >
            <span className="mr-2 text-xs text-[var(--muted)]">{["A", "B", "C", "D"][i]}</span>
            {choice}
          </button>
        );
      })}
    </div>
  );
}
