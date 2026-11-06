"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  KEYS,
  PROGRESSIONS,
  SCALES,
  chordDisplayName,
  chordPitches,
  midiToFreq,
  scaleFretMap,
  scaleNotes,
  type ProgressionChord,
} from "./musicTheory";

const STYLES = [
  { id: "rock", label: "Rock" },
  { id: "pop", label: "Pop" },
  { id: "blues", label: "Blues shuffle" },
  { id: "funk", label: "Funk" },
  { id: "reggae", label: "Reggae" },
  { id: "ballad", label: "Ballad" },
  { id: "jazz", label: "Jazz swing" },
  { id: "bossa", label: "Bossa" },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

function drumHit(ctx: AudioContext, time: number, kind: "kick" | "snare" | "hat", vol: number) {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  if (kind === "kick") {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, time);
    o.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    o.connect(g);
    o.start(time);
    o.stop(time + 0.22);
  } else if (kind === "snare") {
    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    g.gain.setValueAtTime(vol * 0.7, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    src.connect(bp);
    bp.connect(g);
    src.start(time);
  } else {
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    g.gain.setValueAtTime(vol * 0.25, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    src.connect(hp);
    hp.connect(g);
    src.start(time);
  }
}

function playBass(ctx: AudioContext, time: number, midi: number, dur: number, vol: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = midiToFreq(midi);
  g.gain.setValueAtTime(vol * 0.35, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(time);
  o.stop(time + dur + 0.02);
}

function playChord(ctx: AudioContext, time: number, midis: number[], dur: number, vol: number, style: StyleId) {
  midis.forEach((m, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = style === "jazz" || style === "bossa" ? "sine" : "triangle";
    o.frequency.value = midiToFreq(m + 12);
    const attack = style === "funk" ? 0.01 : 0.02;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol * (0.12 - i * 0.015), time + attack);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(time);
    o.stop(time + dur + 0.02);
  });
}

/** Pattern of 16th-note steps in a bar → drum events. */
function drumPattern(style: StyleId, step: number): ("kick" | "snare" | "hat")[] {
  const hits: ("kick" | "snare" | "hat")[] = [];
  if (style === "reggae") {
    if (step % 4 === 2) hits.push("hat");
    if (step === 4 || step === 12) hits.push("snare");
    if (step === 0 || step === 8) hits.push("kick");
  } else if (style === "funk") {
    if (step % 2 === 0) hits.push("hat");
    if (step === 0 || step === 10) hits.push("kick");
    if (step === 4 || step === 12) hits.push("snare");
    if (step === 6 || step === 14) hits.push("kick");
  } else if (style === "blues" || style === "jazz") {
    // shuffle feel approximated on even steps
    if (step % 4 === 0) hits.push("hat");
    if (step === 0 || step === 9) hits.push("kick");
    if (step === 4 || step === 12) hits.push("snare");
  } else if (style === "bossa") {
    if (step % 4 === 0) hits.push("hat");
    if (step === 0 || step === 7 || step === 10) hits.push("kick");
    if (step === 4 || step === 13) hits.push("snare");
  } else if (style === "ballad") {
    if (step === 0 || step === 8) hits.push("kick");
    if (step === 8) hits.push("hat");
    if (step === 4 || step === 12) hits.push("snare");
  } else {
    // rock / pop
    if (step % 2 === 0) hits.push("hat");
    if (step === 0 || step === 8) hits.push("kick");
    if (step === 4 || step === 12) hits.push("snare");
  }
  return hits;
}

export default function BackingPanel() {
  const [key, setKey] = useState<string>("G");
  const [scaleId, setScaleId] = useState("pentatonic-minor");
  const [style, setStyle] = useState<StyleId>("rock");
  const [progId, setProgId] = useState("I-V-vi-IV");
  const [bpm, setBpm] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [drumsOn, setDrumsOn] = useState(true);
  const [bassOn, setBassOn] = useState(true);
  const [chordsOn, setChordsOn] = useState(true);
  const [chordIdx, setChordIdx] = useState(0);
  const [volume, setVolume] = useState(0.7);

  const audioRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const scheduleRef = useRef<() => void>(() => {});
  const nextTime = useRef(0);
  const stepRef = useRef(0);
  const chordStepRef = useRef(0);
  const playingRef = useRef(false);
  const settings = useRef({ key, scaleId, style, progId, bpm, drumsOn, bassOn, chordsOn, volume });

  useEffect(() => {
    settings.current = { key, scaleId, style, progId, bpm, drumsOn, bassOn, chordsOn, volume };
  }, [key, scaleId, style, progId, bpm, drumsOn, bassOn, chordsOn, volume]);

  const prog = PROGRESSIONS[progId] ?? PROGRESSIONS["I-V-vi-IV"];
  const notes = scaleNotes(key, scaleId);
  const frets = scaleFretMap(key, scaleId, 12);
  const currentChord: ProgressionChord = prog.chords[chordIdx % prog.chords.length];

  const schedule = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx || !playingRef.current) return;
    const ahead = 0.25;
    while (nextTime.current < ctx.currentTime + ahead) {
      const s = settings.current;
      const p = PROGRESSIONS[s.progId] ?? PROGRESSIONS["I-V-vi-IV"];
      const stepsPerBeat = 4; // 16th notes
      const secPerStep = 60 / s.bpm / stepsPerBeat;
      const step = stepRef.current % 16;
      const chordCount = p.chords.length;
      const barsPerChord = 1;
      const stepsPerChord = 16 * barsPerChord;
      const cIdx = Math.floor(chordStepRef.current / stepsPerChord) % chordCount;
      const chord = p.chords[cIdx];

      if (step === 0) {
        const t = nextTime.current;
        const delay = Math.max(0, (t - ctx.currentTime) * 1000);
        window.setTimeout(() => {
          if (playingRef.current) setChordIdx(cIdx);
        }, delay);
      }

      if (s.drumsOn) {
        for (const h of drumPattern(s.style, step)) {
          drumHit(ctx, nextTime.current, h, s.volume);
        }
      }

      if (s.bassOn && (step === 0 || (s.style === "funk" && step === 8) || (s.style === "blues" && step === 6))) {
        const root = chordPitches(s.key, chord, 2)[0];
        playBass(ctx, nextTime.current, root, secPerStep * (s.style === "ballad" ? 8 : 3), s.volume);
      }

      if (s.chordsOn) {
        const strum =
          s.style === "reggae"
            ? step === 4 || step === 12
            : s.style === "funk"
              ? step === 2 || step === 6 || step === 10 || step === 14
              : step === 0 || step === 8;
        if (strum) {
          playChord(
            ctx,
            nextTime.current,
            chordPitches(s.key, chord, 3),
            secPerStep * (s.style === "ballad" ? 12 : 4),
            s.volume,
            s.style,
          );
        }
      }

      nextTime.current += secPerStep;
      stepRef.current += 1;
      chordStepRef.current += 1;
    }
    timerRef.current = window.setTimeout(() => scheduleRef.current(), 50);
  }, []);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const start = useCallback(async () => {
    const ctx = audioRef.current ?? new AudioContext();
    audioRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    stepRef.current = 0;
    chordStepRef.current = 0;
    nextTime.current = ctx.currentTime + 0.08;
    playingRef.current = true;
    setPlaying(true);
    setChordIdx(0);
    scheduleRef.current();
  }, []);

  useEffect(() => () => stop(), [stop]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-b from-[#0b1c2c] to-[#132a40] p-6 sm:p-8 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Now playing</p>
            <div className="mt-1 text-5xl sm:text-6xl font-bold tracking-tight">
              {chordDisplayName(key, currentChord)}
            </div>
            <p className="mt-1 text-sm text-white/60">
              {key} · {SCALES[scaleId]?.label} · {STYLES.find((x) => x.id === style)?.label} · {bpm} BPM
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (playing ? stop() : void start())}
              className={`rounded-full px-8 py-3 text-sm font-semibold ${
                playing
                  ? "bg-white text-[#0b1c2c]"
                  : "bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white"
              }`}
            >
              {playing ? "Stop loop" : "Start loop"}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {prog.chords.map((c, i) => (
            <span
              key={`${c.label}-${i}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                i === chordIdx % prog.chords.length
                  ? "bg-[var(--brand-orange)] text-white"
                  : "bg-white/10 text-white/70"
              }`}
            >
              {chordDisplayName(key, c)}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {(
            [
              ["Drums", drumsOn, setDrumsOn],
              ["Bass", bassOn, setBassOn],
              ["Chords", chordsOn, setChordsOn],
            ] as const
          ).map(([label, on, set]) => (
            <button
              key={label}
              type="button"
              onClick={() => set(!on)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                on ? "bg-[var(--brand-blue)] text-white" : "bg-white/10 text-white/50 line-through"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Key</span>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          >
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Scale / mode</span>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
            value={scaleId}
            onChange={(e) => setScaleId(e.target.value)}
          >
            {Object.entries(SCALES).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Style</span>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
            value={style}
            onChange={(e) => setStyle(e.target.value as StyleId)}
          >
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Progression</span>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
            value={progId}
            onChange={(e) => setProgId(e.target.value)}
          >
            {Object.entries(PROGRESSIONS).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Tempo · {bpm} BPM</span>
          <input
            type="range"
            min={60}
            max={180}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--brand-blue)]"
          />
        </label>
        <label className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--brand-orange)]"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h3 className="font-semibold">Scale notes to play along</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {notes.map((n) => (
            <span
              key={n}
              className="rounded-full bg-gradient-to-r from-[var(--brand-blue)]/15 to-[var(--brand-orange)]/15 px-3 py-1.5 text-sm font-medium"
            >
              {n}
            </span>
          ))}
        </div>

        <h4 className="mt-6 text-sm font-medium text-[var(--muted)]">Fretboard (standard tuning)</h4>
        <div className="mt-3 overflow-x-auto">
          <div
            className="relative inline-grid gap-px rounded-xl bg-[var(--border)] p-px"
            style={{ gridTemplateColumns: `repeat(13, minmax(1.75rem, 1fr))` }}
          >
            {Array.from({ length: 6 }).map((_, s) =>
              Array.from({ length: 13 }).map((_, f) => {
                const hit = frets.find((x) => x.string === s && x.fret === f);
                return (
                  <div
                    key={`${s}-${f}`}
                    className={`flex h-8 w-7 sm:w-8 items-center justify-center text-[10px] sm:text-xs ${
                      f === 0 ? "bg-[#e8eef3]" : "bg-[#fafafa]"
                    }`}
                  >
                    {hit ? (
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                          hit.isRoot ? "bg-[var(--brand-orange)]" : "bg-[var(--brand-blue)]"
                        }`}
                      >
                        {hit.note.replace("#", "♯")}
                      </span>
                    ) : (
                      <span className="text-[var(--border)]">·</span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Orange = root note · Blue = other scale tones · Nut is the left column (open strings)
          </p>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        All sounds are synthesized in your browser — no copyrighted audio.
      </p>
    </div>
  );
}
