"use client";

import { useEffect, useRef, useState } from "react";
import type { GameDef } from "../catalog";
import { Hud } from "../components/Hud";
import { ChoiceGrid } from "../components/visuals";
import { playMidi, playMiss, playSuccess, playTone } from "../audio";
import { detectPitch } from "../../jam/pitchDetect";
import { INTERVALS, midiToFreq, midiToName, pickAt, shuffleAt, SOLFEGE, SOLFEGE_STEPS } from "../theory";

export function VocalGames({ game, onFinish }: { game: GameDef; onFinish: (score: number) => void }) {
  if (game.kind === "pitch-match") return <PitchMatch onFinish={onFinish} />;
  if (game.kind === "interval-sing") return <IntervalSing onFinish={onFinish} />;
  if (game.kind === "solfege") return <SolfegeGame onFinish={onFinish} />;
  return <SustainGame onFinish={onFinish} />;
}

function useMicPitch() {
  const [hz, setHz] = useState<number | null>(null);
  const [error, setError] = useState("");
  const raf = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let audio: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        streamRef.current = stream;
        audio = new AudioContext();
        source = audio.createMediaStreamSource(stream);
        const analyser = audio.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const loop = () => {
          analyser.getFloatTimeDomainData(buf);
          const result = detectPitch(buf, audio!.sampleRate, 70, 1000);
          setHz(result && result.clarity > 0.85 ? result.frequency : null);
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        setError("Please allow the microphone so we can hear your voice.");
      }
    }
    void start();
    return () => {
      cancelAnimationFrame(raf.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void audio?.close();
    };
  }, []);

  return { hz, error };
}

function centsOff(freq: number, targetHz: number) {
  return 1200 * Math.log2(freq / targetHz);
}

function PitchMatch({ onFinish }: { onFinish: (score: number) => void }) {
  const { hz, error } = useMicPitch();
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [locked, setLocked] = useState(false);
  const target = pickAt([55, 57, 59, 60, 62, 64, 65, 67], round + 3);
  const targetHz = midiToFreq(target);
  const cents = hz ? centsOff(hz, targetHz) : null;

  useEffect(() => {
    if (locked || cents === null || Math.abs(cents) > 40) return;
    const id = window.setTimeout(() => {
      setLocked(true);
      const next = score + Math.max(40, 140 - Math.round(Math.abs(cents)));
      setScore(next);
      playSuccess();
      window.setTimeout(() => {
        if (round + 1 >= 8) onFinish(next);
        else {
          setRound(round + 1);
          setLocked(false);
        }
      }, 900);
    }, 0);
    return () => window.clearTimeout(id);
  }, [cents, locked, onFinish, round, score]);

  return (
    <div className="text-center">
      <Hud score={score} streak={round} label={`${round + 1} / 8`} extra={midiToName(target)} />
      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      <p className="mt-4 font-medium">Listen, then sing or hum the same note.</p>
      <button type="button" className="mt-3 rounded-full bg-[#c026d3] px-5 py-2 text-sm font-semibold text-white" onClick={() => playMidi(target, 0.8, "sine")}>
        Hear the note
      </button>
      <div className="mx-auto mt-6 h-4 max-w-md overflow-hidden rounded-full bg-purple-100">
        <div
          className="h-full rounded-full bg-[#c026d3] transition-all"
          style={{ width: `${cents === null ? 0 : Math.max(6, 100 - Math.min(100, Math.abs(cents))) }%` }}
        />
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {cents === null ? "Waiting for your voice…" : `${cents > 0 ? "A bit high" : "A bit low"} · ${Math.round(Math.abs(cents))} cents`}
      </p>
      <button
        type="button"
        className="mt-4 text-sm text-[var(--muted)] underline"
        onClick={() => {
          const next = score + 10;
          if (round + 1 >= 8) onFinish(next);
          else {
            setScore(next);
            setRound(round + 1);
          }
        }}
      >
        Skip this note
      </button>
    </div>
  );
}

