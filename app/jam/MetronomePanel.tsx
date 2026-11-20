"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MetronomeEngine, type EngineSettings, type VoiceId } from "./metronome/engine";
import { SOUND_KITS, type SoundKit } from "./metronome/sounds";
import {
  clampBpm,
  MAX_BPM,
  MIN_BPM,
  MIN_SPOKEN_SUB_GAP,
  secondsPerTick,
  tapTempo,
  type BeatState,
  type Subdivision,
} from "./metronome/timeline";

const TIME_SIGS = [
  { beats: 2, label: "2/4" },
  { beats: 3, label: "3/4" },
  { beats: 4, label: "4/4" },
  { beats: 5, label: "5/4" },
  { beats: 6, label: "6/8" },
  { beats: 7, label: "7/8" },
] as const;

const SUBDIVISIONS: { value: Subdivision; label: string; spoken: string }[] = [
  { value: 1, label: "Quarter notes", spoken: "1 2 3 4" },
  { value: 2, label: "Eighth notes", spoken: "1 and 2 and" },
  { value: 3, label: "Triplets", spoken: "1 trip-let 2 trip-let" },
  { value: 4, label: "Sixteenth notes", spoken: "1 e and a" },
];

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
];
const tempoName = (bpm: number) => TEMPO_NAMES.find((t) => bpm <= t.max)?.name ?? "Prestissimo";

const STORAGE_KEY = "uniedd-metronome-v2";

interface Saved {
  bpm: number;
  sigIdx: number;
  subdivision: Subdivision;
  beats: BeatState[];
  accent: boolean;
  kit: SoundKit;
  clickOn: boolean;
  clickVolume: number;
  voiceOn: boolean;
  voiceVolume: number;
  voice: VoiceId;
  voiceSubdivisions: boolean;
}

