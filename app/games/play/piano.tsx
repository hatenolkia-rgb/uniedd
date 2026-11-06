"use client";

import { useMemo, useState } from "react";
import type { GameDef } from "../catalog";
import { Hud } from "../components/Hud";
import { ChoiceGrid, PianoKeys, StaffNote } from "../components/visuals";
import { playMidi, playMiss, playSequence, playSuccess } from "../audio";
import { CHORD_INTERVALS, enharmonicLabel, nameToPc, NOTE_NAMES, pick, pickAt, rand, shuffleAt } from "../theory";

const ROUNDS = 10;
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;

export function PianoGames({ game, onFinish }: { game: GameDef; onFinish: (score: number) => void }) {
  if (game.kind === "piano-keys") return <KeyFinder onFinish={onFinish} />;
  if (game.kind === "staff") return <StaffGame onFinish={onFinish} />;
  if (game.kind === "piano-chord") return <ChordBuilder onFinish={onFinish} />;
  return <MelodyGame onFinish={onFinish} />;
}

function KeyFinder({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const target = useMemo(() => {
    const useSharp = round > 3 && rand(round + 1) > 0.45;
    if (useSharp) return pickAt(["C#", "D#", "F#", "G#", "A#"], round + 4);
    return pickAt(LETTERS, round + 4);
  }, [round]);
  const answer = enharmonicLabel(target);
  const choices = useMemo(() => {
    const pool = NOTE_NAMES.map((n) => enharmonicLabel(n)).filter((n, i, arr) => n !== answer && arr.indexOf(n) === i);
    return shuffleAt([answer, ...shuffleAt(pool, round + 2).slice(0, 3)], round + 5);
  }, [answer, round]);

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = choices[i] === answer;
    const next = score + (ok ? 100 + streak * 15 : 0);
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
      <p className="mt-4 text-center font-medium">Which note is glowing?</p>
      <PianoKeys active={[target]} />
      <ChoiceGrid choices={choices} picked={picked} answer={choices.indexOf(answer)} reveal={picked !== null} disabled={picked !== null} onPick={choose} />
    </div>
  );
}

const STAFF_NOTES: { letter: string; octave: number; accidental?: "" | "#" | "b"; clef: "treble" | "bass" }[] = [
  { letter: "C", octave: 4, clef: "treble" },
  { letter: "D", octave: 4, clef: "treble" },
  { letter: "E", octave: 4, clef: "treble" },
  { letter: "F", octave: 4, clef: "treble" },
  { letter: "G", octave: 4, clef: "treble" },
  { letter: "A", octave: 4, clef: "treble" },
  { letter: "B", octave: 4, clef: "treble" },
  { letter: "C", octave: 5, clef: "treble" },
  { letter: "D", octave: 5, clef: "treble" },
  { letter: "E", octave: 5, clef: "treble" },
  { letter: "F", octave: 4, accidental: "#", clef: "treble" },
  { letter: "B", octave: 3, accidental: "b", clef: "treble" },
  { letter: "G", octave: 2, clef: "bass" },
  { letter: "A", octave: 2, clef: "bass" },
  { letter: "B", octave: 2, clef: "bass" },
  { letter: "C", octave: 3, clef: "bass" },
  { letter: "D", octave: 3, clef: "bass" },
  { letter: "E", octave: 3, clef: "bass" },
  { letter: "F", octave: 3, clef: "bass" },
  { letter: "G", octave: 3, clef: "bass" },
  { letter: "A", octave: 3, clef: "bass" },
  { letter: "C", octave: 3, accidental: "#", clef: "bass" },
];

function StaffGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const note = useMemo(() => pickAt(STAFF_NOTES, round + 12), [round]);
  const label = `${note.letter}${note.accidental || ""}`;
  const choices = useMemo(() => {
    const pool = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].filter((n) => n !== label);
    return shuffleAt([label, ...shuffleAt(pool, round + 2).slice(0, 3)], round + 5);
  }, [label, round]);

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const ok = choices[i] === label;
    const next = score + (ok ? 110 + streak * 15 : 0);
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
      <Hud score={score} streak={streak} label={`${round + 1} / ${ROUNDS}`} extra={note.clef} />
      <p className="mt-4 text-center font-medium">Name the note on the staff.</p>
      <StaffNote letter={note.letter} octave={note.octave} accidental={note.accidental || ""} clef={note.clef} />
      <ChoiceGrid choices={choices} picked={picked} answer={choices.indexOf(label)} reveal={picked !== null} disabled={picked !== null} onPick={choose} />
    </div>
  );
}

