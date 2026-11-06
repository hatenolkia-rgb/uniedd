"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameDef } from "../catalog";
import { Hud } from "../components/Hud";
import { ChoiceGrid } from "../components/visuals";
import { playChordMidi, playClick, playMidi, playMiss, playSuccess } from "../audio";
import {
  buildScale,
  CHORD_INTERVALS,
  CIRCLE,
  INTERVALS,
  midiToName,
  NOTE_NAMES,
  pickAt,
  rand,
  SCALE_NOTE_PALETTE,
  shuffleAt,
} from "../theory";

export function TheoryGames({ game, onFinish }: { game: GameDef; onFinish: (score: number) => void }) {
  if (game.kind === "interval-ear") return <IntervalEar onFinish={onFinish} />;
  if (game.kind === "chord-quality") return <ChordQuality onFinish={onFinish} />;
  if (game.kind === "rhythm") return <RhythmTap onFinish={onFinish} />;
  if (game.kind === "name-note") return <NameNote onFinish={onFinish} />;
  if (game.kind === "scale-builder") return <ScaleBuilder onFinish={onFinish} />;
  if (game.kind === "tempo") return <TempoGuess onFinish={onFinish} />;
  if (game.kind === "circle") return <CircleGame onFinish={onFinish} />;
  return <SymbolsMatch onFinish={onFinish} />;
}

