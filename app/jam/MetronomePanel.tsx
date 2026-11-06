"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BeatState = "accent" | "normal" | "mute";
type Subdivision = 1 | 2 | 3 | 4;
type SoundKit = "click" | "woodblock" | "beep" | "cowbell" | "hihat" | "drumstick";

const TIME_SIGS = [
  { beats: 2, note: 4, label: "2/4" },
  { beats: 3, note: 4, label: "3/4" },
  { beats: 4, note: 4, label: "4/4" },
  { beats: 5, note: 4, label: "5/4" },
  { beats: 6, note: 8, label: "6/8" },
  { beats: 7, note: 8, label: "7/8" },
] as const;

const TEMPO_NAMES: { max: number; name: string }[] = [
  { max: 40, name: "Grave" },
  { max: 45, name: "Largo" },
  { max: 50, name: "Larghetto" },
  { max: 55, name: "Adagio" },
  { max: 65, name: "Andante" },
  { max: 76, name: "Andantino" },
  { max: 108, name: "Moderato" },
  { max: 120, name: "Allegretto" },
  { max: 168, name: "Allegro" },
  { max: 200, name: "Presto" },
  { max: 300, name: "Prestissimo" },
];

function tempoName(bpm: number): string {
  for (const t of TEMPO_NAMES) if (bpm <= t.max) return t.name;
  return "Prestissimo";
}

const SOUND_KITS: { id: SoundKit; label: string }[] = [
  { id: "click", label: "Click" },
  { id: "woodblock", label: "Woodblock" },
  { id: "beep", label: "Beep" },
  { id: "cowbell", label: "Cowbell" },
  { id: "hihat", label: "Hi-hat" },
  { id: "drumstick", label: "Drumstick" },
];

const COUNT_WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight"];

function kitFreq(kit: SoundKit, accent: boolean, sub: boolean): { f: number; type: OscillatorType; dur: number; noise?: boolean } {
  if (kit === "hihat" || kit === "drumstick") {
    return { f: accent ? 8000 : sub ? 6000 : 7000, type: "square", dur: accent ? 0.05 : 0.03, noise: true };
  }
  const table: Record<Exclude<SoundKit, "hihat" | "drumstick">, [number, number, OscillatorType]> = {
    click: [1800, 1200, "square"],
    woodblock: [980, 720, "triangle"],
    beep: [880, 660, "sine"],
    cowbell: [740, 540, "square"],
  };
  const [hi, lo, type] = table[kit as Exclude<SoundKit, "hihat" | "drumstick">] ?? [1200, 900, "square"];
  return { f: accent ? hi : sub ? lo * 0.85 : lo, type, dur: accent ? 0.06 : 0.04 };
}