const BUILD_CHORDS = [
  { name: "C major", root: "C", quality: "major" },
  { name: "A minor", root: "A", quality: "minor" },
  { name: "G major", root: "G", quality: "major" },
  { name: "D minor", root: "D", quality: "minor" },
  { name: "F major", root: "F", quality: "major" },
  { name: "E minor", root: "E", quality: "minor" },
  { name: "D major", root: "D", quality: "major" },
  { name: "E major", root: "E", quality: "major" },
];

function ChordBuilder({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const target = BUILD_CHORDS[round % BUILD_CHORDS.length];
  const needed = CHORD_INTERVALS[target.quality].map((step) => {
    const pc = (nameToPc(target.root) + step) % 12;
    return ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][pc];
  });

  function toggle(name: string, midi: number) {
    playMidi(midi, 0.35);
    const next = chosen.includes(name) ? chosen.filter((n) => n !== name) : [...chosen, name].slice(0, 3);
    setChosen(next);
    if (next.length === 3) {
      const ok = needed.every((n) => next.includes(n));
      const gained = ok ? 130 : 20;
      const total = score + gained;
      if (ok) playSuccess();
      else playMiss();
      window.setTimeout(() => {
        if (round + 1 >= 8) onFinish(total);
        else {
          setScore(total);
          setRound(round + 1);
          setChosen([]);
        }
      }, 700);
    }
  }

  return (
    <div>
      <Hud score={score} streak={chosen.length} label={`${round + 1} / 8`} />
      <p className="mt-4 text-center font-medium">Tap the three notes of {target.name}.</p>
      <PianoKeys active={chosen} onPlay={toggle} />
      <p className="mt-2 text-center text-sm text-[var(--muted)]">Selected: {chosen.join(" · ") || "none yet"}</p>
    </div>
  );
}

function MelodyGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [seq, setSeq] = useState<number[]>([60]);
  const [listening, setListening] = useState(false);
  const [step, setStep] = useState(0);
  const notes = [60, 62, 64, 65, 67, 69, 71, 72];

  function playLevel(nextSeq: number[]) {
    setListening(true);
    setStep(0);
    playSequence(nextSeq, 0.42);
    window.setTimeout(() => setListening(false), nextSeq.length * 420 + 200);
  }

  function startOrNext(from = seq) {
    const grown = [...from, pick(notes)];
    setSeq(grown);
    playLevel(grown);
  }

  function hit(_name: string, midi: number) {
    if (listening) return;
    playMidi(midi, 0.3);
    const expect = seq[step];
    const got = midi % 12;
    const exp = expect % 12;
    if (got !== exp) {
      playMiss();
      onFinish(score);
      return;
    }
    if (step + 1 >= seq.length) {
      const next = score + 80 + level * 20;
      setScore(next);
      playSuccess();
      if (level >= 8) {
        onFinish(next);
        return;
      }
      setLevel(level + 1);
      window.setTimeout(() => startOrNext(seq), 500);
    } else {
      setStep(step + 1);
    }
  }

  return (
    <div>
      <Hud score={score} streak={level} label={`Memory ${seq.length} notes`} extra={listening ? "Listen…" : "Your turn"} />
      <p className="mt-4 text-center font-medium">Replay the tune on the keys, in order.</p>
      <div className="mt-3 text-center">
        <button
          type="button"
          className="rounded-full bg-[#1a9fd4] px-5 py-2 text-sm font-semibold text-white"
          onClick={() => (seq.length === 1 && score === 0 ? startOrNext([]) : playLevel(seq))}
        >
          {score === 0 && seq.length === 1 ? "Start the tune" : "Hear it again"}
        </button>
      </div>
      <PianoKeys onPlay={hit} />
    </div>
  );
}