function IntervalEar({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const item = useMemo(() => {
    const iv = pickAt(INTERVALS, round + 2);
    const root = pickAt([55, 57, 60, 62, 64], round + 8);
    return { iv, root };
  }, [round]);
  const choices = useMemo(() => shuffleAt([item.iv.label, ...shuffleAt(INTERVALS.filter((i) => i.id !== item.iv.id), round + 3).slice(0, 3).map((i) => i.label)], round + 4), [item, round]);

  function hear() {
    playMidi(item.root, 0.35);
    window.setTimeout(() => playMidi(item.root + item.iv.semitones, 0.5), 360);
  }
  useEffect(() => {
    hear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = choices[i] === item.iv.label;
    const next = score + (ok ? 120 + streak * 15 : 0);
    setScore(next);
    setStreak(ok ? streak + 1 : 0);
    if (ok) playSuccess();
    else playMiss();
    window.setTimeout(() => {
      if (round + 1 >= 10) onFinish(next);
      else {
        setRound(round + 1);
        setPicked(null);
      }
    }, 750);
  }

  return (
    <div>
      <Hud score={score} streak={streak} label={`${round + 1} / 10`} />
      <p className="mt-4 text-center font-medium">Which interval did you hear?</p>
      <div className="mt-2 text-center">
        <button type="button" className="text-sm text-[var(--brand-blue)]" onClick={hear}>
          Play again
        </button>
      </div>
      <div className="mt-4">
        <ChoiceGrid choices={choices} picked={picked} answer={choices.indexOf(item.iv.label)} reveal={picked !== null} disabled={picked !== null} onPick={choose} />
      </div>
    </div>
  );
}

const QUALITIES = Object.keys(CHORD_INTERVALS);

function ChordQuality({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const item = useMemo(() => {
    const quality = pickAt(QUALITIES, round + 6);
    const root = pickAt([48, 50, 52, 53, 55, 57], round + 11);
    return { quality, root };
  }, [round]);

  function hear() {
    playChordMidi(CHORD_INTERVALS[item.quality].map((s) => item.root + s), 0.9);
  }
  useEffect(() => {
    hear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = QUALITIES[i] === item.quality;
    const next = score + (ok ? 120 + streak * 15 : 0);
    setScore(next);
    setStreak(ok ? streak + 1 : 0);
    if (ok) playSuccess();
    else playMiss();
    window.setTimeout(() => {
      if (round + 1 >= 8) onFinish(next);
      else {
        setRound(round + 1);
        setPicked(null);
      }
    }, 750);
  }

  return (
    <div>
      <Hud score={score} streak={streak} label={`${round + 1} / 8`} />
      <p className="mt-4 text-center font-medium">Is this chord major, minor, diminished or augmented?</p>
      <div className="mt-2 text-center">
        <button type="button" className="text-sm text-[var(--brand-blue)]" onClick={hear}>
          Hear again
        </button>
      </div>
      <div className="mt-4">
        <ChoiceGrid choices={QUALITIES} picked={picked} answer={QUALITIES.indexOf(item.quality)} reveal={picked !== null} disabled={picked !== null} onPick={choose} />
      </div>
    </div>
  );
}

function RhythmTap({ onFinish }: { onFinish: (score: number) => void }) {
  const [bpm] = useState(() => pickAt([80, 90, 100, 110], 19));
  const [hits, setHits] = useState<number[]>([]);
  const startedAt = useRef(0);
  const expected = 8;
  const interval = 60000 / bpm;

  useEffect(() => {
    let count = 0;
    startedAt.current = performance.now() + 400;
    const id = window.setInterval(() => {
      playClick(count % 4 === 0);
      count += 1;
      if (count >= expected) window.clearInterval(id);
    }, interval);
    return () => window.clearInterval(id);
  }, [bpm, interval]);

  function tap() {
    setHits((h) => {
      const next = [...h, performance.now()];
      if (next.length >= expected && startedAt.current) {
        let acc = 0;
        next.slice(0, expected).forEach((t, i) => {
          const target = startedAt.current + i * interval;
          acc += Math.max(0, 100 - Math.abs(t - target) / 3);
        });
        onFinish(Math.round(acc));
      }
      return next;
    });
  }

  return (
    <div className="text-center">
      <Hud score={hits.length * 10} streak={hits.length} label={`${hits.length} / ${expected}`} extra={`${bpm} BPM`} />
      <p className="mt-4 font-medium">Tap along with the 8 clicks, right on the beat.</p>
      <button type="button" onClick={tap} className="mx-auto mt-8 flex h-32 w-32 items-center justify-center rounded-full bg-teal-600 text-xl font-bold text-white shadow-lg">
        TAP
      </button>
    </div>
  );
}

function NameNote({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const midi = useMemo(() => 60 + Math.floor(rand(round + 6) * 12), [round]);
  const name = midiToName(midi);
  const choices = useMemo(() => shuffleAt([name, ...shuffleAt(NOTE_NAMES.filter((n) => n !== name), round + 2).slice(0, 3)], round + 4), [name, round]);

  useEffect(() => {
    playMidi(midi, 0.7, "sine");
  }, [midi]);

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = choices[i] === name;
    const next = score + (ok ? 120 + streak * 15 : 0);
    setScore(next);
    setStreak(ok ? streak + 1 : 0);
    if (ok) playSuccess();
    else playMiss();
    window.setTimeout(() => {
      if (round + 1 >= 10) onFinish(next);
      else {
        setRound(round + 1);
        setPicked(null);
      }
    }, 750);
  }

  return (
    <div>
      <Hud score={score} streak={streak} label={`${round + 1} / 10`} />
      <p className="mt-4 text-center font-medium">Name the pitch you hear.</p>
      <div className="mt-2 text-center">
        <button type="button" className="text-sm text-[var(--brand-blue)]" onClick={() => playMidi(midi, 0.7, "sine")}>
          Hear again
        </button>
      </div>
      <div className="mt-4">
        <ChoiceGrid choices={[...choices]} picked={picked} answer={choices.indexOf(name)} reveal={picked !== null} disabled={picked !== null} onPick={choose} />
      </div>
    </div>
  );
}

function ScaleBuilder({ onFinish }: { onFinish: (score: number) => void }) {
  const jobs = [
    { root: "C", type: "major" as const },
    { root: "G", type: "major" as const },
    { root: "A", type: "minor" as const },
    { root: "D", type: "major" as const },
    { root: "E", type: "minor" as const },
    { root: "F", type: "major" as const },
    { root: "C", type: "major pentatonic" as const },
    { root: "A", type: "minor pentatonic" as const },
    { root: "G", type: "blues" as const },
    { root: "D", type: "dorian" as const },
    { root: "G", type: "mixolydian" as const },
    { root: "F", type: "lydian" as const },
    { root: "E", type: "phrygian" as const },
  ];
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [built, setBuilt] = useState<string[]>([]);
  const job = jobs[round];
  const answer = buildScale(job.root, job.type);

  function add(note: string) {
    if (built.includes(note)) {
      setBuilt(built.filter((n) => n !== note));
      return;
    }
    const next = [...built, note];
    setBuilt(next);
    if (next.length === answer.length) {
      const ok = next.every((n, i) => n === answer[i]) || answer.every((n) => next.includes(n));
      const total = score + (ok ? 140 : 25);
      if (ok) playSuccess();
      else playMiss();
      window.setTimeout(() => {
        if (round + 1 >= jobs.length) onFinish(total);
        else {
          setScore(total);
          setRound(round + 1);
          setBuilt([]);
        }
      }, 700);
    }
  }

  function onDrop(note: string) {
    add(note);
  }

  return (
    <div>
      <Hud score={score} streak={built.length} label={`${round + 1} / ${jobs.length}`} />
      <p className="mt-4 text-center font-medium">
        Build {job.root} {job.type} — tap notes in order, or drag them into the row.
      </p>
      <div
        className="mt-4 flex min-h-16 flex-wrap justify-center gap-2 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50 p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const note = e.dataTransfer.getData("text/plain");
          if (note) onDrop(note);
        }}
      >
        {built.length === 0 ? <span className="text-sm text-[var(--muted)]">Drop or tap notes here</span> : built.map((n) => (
          <span key={n} className="rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm">{n}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SCALE_NOTE_PALETTE.map((note) => (
          <button
            key={note}
            type="button"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", note)}
            onClick={() => add(note)}
            className={`rounded-2xl border px-3 py-2 text-sm ${built.includes(note) ? "border-teal-500 bg-teal-100" : "border-[var(--border)] bg-white"}`}
          >
            {note}
          </button>
        ))}
      </div>
    </div>
  );
}

function TempoGuess({ onFinish }: { onFinish: (score: number) => void }) {
  const [bpm] = useState(() => 60 + Math.round(rand(42) * 80));
  const [guess, setGuess] = useState(90);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number>(0);

  function play() {
    window.clearInterval(timer.current);
    setPlaying(true);
    let n = 0;
    timer.current = window.setInterval(() => {
      playClick(n % 4 === 0);
      n += 1;
      if (n >= 12) {
        window.clearInterval(timer.current);
        setPlaying(false);
      }
    }, 60000 / bpm);
  }

  useEffect(() => () => window.clearInterval(timer.current), []);

  return (
    <div className="text-center">
      <Hud score={0} streak={0} label="Guess the tempo" extra={playing ? "Playing…" : "Ready"} />
      <p className="mt-4 font-medium">Listen to the click, then choose a BPM.</p>
      <button type="button" onClick={play} className="mt-3 rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white">
        Play clicks
      </button>
      <div className="mx-auto mt-6 max-w-md">
        <input type="range" min={50} max={160} value={guess} onChange={(e) => setGuess(Number(e.target.value))} className="w-full" />
        <p className="mt-2 text-2xl font-bold">{guess} BPM</p>
      </div>
      <button
        type="button"
        className="mt-4 rounded-full border border-[var(--border)] px-5 py-2 text-sm"
        onClick={() => {
          const diff = Math.abs(guess - bpm);
          const points = Math.max(0, 200 - diff * 4);
          playSuccess();
          onFinish(points);
        }}
      >
        Lock in guess
      </button>
    </div>
  );
}

function CircleGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const from = CIRCLE[round % CIRCLE.length];
  const answer = CIRCLE[(CIRCLE.indexOf(from) + 1) % CIRCLE.length];
  const choices = useMemo(() => shuffleAt([answer, ...shuffleAt(CIRCLE.filter((k) => k !== answer), round + 2).slice(0, 3)], round + 4), [answer, round]);

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = choices[i] === answer;
    const next = score + (ok ? 110 + streak * 15 : 0);
    setScore(next);
    setStreak(ok ? streak + 1 : 0);
    if (ok) playSuccess();
    else playMiss();
    window.setTimeout(() => {
      if (round + 1 >= 12) onFinish(next);
      else {
        setRound(round + 1);
        setPicked(null);
      }
    }, 650);
  }

  return (
    <div>
      <Hud score={score} streak={streak} label={`${round + 1} / 12`} />
      <p className="mt-4 text-center font-medium">Going clockwise on the circle of fifths, what comes after {from}?</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {CIRCLE.map((key) => (
          <span key={key} className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${key === from ? "bg-teal-600 text-white" : "bg-teal-50"}`}>
            {key}
          </span>
        ))}
      </div>
      <div className="mt-5">
        <ChoiceGrid choices={[...choices]} picked={picked} answer={choices.indexOf(answer)} reveal={picked !== null} disabled={picked !== null} onPick={choose} />
      </div>
    </div>
  );
}

const SYMBOLS = [
  { id: "treble", label: "Treble clef", draw: "𝄞" },
  { id: "bass", label: "Bass clef", draw: "𝄢" },
  { id: "sharp", label: "Sharp", draw: "♯" },
  { id: "flat", label: "Flat", draw: "♭" },
  { id: "natural", label: "Natural", draw: "♮" },
  { id: "forte", label: "Forte (loud)", draw: "𝑓" },
  { id: "piano", label: "Piano (soft)", draw: "𝑝" },
  { id: "repeat", label: "Repeat", draw: "𝄇" },
];

function SymbolsMatch({ onFinish }: { onFinish: (score: number) => void }) {
  const cards = useMemo(
    () =>
      shuffleAt(
        SYMBOLS.flatMap((s) => [
          { key: `${s.id}-a`, id: s.id, show: s.draw },
          { key: `${s.id}-b`, id: s.id, show: s.label },
        ]),
        21,
      ),
    [],
  );
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);

  function flip(i: number) {
    if (open.includes(i) || matched.includes(cards[i].id) || open.length === 2) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (cards[a].id === cards[b].id) {
        const ids = [...matched, cards[a].id];
        setMatched(ids);
        setScore((s) => s + 80);
        playSuccess();
        setOpen([]);
        if (ids.length === SYMBOLS.length) {
          window.setTimeout(() => onFinish(Math.max(80, 80 * SYMBOLS.length - moves * 5)), 400);
        }
      } else {
        playMiss();
        window.setTimeout(() => setOpen([]), 800);
      }
    }
  }

  return (
    <div>
      <Hud score={score} streak={matched.length} label={`${matched.length} / ${SYMBOLS.length} pairs`} extra={`${moves} moves`} />
      <p className="mt-4 text-center font-medium">Match each symbol with its name.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((card, i) => {
          const up = open.includes(i) || matched.includes(card.id);
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => flip(i)}
              className={`flex min-h-20 items-center justify-center rounded-2xl border px-2 text-center text-sm font-medium ${
                matched.includes(card.id)
                  ? "border-emerald-300 bg-emerald-50"
                  : up
                    ? "border-teal-400 bg-white"
                    : "border-[var(--border)] bg-teal-700 text-teal-700"
              }`}
            >
              {up ? <span className="text-lg">{card.show}</span> : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
