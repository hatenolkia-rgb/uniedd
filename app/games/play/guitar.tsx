"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameDef } from "../catalog";
import { Hud } from "../components/Hud";
import { ChoiceGrid, ChordDiagram, Fretboard } from "../components/visuals";
import { playMidi, playMiss, playSuccess, playClick } from "../audio";
import { enharmonicLabel, fretNote, FRETBOARD_FRETS, midiToName, NOTE_NAMES, OPEN_CHORDS, pickAt, rand, shuffleAt } from "../theory";

const ROUNDS = 10;
export function GuitarGames({ game, onFinish }: { game: GameDef; onFinish: (score: number) => void }) {
  if (game.kind === "fretboard") return <FretboardGame onFinish={onFinish} />;
  if (game.kind === "chord-shape") return <ChordShapeGame onFinish={onFinish} />;
  if (game.kind === "strum") return <StrumGame onFinish={onFinish} />;
  return <TabGame onFinish={onFinish} />;
}

function FretboardGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const target = useMemo(() => {
    const s = Math.floor(rand(round + 1) * 6);
    const f = Math.floor(rand(round + 17) * (FRETBOARD_FRETS + 1));
    const midi = fretNote(s, f);
    const name = midiToName(midi);
    return { s, f, midi, name, label: enharmonicLabel(name) };
  }, [round]);
  const choices = useMemo(() => {
    const answer = target.label;
    const pool = NOTE_NAMES.map((n) => enharmonicLabel(n)).filter((n, i, arr) => n !== answer && arr.indexOf(n) === i);
    return shuffleAt([answer, ...shuffleAt(pool, round + 3).slice(0, 3)], round + 5);
  }, [target, round]);

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = choices[i] === target.label;
    const gained = ok ? 100 + streak * 15 : 0;
    const next = score + gained;
    setScore(next);
    setStreak(ok ? streak + 1 : 0);
    if (ok) playMidi(target.midi);
    if (ok) playSuccess();
    else playMiss();
    window.setTimeout(() => {
      if (round + 1 >= ROUNDS) onFinish(next);
      else {
        setRound(round + 1);
        setPicked(null);
      }
    }, 800);
  }

  return (
    <div>
      <Hud score={score} streak={streak} label={`${round + 1} / ${ROUNDS}`} />
      <p className="mt-4 text-center font-medium">What note is glowing?</p>
      <div className="mt-3">
        <Fretboard stringFromHigh={target.s} fret={target.f} />
      </div>
      <div className="mt-4">
        <ChoiceGrid choices={choices} picked={picked} answer={choices.indexOf(target.label)} reveal={picked !== null} disabled={picked !== null} onPick={choose} />
      </div>
    </div>
  );
}

function ChordShapeGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const chord = useMemo(() => pickAt(OPEN_CHORDS, round + 8), [round]);
  const choices = useMemo(() => shuffleAt([chord.name, ...shuffleAt(OPEN_CHORDS.filter((c) => c.name !== chord.name), round + 2).slice(0, 3).map((c) => c.name)], round + 4), [chord, round]);

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = choices[i] === chord.name;
    const gained = ok ? 110 + streak * 15 : 0;
    const next = score + gained;
    setScore(next);
    setStreak(ok ? streak + 1 : 0);
    if (ok) playSuccess();
    else playMiss();
    window.setTimeout(() => {
      if (round + 1 >= ROUNDS) onFinish(next);
      else {
        setRound(round + 1);
        setPicked(null);
      }
    }, 800);
  }

  return (
    <div>
      <Hud score={score} streak={streak} label={`${round + 1} / ${ROUNDS}`} />
      <p className="mt-4 text-center font-medium">Which chord is this?</p>
      <ChordDiagram chord={chord} />
      <ChoiceGrid choices={choices} picked={picked} answer={choices.indexOf(chord.name)} reveal={picked !== null} disabled={picked !== null} onPick={choose} />
    </div>
  );
}

const STRUMS = [
  { name: "D D D D", pattern: [1, 0, 1, 0, 1, 0, 1, 0] },
  { name: "D D U U D U", pattern: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1] },
  { name: "D U D U", pattern: [1, 1, 1, 1] },
  { name: "D DU UDU", pattern: [1, 0, 1, 1, 0, 1, 1, 1] },
];

function StrumGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [listening, setListening] = useState(false);
  const [taps, setTaps] = useState<number[]>([]);
  const pattern = STRUMS[round % STRUMS.length];

  async function preview() {
    setListening(true);
    setTaps([]);
    for (let i = 0; i < pattern.pattern.length; i++) {
      if (pattern.pattern[i]) playClick(i % 2 === 0);
      await wait(280);
    }
    setListening(false);
  }

  useEffect(() => {
    const id = window.setTimeout(() => { void preview(); }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  function tap() {
    if (listening) return;
    playClick(false);
    const nextTaps = [...taps, 1];
    setTaps(nextTaps);
    if (nextTaps.length >= pattern.pattern.filter(Boolean).length) {
      const expected = pattern.pattern.filter(Boolean).length;
      const ok = Math.abs(nextTaps.length - expected) === 0;
      const next = score + (ok ? 120 : 40);
      window.setTimeout(() => {
        if (round + 1 >= 6) onFinish(next);
        else {
          setScore(next);
          setRound(round + 1);
          setTaps([]);
        }
      }, 400);
    }
  }

  return (
    <div className="text-center">
      <Hud score={score} streak={taps.length} label={`${round + 1} / 6`} extra={pattern.name} />
      <p className="mt-4 font-medium">Listen, then tap each strum (downs and ups).</p>
      <button type="button" onClick={() => void preview()} className="mt-3 text-sm text-[var(--brand-blue)]">
        Hear it again
      </button>
      <button
        type="button"
        onClick={tap}
        disabled={listening}
        className="mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-full bg-[#e8962e] text-lg font-bold text-white shadow-lg disabled:opacity-50"
      >
        TAP
      </button>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Taps {taps.length} / {pattern.pattern.filter(Boolean).length}
      </p>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const TAB_STRINGS = ["e", "B", "G", "D", "A", "E"];

function TabGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const item = useMemo(() => {
    const s = Math.floor(rand(round + 11) * 6);
    const f = Math.floor(rand(round + 23) * (FRETBOARD_FRETS + 1));
    const midi = fretNote(s, f);
    const name = midiToName(midi);
    return { s, f, name, label: enharmonicLabel(name) };
  }, [round]);
  const lines = TAB_STRINGS.map((label, s) => {
    const cells = [0, 1, 2, 3].map((i) => (s === item.s && i === 1 ? String(item.f) : "-"));
    return `${label}|${cells.join("--")}|`;
  });
  const mode = round % 2 === 0 ? "note" : "string";
  const answer = mode === "note" ? item.label : TAB_STRINGS[item.s];
  const choices = useMemo(() => {
    if (mode === "note") {
      const pool = NOTE_NAMES.map((n) => enharmonicLabel(n)).filter((n, i, arr) => n !== item.label && arr.indexOf(n) === i);
      return shuffleAt([item.label, ...shuffleAt(pool, round + 6).slice(0, 3)], round + 7);
    }
    return shuffleAt([TAB_STRINGS[item.s], ...shuffleAt(TAB_STRINGS.filter((_, i) => i !== item.s), round + 6).slice(0, 3)], round + 7);
  }, [item, mode, round]);

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = choices[i] === answer;
    const next = score + (ok ? 100 + streak * 12 : 0);
    setScore(next);
    setStreak(ok ? streak + 1 : 0);
    if (ok) playSuccess();
    else playMiss();
    window.setTimeout(() => {
      if (round + 1 >= ROUNDS) onFinish(next);
      else {
        setRound(round + 1);
        setPicked(null);
      }
    }, 750);
  }

  return (
    <div>
      <Hud score={score} streak={streak} label={`${round + 1} / ${ROUNDS}`} />
      <p className="mt-4 text-center font-medium">
        {mode === "note" ? "Which note does the number ask for?" : "Which string has the number?"}
      </p>
      <pre className="mx-auto mt-4 max-w-sm overflow-x-auto rounded-2xl bg-[#111] p-4 text-left text-sm leading-6 text-emerald-300">
        {lines.join("\n")}
      </pre>
      <div className="mt-4">
        <ChoiceGrid choices={choices} picked={picked} answer={choices.indexOf(answer)} reveal={picked !== null} disabled={picked !== null} onPick={choose} />
      </div>
    </div>
  );
}