export default function MetronomePanel() {
  const [bpm, setBpm] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [sigIdx, setSigIdx] = useState(2);
  const [subdivision, setSubdivision] = useState<Subdivision>(1);
  const [kit, setKit] = useState<SoundKit>("click");
  const [volume, setVolume] = useState(0.7);
  const [voiceCount, setVoiceCount] = useState(false);
  const [flash, setFlash] = useState(false);
  const [activeBeat, setActiveBeat] = useState(0);
  const [beats, setBeats] = useState<BeatState[]>(["accent", "normal", "normal", "normal"]);

  const audioRef = useRef<AudioContext | null>(null);
  const nextNoteTime = useRef(0);
  const currentBeat = useRef(0);
  const currentSub = useRef(0);
  const timerId = useRef<number | null>(null);
  const scheduleRef = useRef<() => void>(() => {});
  const playingRef = useRef(false);
  const tapTimes = useRef<number[]>([]);
  const voiceBuffers = useRef<Map<string, AudioBuffer>>(new Map());
  const settingsRef = useRef({ bpm, beats, subdivision, kit, volume, voiceCount, sigBeats: 4 });

  const sig = TIME_SIGS[sigIdx];

  const resizeBeats = (count: number) => {
    setBeats((prev) => {
      const next: BeatState[] = Array.from({ length: count }, (_, i) =>
        i < prev.length ? prev[i] : i === 0 ? "accent" : "normal",
      );
      if (next[0] === "mute") next[0] = "accent";
      return next;
    });
    currentBeat.current = 0;
    currentSub.current = 0;
    setActiveBeat(0);
  };

  useEffect(() => {
    settingsRef.current = {
      bpm,
      beats,
      subdivision,
      kit,
      volume,
      voiceCount,
      sigBeats: sig.beats,
    };
  }, [bpm, beats, subdivision, kit, volume, voiceCount, sig.beats]);

  const ensureAudio = useCallback(async () => {
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    if (audioRef.current.state === "suspended") await audioRef.current.resume();
    return audioRef.current;
  }, []);

  const loadVoice = useCallback(async (ctx: AudioContext, word: string) => {
    if (voiceBuffers.current.has(word)) return voiceBuffers.current.get(word)!;
    // Prefer speechSynthesis → MediaRecorder capture is heavy; use oscillator-free
    // speechSynthesis utterance timed separately. For Web Audio scheduling we
    // synthesize a short "spoken" blip + trigger speechSynthesis as soft fallback.
    // Pre-generate a tiny placeholder buffer so scheduling stays sample-accurate;
    // actual word is spoken via speechSynthesis near the beat when available.
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    voiceBuffers.current.set(word, buf);
    return buf;
  }, []);

  const playClick = useCallback(
    (ctx: AudioContext, time: number, accent: boolean, isSub: boolean, beatIndex: number) => {
      const { kit: k, volume: vol, voiceCount: vc } = settingsRef.current;
      const spec = kitFreq(k, accent, isSub);
      const master = ctx.createGain();
      master.gain.value = vol * (accent ? 1 : isSub ? 0.35 : 0.65);
      master.connect(ctx.destination);

      if (spec.noise) {
        const len = Math.floor(ctx.sampleRate * spec.dur);
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const bp = ctx.createBiquadFilter();
        bp.type = "highpass";
        bp.frequency.value = accent ? 5000 : 3500;
        src.connect(bp);
        bp.connect(master);
        src.start(time);
        src.stop(time + spec.dur);
      } else {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = spec.type;
        osc.frequency.setValueAtTime(spec.f, time);
        g.gain.setValueAtTime(1, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + spec.dur);
        osc.connect(g);
        g.connect(master);
        osc.start(time);
        osc.stop(time + spec.dur + 0.01);
      }

      if (vc && !isSub && typeof window !== "undefined" && window.speechSynthesis) {
        const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
        const word = COUNT_WORDS[beatIndex] ?? String(beatIndex + 1);
        window.setTimeout(() => {
          try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(word);
            u.rate = 1.25;
            u.pitch = accent ? 1.15 : 1;
            u.volume = Math.min(1, vol);
            window.speechSynthesis.speak(u);
          } catch {
            /* ignore */
          }
        }, delayMs);
      }

      void loadVoice(ctx, COUNT_WORDS[beatIndex] ?? "one");
    },
    [loadVoice],
  );

  const schedule = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx || !playingRef.current) return;
    const lookAhead = 0.1;
    const scheduleAhead = 0.25;

    while (nextNoteTime.current < ctx.currentTime + scheduleAhead) {
      const { bpm: b, beats: bt, subdivision: sub, sigBeats } = settingsRef.current;
      const secondsPerBeat = 60.0 / b;
      const secondsPerSub = secondsPerBeat / sub;
      const beatIdx = currentBeat.current;
      const subIdx = currentSub.current;
      const state = bt[beatIdx] ?? "normal";
      const isSub = subIdx > 0;

      if (state !== "mute" || isSub) {
        if (!(state === "mute" && !isSub)) {
          if (!isSub || state !== "mute") {
            const accent = !isSub && state === "accent";
            if (!(isSub && state === "mute")) {
              playClick(ctx, nextNoteTime.current, accent, isSub, beatIdx);
            }
          }
        }
      }

      if (!isSub) {
        const t = nextNoteTime.current;
        const delay = Math.max(0, (t - ctx.currentTime) * 1000);
        window.setTimeout(() => {
          if (!playingRef.current) return;
          setActiveBeat(beatIdx);
          setFlash(true);
          window.setTimeout(() => setFlash(false), 80);
        }, delay);
      }

      nextNoteTime.current += secondsPerSub;
      currentSub.current += 1;
      if (currentSub.current >= sub) {
        currentSub.current = 0;
        currentBeat.current = (beatIdx + 1) % sigBeats;
      }
    }

    timerId.current = window.setTimeout(() => scheduleRef.current(), lookAhead * 1000);
  }, [playClick]);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (timerId.current != null) {
      window.clearTimeout(timerId.current);
      timerId.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const start = useCallback(async () => {
    const ctx = await ensureAudio();
    currentBeat.current = 0;
    currentSub.current = 0;
    nextNoteTime.current = ctx.currentTime + 0.05;
    playingRef.current = true;
    setPlaying(true);
    setActiveBeat(0);
    scheduleRef.current();
  }, [ensureAudio]);

  const toggle = useCallback(() => {
    if (playingRef.current) stop();
    else void start();
  }, [start, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable)
        return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  useEffect(() => () => stop(), [stop]);

  const nudge = (d: number) => setBpm((v) => Math.min(300, Math.max(30, v + d)));

  const onTap = () => {
    const now = performance.now();
    const taps = tapTimes.current.filter((t) => now - t < 3000);
    taps.push(now);
    tapTimes.current = taps;
    if (taps.length < 2) return;
    const intervals: number[] = [];
    for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    setBpm(Math.min(300, Math.max(30, Math.round(60000 / avg))));
  };

  const cycleBeat = (i: number) => {
    setBeats((prev) => {
      const next = [...prev];
      const order: BeatState[] = ["accent", "normal", "mute"];
      const cur = order.indexOf(next[i]);
      next[i] = order[(cur + 1) % order.length];
      return next;
    });
  };

  const pct = ((bpm - 30) / (300 - 30)) * 100;

  return (
    <div className="space-y-6">
      <div
        className={`relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-b from-[#0b1c2c] to-[#132a40] p-6 sm:p-8 text-white shadow-lg transition-shadow ${
          flash ? "shadow-[0_0_40px_rgba(232,150,46,0.45)]" : ""
        }`}
      >
        <div
          className={`pointer-events-none absolute inset-0 bg-[var(--brand-orange)]/20 transition-opacity duration-75 ${
            flash ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />

        <div className="relative flex flex-col items-center gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">{tempoName(bpm)}</p>
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => nudge(-1)}
              className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl hover:bg-white/20"
              aria-label="Slower"
            >
              −
            </button>
            <div className="text-center min-w-[8rem]">
              <div className="text-7xl sm:text-8xl font-bold tabular-nums leading-none tracking-tight">{bpm}</div>
              <div className="mt-1 text-sm text-white/60">BPM</div>
            </div>
            <button
              type="button"
              onClick={() => nudge(1)}
              className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl hover:bg-white/20"
              aria-label="Faster"
            >
              +
            </button>
          </div>

          <input
            type="range"
            min={30}
            max={300}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="mt-4 w-full max-w-md accent-[var(--brand-orange)]"
            aria-label="Tempo"
            style={{ background: `linear-gradient(to right, var(--brand-orange) ${pct}%, rgba(255,255,255,0.15) ${pct}%)` }}
          />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className={`rounded-full px-10 py-3.5 text-base font-semibold shadow-md transition ${
                playing
                  ? "bg-white text-[#0b1c2c] hover:bg-white/90"
                  : "bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white"
              }`}
            >
              {playing ? "Stop" : "Start"}
            </button>
            <button
              type="button"
              onClick={onTap}
              className="rounded-full border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-medium hover:bg-white/10"
            >
              Tap tempo
            </button>
          </div>
          <p className="mt-2 text-xs text-white/40">Spacebar starts and stops</p>
        </div>

        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          {beats.map((state, i) => (
            <button
              key={i}
              type="button"
              onClick={() => cycleBeat(i)}
              aria-label={`Beat ${i + 1}: ${state}. Tap to change.`}
              className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 text-lg font-semibold transition-all ${
                activeBeat === i && playing
                  ? "scale-110 border-[var(--brand-orange)] bg-[var(--brand-orange)] text-white shadow-lg shadow-[var(--brand-orange)]/40"
                  : state === "accent"
                    ? "border-[var(--brand-blue)] bg-[var(--brand-blue)]/30 text-white"
                    : state === "mute"
                      ? "border-white/20 bg-transparent text-white/30 line-through"
                      : "border-white/30 bg-white/10 text-white/80"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="relative mt-3 text-center text-xs text-white/40">
          Tap a beat: accent → normal → mute
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Time signature</span>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
            value={sigIdx}
            onChange={(e) => {
              const idx = Number(e.target.value);
              setSigIdx(idx);
              resizeBeats(TIME_SIGS[idx].beats);
            }}
          >
            {TIME_SIGS.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Subdivision</span>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
            value={subdivision}
            onChange={(e) => setSubdivision(Number(e.target.value) as Subdivision)}
          >
            <option value={1}>Quarter notes</option>
            <option value={2}>Eighth notes</option>
            <option value={3}>Triplets</option>
            <option value={4}>Sixteenth notes</option>
          </select>
        </label>

        <label className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Sound</span>
          <select
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
            value={kit}
            onChange={(e) => setKit(e.target.value as SoundKit)}
          >
            {SOUND_KITS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
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
            className="mt-4 w-full accent-[var(--brand-blue)]"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 cursor-pointer sm:col-span-2 lg:col-span-2">
          <input
            type="checkbox"
            checked={voiceCount}
            onChange={(e) => setVoiceCount(e.target.checked)}
            className="h-5 w-5 accent-[var(--brand-blue)]"
          />
          <span>
            <span className="block text-sm font-medium">Voice counting</span>
            <span className="block text-xs text-[var(--muted)]">Says “one, two, three…” on each beat</span>
          </span>
        </label>
      </div>
    </div>
  );
}