function IntervalSing({ onFinish }: { onFinish: (score: number) => void }) {
  const { hz, error } = useMicPitch();
  const easy = INTERVALS.filter((i) => [3, 4, 5, 7, 12].includes(i.semitones));
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [locked, setLocked] = useState(false);
  const root = pickAt([55, 57, 60, 62], round + 5);
  const interval = pickAt(easy, round + 9);
  const targetHz = midiToFreq(root + interval.semitones);
  const cents = hz ? centsOff(hz, targetHz) : null;

  useEffect(() => {
    if (locked || cents === null || Math.abs(cents) > 50) return;
    const id = window.setTimeout(() => {
      setLocked(true);
      const next = score + 130;
      setScore(next);
      playSuccess();
      window.setTimeout(() => {
        if (round + 1 >= 6) onFinish(next);
        else {
          setRound(round + 1);
          setLocked(false);
        }
      }, 900);
    }, 0);
    return () => window.clearTimeout(id);
  }, [cents, locked, onFinish, round, score]);

  return (
    <div className="text-center">
      <Hud score={score} streak={round} label={`${round + 1} / 6`} extra={interval.label} />
      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      <p className="mt-4 font-medium">
        We play {midiToName(root)}. Sing a {interval.label.toLowerCase()} above it.
      </p>
      <div className="mt-3 flex justify-center gap-2">
        <button type="button" className="rounded-full bg-[#a21caf] px-4 py-2 text-sm text-white" onClick={() => playMidi(root, 0.7, "sine")}>
          Hear home note
        </button>
        <button type="button" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm" onClick={() => playMidi(root + interval.semitones, 0.7, "sine")}>
          Hint
        </button>
      </div>
      <p className="mt-4 text-sm text-[var(--muted)]">
        {cents === null ? "Sing when you’re ready…" : `${Math.round(Math.abs(cents))} cents away`}
      </p>
    </div>
  );
}

function SolfegeGame({ onFinish }: { onFinish: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const degree = Math.floor((round * 3 + 2) % 7);
  const root = 60;

  useEffect(() => {
    playTone(midiToFreq(root), 0.25, "sine", 0.08);
    window.setTimeout(() => playMidi(root + SOLFEGE_STEPS[degree], 0.55, "sine"), 280);
  }, [degree, round]);

  const answer = SOLFEGE[degree];
  const choices = shuffleAt([answer, ...shuffleAt(SOLFEGE.filter((s) => s !== answer), round + 2).slice(0, 3)], round + 4);

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
      <p className="mt-4 text-center font-medium">In C major: first you hear Do, then another note. What solfege is it?</p>
      <div className="mt-3 text-center">
        <button type="button" className="text-sm text-[var(--brand-blue)]" onClick={() => {
          playMidi(root, 0.25, "sine");
          window.setTimeout(() => playMidi(root + SOLFEGE_STEPS[degree], 0.55, "sine"), 280);
        }}>
          Hear again
        </button>
      </div>
      <div className="mt-4">
        <ChoiceGrid choices={choices} picked={picked} answer={choices.indexOf(answer)} reveal={picked !== null} disabled={picked !== null} onPick={choose} />
      </div>
    </div>
  );
}

function SustainGame({ onFinish }: { onFinish: (score: number) => void }) {
  const { hz, error } = useMicPitch();
  const [held, setHeld] = useState(0);
  const [best, setBest] = useState(0);
  const [running, setRunning] = useState(true);
  const last = useRef<number>(0);

  useEffect(() => {
    last.current = performance.now();
    const id = window.setInterval(() => {
      if (!running) return;
      const now = performance.now();
      const dt = (now - last.current) / 1000;
      last.current = now;
      setHeld((h) => {
        const next = hz ? h + dt : Math.max(0, h - dt * 0.35);
        setBest((b) => Math.max(b, next));
        return next;
      });
    }, 80);
    return () => window.clearInterval(id);
  }, [hz, running]);

  return (
    <div className="text-center">
      <Hud score={Math.round(best * 20)} streak={Math.round(held)} label="Sustain" extra={`${best.toFixed(1)}s best`} />
      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      <p className="mt-4 font-medium">Sing or hum a comfortable note and keep it steady.</p>
      <div className="mx-auto mt-6 flex h-40 w-40 items-center justify-center rounded-full border-8 border-violet-200 bg-violet-50 text-3xl font-bold text-violet-700">
        {held.toFixed(1)}s
      </div>
      <button
        type="button"
        className="mt-6 rounded-full bg-[#581c87] px-6 py-2 text-sm font-semibold text-white"
        onClick={() => {
          setRunning(false);
          onFinish(Math.min(5000, Math.round(best * 20)));
        }}
      >
        I’m done — save score
      </button>
    </div>
  );
}