const DEFAULTS: Saved = {
  bpm: 100,
  sigIdx: 2,
  subdivision: 1,
  beats: ["accent", "normal", "normal", "normal"],
  accent: true,
  kit: "click",
  clickOn: true,
  clickVolume: 0.8,
  voiceOn: false,
  voiceVolume: 0.85,
  voice: "female",
  voiceSubdivisions: true,
};

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
        on ? "bg-[var(--brand-blue)]" : "bg-[var(--border)]"
      }`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function MetronomePanel() {
  const [s, setS] = useState<Saved>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1);
  const [pulse, setPulse] = useState(0);
  const [voiceState, setVoiceState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const engineRef = useRef<MetronomeEngine | null>(null);
  const tapTimes = useRef<number[]>([]);

  const sig = TIME_SIGS[s.sigIdx] ?? TIME_SIGS[2];

  const engineSettings = (v: Saved): EngineSettings => ({
    bpm: v.bpm,
    beats: v.beats,
    subdivision: v.subdivision,
    accent: v.accent,
    voiceSubdivisions: v.voiceSubdivisions,
    kit: v.kit,
    clickOn: v.clickOn,
    clickVolume: v.clickVolume,
    voiceOn: v.voiceOn,
    voiceVolume: v.voiceVolume,
    voice: v.voice,
  });

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine(engineSettings(s));
      engineRef.current.onVoiceState = setVoiceState;
    }
    return engineRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // restore saved settings after mount (keeps server and client HTML identical)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Saved>) };
        v.bpm = clampBpm(v.bpm);
        const n = (TIME_SIGS[v.sigIdx] ?? TIME_SIGS[2]).beats;
        if (!Array.isArray(v.beats) || v.beats.length !== n) v.beats = DEFAULTS.beats.slice(0, 1).concat(Array(n - 1).fill("normal"));
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setS(v);
      }
    } catch {
      /* ignore bad storage */
    }
    setLoaded(true);
  }, []);

  // push every change to the engine (applies from the next tick; volumes glide in 12 ms) and save it
  useEffect(() => {
    engineRef.current?.update(engineSettings(s));
    if (loaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {
        /* private mode */
      }
    }
  }, [s, loaded]);

  const set = <K extends keyof Saved>(key: K, value: Saved[K]) => setS((p) => ({ ...p, [key]: value }));

  // beat indicator follows what is actually heard (AudioContext clock, latency compensated)
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      const t = engineRef.current?.currentVisualTick();
      if (t) {
        setActiveBeat(t.beat);
        setPulse((p) => p + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setPlaying(false);
    setActiveBeat(-1);
  }, []);

  const start = useCallback(() => {
    getEngine().start(); // called inside the tap/key gesture: unlocks audio on iOS
    setPlaying(true);
  }, [getEngine]);

  const toggle = useCallback(() => {
    if (engineRef.current?.isRunning) stop();
    else start();
  }, [start, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || el?.isContentEditable) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  useEffect(
    () => () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    [],
  );

  const setVoiceOn = (on: boolean) => {
    set("voiceOn", on);
    if (on) {
      // inside the gesture: unlock audio and start fetching the voice right away
      const e = getEngine();
      e.unlock();
      e.update({ voiceOn: true });
      void e.loadVoice(s.voice);
    }
  };

  const setVoice = (v: VoiceId) => {
    set("voice", v);
    if (s.voiceOn && engineRef.current?.ctx) void engineRef.current.loadVoice(v);
  };

  const setBpm = (v: number) => set("bpm", clampBpm(v));
  const nudge = (d: number) => setS((p) => ({ ...p, bpm: clampBpm(p.bpm + d) }));

  const onTap = () => {
    const now = performance.now();
    const taps = tapTimes.current.filter((t) => now - t < 2500);
    taps.push(now);
    tapTimes.current = taps;
    const bpm = tapTempo(taps);
    if (bpm) setBpm(bpm);
  };

  const setSig = (idx: number) => {
    const n = TIME_SIGS[idx].beats;
    setS((p) => ({
      ...p,
      sigIdx: idx,
      beats: Array.from({ length: n }, (_, i) => (i < p.beats.length ? p.beats[i] : i === 0 ? "accent" : "normal")),
    }));
  };

  const cycleBeat = (i: number) => {
    setS((p) => {
      const order: BeatState[] = ["accent", "normal", "mute"];
      const beats = [...p.beats];
      beats[i] = order[(order.indexOf(beats[i]) + 1) % order.length];
      return { ...p, beats };
    });
  };

  const pct = ((s.bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100;
  const subsTooFast = s.subdivision > 1 && secondsPerTick(s) < MIN_SPOKEN_SUB_GAP;
  const spoken = s.voiceSubdivisions
    ? SUBDIVISIONS.find((x) => x.value === s.subdivision)!.spoken
    : Array.from({ length: Math.min(4, sig.beats) }, (_, i) => i + 1).join(" ");
  const cardCls = "rounded-2xl border border-[var(--border)] bg-white p-4";
  const labelCls = "text-xs font-medium uppercase tracking-wide text-[var(--muted)]";
  const selectCls = "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm";

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-b from-[#0b1c2c] to-[#132a40] p-6 sm:p-8 text-white shadow-lg">
        {playing && (
          <div
            key={pulse}
            className="pointer-events-none absolute inset-0 bg-[var(--brand-orange)]/20 animate-[metroflash_160ms_ease-out_forwards]"
            aria-hidden
          />
        )}
        <style>{`@keyframes metroflash{from{opacity:${activeBeat === 0 ? 1 : 0.6}}to{opacity:0}}`}</style>

        <div className="relative flex flex-col items-center gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">{tempoName(s.bpm)}</p>
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
              <div className="text-7xl sm:text-8xl font-bold tabular-nums leading-none tracking-tight">{s.bpm}</div>
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
            min={MIN_BPM}
            max={MAX_BPM}
            value={s.bpm}
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
          {s.beats.map((state, i) => (
            <button
              key={i}
              type="button"
              onClick={() => cycleBeat(i)}
              aria-label={`Beat ${i + 1}: ${state}. Tap to change.`}
              className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 text-lg font-semibold transition-all duration-75 ${
                activeBeat === i && playing
                  ? "scale-110 border-[var(--brand-orange)] bg-[var(--brand-orange)] text-white shadow-lg shadow-[var(--brand-orange)]/40"
                  : state === "accent" && s.accent
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
          Tap a beat: accent → normal → mute (mutes the click only; the voice still counts)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={cardCls}>
          <span className={labelCls}>Time signature</span>
          <select className={selectCls} value={s.sigIdx} onChange={(e) => setSig(Number(e.target.value))}>
            {TIME_SIGS.map((t, i) => (
              <option key={t.label} value={i}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className={cardCls}>
          <span className={labelCls}>Subdivision</span>
          <select
            className={selectCls}
            value={s.subdivision}
            onChange={(e) => set("subdivision", Number(e.target.value) as Subdivision)}
          >
            {SUBDIVISIONS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* CLICK layer */}
        <section className={`${cardCls} space-y-4`} aria-label="Click">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Click</h3>
              <p className="text-xs text-[var(--muted)]">The metronome tick</p>
            </div>
            <Toggle on={s.clickOn} onChange={(v) => set("clickOn", v)} label="Click on or off" />
          </div>
          <label className="block">
            <span className={labelCls}>Click volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={s.clickVolume}
              disabled={!s.clickOn}
              onChange={(e) => set("clickVolume", Number(e.target.value))}
              className="mt-3 w-full accent-[var(--brand-blue)] disabled:opacity-40"
              aria-label="Click volume"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Sound</span>
              <select className={selectCls} value={s.kit} onChange={(e) => set("kit", e.target.value as SoundKit)}>
                {SOUND_KITS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5">
              <span className="text-sm">Accent beat 1</span>
              <Toggle on={s.accent} onChange={(v) => set("accent", v)} label="Accent on or off" />
            </div>
          </div>
        </section>

        {/* VOICE layer */}
        <section className={`${cardCls} space-y-4`} aria-label="Voice counting">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Voice counting</h3>
              <p className="text-xs text-[var(--muted)]">
                Says “{spoken}…” on the beat — works with the click on or off
              </p>
            </div>
            <Toggle on={s.voiceOn} onChange={setVoiceOn} label="Voice counting on or off" />
          </div>
          <label className="block">
            <span className={labelCls}>Voice volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={s.voiceVolume}
              disabled={!s.voiceOn}
              onChange={(e) => set("voiceVolume", Number(e.target.value))}
              className="mt-3 w-full accent-[var(--brand-blue)] disabled:opacity-40"
              aria-label="Voice volume"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Voice</span>
              <select className={selectCls} value={s.voice} onChange={(e) => setVoice(e.target.value as VoiceId)}>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>
            <div className="flex items-end justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5">
              <span className="text-sm">Count subdivisions</span>
              <Toggle
                on={s.voiceSubdivisions}
                onChange={(v) => set("voiceSubdivisions", v)}
                label="Count subdivisions on or off"
              />
            </div>
          </div>
          {s.voiceOn && voiceState === "loading" && <p className="text-xs text-[var(--muted)]">Loading voice…</p>}
          {s.voiceOn && voiceState === "error" && (
            <p className="text-xs text-red-600">Couldn’t load the voice. Check your connection and toggle it again.</p>
          )}
          {s.voiceOn && s.voiceSubdivisions && subsTooFast && (
            <p className="text-xs text-[var(--muted)]">Too fast to speak every subdivision — counting beats only.</p>
          )}
        </section>
      </div>
    </div>
  );
}
