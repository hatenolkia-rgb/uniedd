"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FIRST_STRING,
  KEYS,
  KEY_LABELS,
  SWARAS,
  SWARMANDAL_SCALES,
  defaultStrings,
  noteName,
  swar,
  type StringSpec,
  type SwarId,
} from "./theory";
import { MAX_BPM, MIN_BPM, TAALS, bolLabel, clampBpm, laya, matraInfo } from "./taals";
import { TanpuraTablaEngine, renderOffline, tanpuraFrequencies, usesRecording, type LoopInfo, type TablaSettings, type TanpuraSettings } from "./engine";
import { estimatePitch } from "./synth";
import "./tanpura.css";

const SETTINGS_KEY = "uniedd-tanpura-tabla-v1";
const PRESETS_KEY = "uniedd-tanpura-tabla-presets-v1";

type Saved = { tanpura: TanpuraSettings; tabla: TablaSettings };
type Preset = Saved & { name: string };

const DEFAULT_TANPURA: TanpuraSettings = {
  source: "recorded",
  key: 1,
  voice: "male",
  octaveShift: 0,
  cents: 0,
  a4: 440,
  temperament: "just",
  first: "P",
  count: 4,
  strings: defaultStrings(4, "P"),
  cycle: 5,
  jawari: 0.65,
  reverb: 0.35,
  volume: 0.8,
  shimmer: false,
  shimmerScale: "sapa",
  shimmerVolume: 0.5,
};

const DEFAULT_TABLA: TablaSettings = {
  mode: "strokes",
  taal: "teentaal",
  bpm: 120,
  volume: 0.8,
  bayan: 0.85,
  tune: "S",
  tuneCents: 0,
  humanize: 0.6,
  loop: "groove-80-2",
};

const TIMERS = [0, 5, 10, 15, 20, 30, 45, 60];

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    if (!v?.tanpura?.strings?.length || !v?.tabla?.taal) return null;
    return { tanpura: { ...DEFAULT_TANPURA, ...v.tanpura }, tabla: { ...DEFAULT_TABLA, ...v.tabla } };
  } catch {
    return null;
  }
}

function readPresets(): Preset[] {
  try {
    const v = JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function octaveWord(o: number) {
  return o < 0 ? "low" : o > 0 ? "high" : "middle";
}

declare global {
  interface Window {
    __tanpuraTabla?: {
      renderOffline: typeof renderOffline;
      defaults: { tanpura: TanpuraSettings; tabla: TablaSettings };
      defaultStrings: typeof defaultStrings;
      frequencies: typeof tanpuraFrequencies;
      taals: typeof TAALS;
      estimatePitch: typeof estimatePitch;
    };
  }
}

export default function TanpuraTabla() {
  const [tanpura, setTanpura] = useState<TanpuraSettings>(DEFAULT_TANPURA);
  const [tabla, setTabla] = useState<TablaSettings>(DEFAULT_TABLA);
  const [loaded, setLoaded] = useState(false);
  const [tanOn, setTanOn] = useState(false);
  const [tabOn, setTabOn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [kitState, setKitState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [matra, setMatra] = useState<{ matra: number; avartan: number } | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [timerMin, setTimerMin] = useState(0);
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [loops, setLoops] = useState<LoopInfo[]>([]);
  const [showMixer, setShowMixer] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tanpuraErr, setTanpuraErr] = useState<string | null>(null);

  const engineRef = useRef<TanpuraTablaEngine | null>(null);
  const stringEls = useRef<(SVGLineElement | null)[]>([]);
  const glowEls = useRef<(SVGLineElement | null)[]>([]);
  const dayanEl = useRef<HTMLDivElement | null>(null);
  const bayanEl = useRef<HTMLDivElement | null>(null);

  // load saved settings + presets once (client only)
  useEffect(() => {
    const saved = readSaved();
    const ps = readPresets();
    queueMicrotask(() => {
      if (saved) {
        setTanpura(saved.tanpura);
        setTabla(saved.tabla);
      }
      setPresets(ps);
      setLoaded(true);
    });
    window.__tanpuraTabla = {
      renderOffline,
      defaults: { tanpura: DEFAULT_TANPURA, tabla: DEFAULT_TABLA },
      defaultStrings,
      frequencies: tanpuraFrequencies,
      taals: TAALS,
      estimatePitch,
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ tanpura, tabla }));
    } catch {}
  }, [tanpura, tabla, loaded]);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      const eng = new TanpuraTablaEngine(DEFAULT_TANPURA, DEFAULT_TABLA);
      eng.listener = {
        onPluck: (i) => {
          for (const el of [stringEls.current[i], glowEls.current[i]]) {
            if (!el) continue;
            const cls = el === stringEls.current[i] ? "tt-pluck" : "tt-glow";
            el.classList.remove(cls);
            void el.getBoundingClientRect();
            el.classList.add(cls);
          }
        },
        onMatra: (e) => {
          if (e.sub === 0) setMatra({ matra: e.matra, avartan: e.avartan });
          for (const [want, el] of [[e.dayan, dayanEl.current], [e.bayan, bayanEl.current]] as const) {
            if (!want || !el) continue;
            el.classList.remove("tt-hit");
            void el.offsetWidth;
            el.classList.add("tt-hit");
          }
        },
        onKit: (s, msg) => {
          setKitState(s);
          if (s === "error") setError(`Couldn't load the tabla sounds (${msg ?? "network"}). Check your connection and try again.`);
        },
      };
      engineRef.current = eng;
    }
    return engineRef.current;
  }, []);

  // push settings into the engine
  useEffect(() => {
    engineRef.current?.setTanpura(tanpura);
  }, [tanpura]);
  useEffect(() => {
    engineRef.current?.setTabla(tabla);
  }, [tabla]);

  useEffect(() => () => engineRef.current?.dispose(), []);

  // countdown display
  useEffect(() => {
    if (!timerEnd) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timerEnd]);

  const start = useCallback(
    async (what: "tanpura" | "tabla" | "both") => {
      setError(null);
      const eng = getEngine();
      eng.tanpura = tanpura;
      eng.tabla = tabla;
      try {
        setBusy(what === "tabla" ? "Getting the tabla ready…" : usesRecording(tanpura) ? "Loading the tanpura recording…" : "Tuning the tanpura…");
        const ctx = await eng.ensureContext();
        eng.setTanpura(tanpura);
        eng.setTabla(tabla);
        const at = ctx.currentTime + 0.15;
        const jobs: Promise<void>[] = [];
        if ((what === "tanpura" || what === "both") && !eng.tanpuraOn) jobs.push(eng.startTanpura(what === "both" ? at : undefined));
        if ((what === "tabla" || what === "both") && !eng.tablaOn) jobs.push(eng.startTabla());
        await Promise.all(jobs);
        setTanOn(eng.tanpuraOn);
        setTabOn(eng.tablaOn);
        setTanpuraErr(eng.recError);
      } catch (e) {
        setError(`Sorry, audio couldn't start: ${(e as Error)?.message ?? e}`);
      } finally {
        setBusy(null);
      }
    },
    [getEngine, tanpura, tabla],
  );

  const stopTanpura = useCallback(() => {
    engineRef.current?.stopTanpura();
    setTanOn(false);
  }, []);
  const stopTabla = useCallback(() => {
    engineRef.current?.stopTabla();
    setTabOn(false);
    setMatra(null);
  }, []);
  const stopAll = useCallback(() => {
    engineRef.current?.stopAll();
    setTanOn(false);
    setTabOn(false);
    setMatra(null);
    setTimerEnd(null);
  }, []);

  // Media Session (lock screen / headset buttons)
  const resumeRef = useRef<{ tan: boolean; tab: boolean }>({ tan: false, tab: false });
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.mediaHandlers = {
      pause: () => {
        resumeRef.current = { tan: eng.tanpuraOn, tab: eng.tablaOn };
        eng.stopTanpura();
        eng.stopTabla();
        setTanOn(false);
        setTabOn(false);
      },
      play: () => {
        const r = resumeRef.current;
        void start(r.tan && r.tab ? "both" : r.tab ? "tabla" : "tanpura");
      },
    };
  }, [start, tanOn, tabOn]);

  const playing = tanOn || tabOn;

  const setTimer = (m: number) => {
    setTimerMin(m);
    const eng = getEngine();
    const end = eng.setStopTimer(m, () => {
      setTanOn(false);
      setTabOn(false);
      setMatra(null);
      setTimerEnd(null);
    });
    setTimerEnd(end);
    setNow(end ? end - m * 60_000 : 0);
  };

  // load loop list when the recording mode is chosen
  useEffect(() => {
    if (tabla.mode !== "recording" || loops.length) return;
    getEngine()
      .loadLoops()
      .then(setLoops)
      .catch(() => setError("Couldn't load the recorded grooves. Check your connection."));
  }, [tabla.mode, loops.length, getEngine]);

  const freqs = useMemo(() => tanpuraFrequencies(tanpura), [tanpura]);
  const taal = TAALS.find((t) => t.id === tabla.taal) ?? TAALS[0];
  const info = useMemo(() => matraInfo(taal), [taal]);
  const loopInfo = loops.find((l) => l.id === tabla.loop) ?? null;

  const updT = (patch: Partial<TanpuraSettings>) => setTanpura((s) => ({ ...s, ...patch }));
  const updB = (patch: Partial<TablaSettings>) => setTabla((s) => ({ ...s, ...patch }));
  const setFirst = (first: SwarId) =>
    setTanpura((s) => ({ ...s, first, strings: s.strings.map((st, i) => (i === 0 ? { ...st, swar: first, octave: first === "S" ? 0 : -1 } : st)) }));
  const setCount = (count: 4 | 5 | 6) => setTanpura((s) => ({ ...s, count, strings: defaultStrings(count, s.first) }));
  const updString = (i: number, patch: Partial<StringSpec>) =>
    setTanpura((s) => ({ ...s, strings: s.strings.map((st, j) => (j === i ? { ...st, ...patch } : st)) }));

  const tap = () => {
    const t = performance.now();
    const recent = [...tapTimes.filter((x) => t - x < 3000), t].slice(-6);
    setTapTimes(recent);
    if (recent.length >= 2) {
      const gaps = recent.slice(1).map((x, i) => x - recent[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      updB({ bpm: clampBpm(60000 / avg) });
    }
  };

  const savePreset = () => {
    const name = presetName.trim() || `${KEYS[tanpura.key]} ${FIRST_STRING.find((f) => f.id === tanpura.first)?.label ?? ""} · ${taal.name} ${tabla.bpm}`;
    const next = [...presets.filter((p) => p.name !== name), { name, tanpura, tabla }].slice(-20);
    setPresets(next);
    setPresetName("");
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    } catch {}
  };
  const loadPreset = (p: Preset) => {
    setTanpura({ ...DEFAULT_TANPURA, ...p.tanpura });
    setTabla({ ...DEFAULT_TABLA, ...p.tabla });
  };
  const deletePreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    } catch {}
  };

  const remaining = timerEnd ? Math.max(0, Math.round((timerEnd - now) / 1000)) : 0;
  const rec = usesRecording(tanpura);
  const recWanted = tanpura.source === "recorded";
  const shownStrings = rec ? defaultStrings(4, tanpura.first) : tanpura.strings;
  const nStr = shownStrings.length;

  return (
    <div className="space-y-6" data-testid="tanpura-tabla">
      {/* ---------- hero / player ---------- */}
      <div className="tt-sky relative overflow-hidden rounded-[2rem] p-5 text-white shadow-xl sm:p-8">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">UNIEDD Riyaz Studio</p>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ fontFamily: "var(--font-playfair), serif" }}>
              Tanpura &amp; Tabla
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/90">
              Pick your Sa, choose a taal, and practise singing or playing with a real-sounding drone and tabla.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-white/20 px-3 py-1 font-semibold" data-testid="sa-readout">
                Sa = {noteName(freqs.sa, tanpura.a4 === 440 ? 440 : tanpura.a4)} · {freqs.sa.toFixed(1)} Hz
              </span>
              <span className="rounded-full bg-white/20 px-3 py-1">
                {rec ? "Real recording" : tanpura.voice === "male" ? "Male · synth" : "Female · synth"} · {nStr} strings · {FIRST_STRING.find((f) => f.id === tanpura.first)?.label}
              </span>
              {tabOn && tabla.mode === "strokes" ? (
                <span className="rounded-full bg-white/20 px-3 py-1">
                  {taal.name} · {tabla.bpm} BPM
                </span>
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => (tanOn ? stopTanpura() : void start("tanpura"))}
                disabled={!!busy}
                className={`rounded-full px-5 py-3 text-sm font-bold shadow-lg transition active:scale-95 ${tanOn ? "bg-white text-fuchsia-700" : "bg-white/95 text-[#b45309] hover:bg-white"}`}
                data-testid="tanpura-toggle"
              >
                {tanOn ? "⏸ Stop tanpura" : "▶ Tanpura"}
              </button>
              <button
                type="button"
                onClick={() => (tabOn ? stopTabla() : void start("tabla"))}
                disabled={!!busy}
                className={`rounded-full px-5 py-3 text-sm font-bold shadow-lg transition active:scale-95 ${tabOn ? "bg-white text-fuchsia-700" : "bg-white/95 text-[#b45309] hover:bg-white"}`}
                data-testid="tabla-toggle"
              >
                {tabOn ? "⏸ Stop tabla" : "▶ Tabla"}
              </button>
              {!playing ? (
                <button
                  type="button"
                  onClick={() => void start("both")}
                  disabled={!!busy}
                  className="rounded-full bg-[#1a9fd4] px-5 py-3 text-sm font-bold shadow-lg ring-2 ring-white/70 transition hover:bg-[#1480b0] active:scale-95"
                  data-testid="both-toggle"
                >
                  ▶ Play both
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopAll}
                  className="rounded-full bg-black/30 px-5 py-3 text-sm font-bold ring-2 ring-white/60 transition hover:bg-black/40 active:scale-95"
                >
                  ■ Stop all
                </button>
              )}
            </div>
            {busy ? <p className="mt-3 text-sm text-white/90">{busy}</p> : null}
            {kitState === "loading" && !busy ? <p className="mt-3 text-sm text-white/90">Loading tabla sounds…</p> : null}
            {timerEnd ? (
              <p className="mt-3 text-sm font-semibold">
                ⏲ Stops in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </p>
            ) : null}
          </div>

          {/* tanpura strings + tabla drums */}
          <div className="flex items-end justify-center gap-5">
            <svg viewBox="0 0 140 230" className="h-52 w-32 drop-shadow-lg sm:h-60 sm:w-36" aria-label="Tanpura strings">
              <defs>
                <linearGradient id="tt-wood" x1="0" x2="1">
                  <stop offset="0" stopColor="#7c2d12" />
                  <stop offset="0.5" stopColor="#b45309" />
                  <stop offset="1" stopColor="#7c2d12" />
                </linearGradient>
              </defs>
              <rect x="52" y="4" width="36" height="150" rx="10" fill="url(#tt-wood)" />
              <ellipse cx="70" cy="178" rx="62" ry="48" fill="url(#tt-wood)" />
              <ellipse cx="70" cy="178" rx="50" ry="38" fill="#92400e" opacity="0.55" />
              <rect x="44" y="196" width="52" height="8" rx="3" fill="#fef3c7" opacity="0.9" />
              {shownStrings.map((s, i) => {
                const x = 70 + (i - (nStr - 1) / 2) * (nStr > 4 ? 6.5 : 8);
                return (
                  <g key={i}>
                    <line
                      ref={(el) => {
                        glowEls.current[i] = el;
                      }}
                      x1={x}
                      y1="10"
                      x2={x}
                      y2="200"
                      stroke="#fde68a"
                      strokeWidth="6"
                      opacity="0"
                      strokeLinecap="round"
                    />
                    <line
                      ref={(el) => {
                        stringEls.current[i] = el;
                      }}
                      className="tt-string"
                      x1={x}
                      y1="10"
                      x2={x}
                      y2="200"
                      stroke={s.on ? "#fffbeb" : "#ffffff55"}
                      strokeWidth={s.octave < 0 ? 1.8 : 1.2}
                    />
                  </g>
                );
              })}
            </svg>
            <div className="flex flex-col items-center gap-2 pb-2">
              <div className="flex items-end gap-2">
                <div
                  ref={bayanEl}
                  className="tt-drum grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-slate-300 to-slate-500 shadow-lg ring-4 ring-amber-900/40 sm:h-20 sm:w-20"
                  aria-hidden
                >
                  <div className="h-7 w-7 rounded-full bg-slate-900/80 sm:h-8 sm:w-8" />
                </div>
                <div
                  ref={dayanEl}
                  className="tt-drum grid h-14 w-14 place-items-center rounded-full bg-gradient-to-b from-amber-200 to-amber-600 shadow-lg ring-4 ring-amber-900/50 sm:h-16 sm:w-16"
                  aria-hidden
                >
                  <div className="h-6 w-6 rounded-full bg-slate-900/85" />
                </div>
              </div>
              <span className="text-xs text-white/85">Bayan · Dayan</span>
            </div>
          </div>
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-white/90 p-3 text-sm font-medium text-red-700">{error}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- tanpura ---------- */}
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm" aria-labelledby="tt-tanpura">
          <h3 id="tt-tanpura" className="text-lg font-bold">
            🪕 Tanpura
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Tanpura sound">
            <Chip on={recWanted} onClick={() => updT({ source: "recorded" })} title="A real tanpura, recorded">
              🎙 Recorded (real)
            </Chip>
            <Chip on={!recWanted} onClick={() => updT({ source: "synth" })} title="Made live in your browser — every control works">
              🎛 Synth
            </Chip>
          </div>
          {recWanted && !rec ? (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="rec-fallback">
              There&apos;s no real recording for the {FIRST_STRING.find((f) => f.id === tanpura.first)?.label} tuning yet, so the synth tanpura plays. Choose Pa, Ma or Ni for the real one.
            </p>
          ) : null}
          {tanpuraErr ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{tanpuraErr}</p> : null}

          <p className="mt-4 text-sm font-semibold">Key (your Sa)</p>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {KEYS.map((k, i) => (
              <button
                key={k}
                type="button"
                onClick={() => updT({ key: i })}
                title={KEY_LABELS[i]}
                className={`rounded-xl px-1 py-2 text-sm font-semibold transition ${
                  tanpura.key === i ? "tt-pop bg-fuchsia-600 text-white shadow" : k.includes("#") ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-amber-50 text-slate-800 hover:bg-amber-100"
                }`}
                aria-pressed={tanpura.key === i}
              >
                {k.replace("#", "♯")}
              </button>
            ))}
          </div>

          {rec ? (
            <p className="mt-3 text-xs text-[var(--muted)]" data-testid="rec-register">
              A real 4-string tanpura, tuned to your key. It sounds in its natural register (Sa = {noteName(freqs.sa, tanpura.a4)}), which suits
              men&apos;s and women&apos;s voices alike — for women it is the same Sa an octave lower. For a higher tanpura, switch to Synth and choose Female.
            </p>
          ) : null}
          {!rec ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">Tanpura</p>
              <div className="mt-2 flex gap-1.5">
                {(["male", "female"] as const).map((v) => (
                  <Chip key={v} on={tanpura.voice === v} onClick={() => updT({ voice: v })}>
                    {v === "male" ? "👨 Male" : "👩 Female"}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Octave</p>
              <div className="mt-2 flex gap-1.5">
                {([-1, 0, 1] as const).map((o) => (
                  <Chip key={o} on={tanpura.octaveShift === o} onClick={() => updT({ octaveShift: o })}>
                    {o === -1 ? "Lower" : o === 0 ? "Normal" : "Higher"}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
          ) : null}

          <p className="mt-4 text-sm font-semibold">First string</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FIRST_STRING.map((f) => (
              <Chip key={f.id} on={tanpura.first === f.id} onClick={() => setFirst(f.id)} title={f.hint}>
                {f.label}
              </Chip>
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{FIRST_STRING.find((f) => f.id === tanpura.first)?.hint}</p>

          {!rec ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">Strings</p>
              <div className="mt-2 flex gap-1.5">
                {([4, 5, 6] as const).map((n) => (
                  <Chip key={n} on={nStr === n} onClick={() => setCount(n)}>
                    {n}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Tuning</p>
              <div className="mt-2 flex gap-1.5">
                <Chip on={tanpura.temperament === "just"} onClick={() => updT({ temperament: "just" })} title="Pure natural intervals, like a real tanpura">
                  Natural
                </Chip>
                <Chip on={tanpura.temperament === "equal"} onClick={() => updT({ temperament: "equal" })} title="Matches a keyboard or harmonium">
                  Keyboard
                </Chip>
              </div>
            </div>
          </div>
          ) : null}

          <div className="mt-4 space-y-3">
            <Slider label="Fine tune" value={tanpura.cents} min={-50} max={50} step={1} fmt={(v) => `${v > 0 ? "+" : ""}${v} cents`} onChange={(v) => updT({ cents: v })} />
            <Slider label="A4 reference" value={tanpura.a4} min={432} max={445} step={0.5} fmt={(v) => `${v} Hz`} onChange={(v) => updT({ a4: v })} />
            {!rec ? (
              <>
            <Slider label="Speed" value={11 - tanpura.cycle} min={1} max={8.5} step={0.25} fmt={() => `${tanpura.cycle.toFixed(1)} s per round`} onChange={(v) => updT({ cycle: Math.round((11 - v) * 100) / 100 })} />
            <Slider label="Jawari (buzz)" value={tanpura.jawari} min={0} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => updT({ jawari: v })} />
              </>
            ) : null}
            <Slider label="Reverb" value={tanpura.reverb} min={0} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => updT({ reverb: v })} />
            <Slider label="Tanpura volume" value={tanpura.volume} min={0} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => updT({ volume: v })} />
          </div>

          <div className="mt-4 rounded-2xl bg-amber-50 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={tanpura.shimmer} onChange={(e) => updT({ shimmer: e.target.checked })} className="h-4 w-4 accent-fuchsia-600" />
              ✨ Swarmandal shimmer
            </label>
            {tanpura.shimmer ? (
              <div className="mt-2 space-y-2">
                <select
                  value={tanpura.shimmerScale}
                  onChange={(e) => updT({ shimmerScale: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  aria-label="Swarmandal scale"
                >
                  {SWARMANDAL_SCALES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <Slider label="Shimmer volume" value={tanpura.shimmerVolume} min={0} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => updT({ shimmerVolume: v })} />
              </div>
            ) : null}
          </div>

          {!rec ? (
          <>
          <button type="button" onClick={() => setShowMixer((v) => !v)} className="mt-4 text-sm font-semibold text-[var(--brand-blue)] hover:underline" aria-expanded={showMixer}>
            {showMixer ? "▾" : "▸"} String mixer (each string&apos;s note, volume and fine tune)
          </button>
          {showMixer ? (
            <div className="mt-3 space-y-3">
              {tanpura.strings.map((s, i) => (
                <div key={i} className="rounded-2xl border border-[var(--border)] p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex items-center gap-1.5 font-semibold">
                      <input type="checkbox" checked={s.on} onChange={(e) => updString(i, { on: e.target.checked })} className="h-4 w-4 accent-fuchsia-600" />
                      String {i + 1}
                    </label>
                    <select
                      value={s.swar}
                      onChange={(e) => updString(i, { swar: e.target.value as SwarId })}
                      className="rounded-lg border border-[var(--border)] px-2 py-1"
                      aria-label={`String ${i + 1} note`}
                    >
                      {SWARAS.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={s.octave}
                      onChange={(e) => updString(i, { octave: Number(e.target.value) as -1 | 0 | 1 })}
                      className="rounded-lg border border-[var(--border)] px-2 py-1"
                      aria-label={`String ${i + 1} octave`}
                    >
                      <option value={-1}>Low</option>
                      <option value={0}>Middle</option>
                      <option value={1}>High</option>
                    </select>
                    <span className="ml-auto text-xs text-[var(--muted)]">{noteName(freqs.strings[i], tanpura.a4)}</span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Slider label="Volume" value={s.volume} min={0} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => updString(i, { volume: v })} />
                    <Slider label="Fine" value={s.cents} min={-25} max={25} step={1} fmt={(v) => `${v > 0 ? "+" : ""}${v}¢`} onChange={(v) => updString(i, { cents: v })} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-[var(--muted)]">
            Strings: {tanpura.strings.map((s) => `${swar(s.swar).short} (${octaveWord(s.octave)})`).join(" · ")}
          </p>
          </>
          ) : (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Strings: {shownStrings.map((s) => `${swar(s.swar).short} (${octaveWord(s.octave)})`).join(" · ")} · natural plucking speed
            </p>
          )}
        </section>

        {/* ---------- tabla ---------- */}
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm" aria-labelledby="tt-tabla">
          <h3 id="tt-tabla" className="text-lg font-bold">
            🥁 Tabla
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip on={tabla.mode === "strokes"} onClick={() => updB({ mode: "strokes" })}>
              Any taal · any tempo
            </Chip>
            <Chip on={tabla.mode === "recording"} onClick={() => updB({ mode: "recording" })}>
              Real recorded grooves
            </Chip>
          </div>

          {tabla.mode === "strokes" ? (
            <>
              <p className="mt-4 text-sm font-semibold">Taal</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {TAALS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => updB({ taal: t.id, ...(tabOn ? {} : { bpm: t.bpm }) })}
                    className={`rounded-2xl px-3 py-2 text-left text-sm transition ${tabla.taal === t.id ? "tt-pop bg-fuchsia-600 text-white shadow" : "bg-fuchsia-50 text-slate-800 hover:bg-fuchsia-100"}`}
                    aria-pressed={tabla.taal === t.id}
                  >
                    <span className="block font-semibold">{t.name}</span>
                    <span className={`text-xs ${tabla.taal === t.id ? "text-white/85" : "text-[var(--muted)]"}`}>{t.matras} matras</span>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{taal.feel}</p>

              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Tempo</span>
                  <span className="text-[var(--muted)]">{laya(tabla.bpm)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => updB({ bpm: clampBpm(tabla.bpm - 1) })} className="h-9 w-9 rounded-full bg-slate-100 font-bold" aria-label="Slower">
                    −
                  </button>
                  <input
                    type="range"
                    min={MIN_BPM}
                    max={MAX_BPM}
                    value={tabla.bpm}
                    onChange={(e) => updB({ bpm: Number(e.target.value) })}
                    className="tt-range"
                    aria-label="Tempo in BPM"
                  />
                  <button type="button" onClick={() => updB({ bpm: clampBpm(tabla.bpm + 1) })} className="h-9 w-9 rounded-full bg-slate-100 font-bold" aria-label="Faster">
                    +
                  </button>
                  <span className="w-16 text-right text-lg font-bold tabular-nums" data-testid="bpm">
                    {tabla.bpm}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[40, 60, 80, 100, 120, 160, 200, 260].map((b) => (
                    <button key={b} type="button" onClick={() => updB({ bpm: b })} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs hover:bg-slate-200">
                      {b}
                    </button>
                  ))}
                  <button type="button" onClick={tap} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold hover:bg-amber-200">
                    👆 Tap tempo
                  </button>
                </div>
              </div>

              {/* matra grid */}
              <div className="mt-5" aria-live="off">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">Theka</p>
                  <p className="text-sm tabular-nums" data-testid="matra-counter">
                    {matra && tabOn ? (
                      <>
                        Matra <b className="text-lg text-fuchsia-700">{matra.matra + 1}</b> / {taal.matras} · round {matra.avartan + 1}
                      </>
                    ) : (
                      <span className="text-[var(--muted)]">{taal.matras} matras</span>
                    )}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {taal.vibhags.map((len, v) => {
                    const startIdx = taal.vibhags.slice(0, v).reduce((a, b) => a + b, 0);
                    const mark = taal.marks[v];
                    const isSam = v === 0;
                    return (
                      <div key={v} className="rounded-2xl bg-slate-50 p-1.5">
                        <div className="mb-1 flex items-center gap-1 px-1 text-xs font-bold">
                          <span
                            className={`grid h-5 min-w-5 place-items-center rounded-full px-1 ${
                              isSam ? "bg-fuchsia-600 text-white" : mark === "0" ? "bg-sky-200 text-sky-900" : "bg-amber-200 text-amber-900"
                            }`}
                          >
                            {isSam ? (taal.samIsKhali ? "X/0" : "X") : mark}
                          </span>
                          <span className="text-[var(--muted)]">{isSam ? (taal.samIsKhali ? "sam · wave 👋" : "sam · clap 👏") : mark === "0" ? "khali · wave 👋" : "tali · clap 👏"}</span>
                        </div>
                        <div className="flex gap-1">
                          {Array.from({ length: len }, (_, j) => {
                            const idx = startIdx + j;
                            const on = !!matra && tabOn && matra.matra === idx;
                            return (
                              <div
                                key={idx}
                                className={`tt-matra min-w-[2.6rem] rounded-xl px-1.5 py-1.5 text-center ${
                                  on ? "tt-matra-on bg-fuchsia-600 text-white" : info[idx].first ? "bg-white ring-1 ring-fuchsia-200" : "bg-white ring-1 ring-slate-200"
                                }`}
                              >
                                <div className={`text-[10px] ${on ? "text-white/80" : "text-[var(--muted)]"}`}>{idx + 1}</div>
                                <div className="text-xs font-semibold leading-tight">{bolLabel(taal.theka[idx])}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-[var(--muted)]">
                Studio recordings of a real tabla player — an 8 or 16-beat groove (Keherwa-style feel). These play at their recorded tempo.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {loops.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => updB({ loop: l.id })}
                    className={`rounded-2xl px-3 py-2 text-left text-sm transition ${tabla.loop === l.id ? "tt-pop bg-fuchsia-600 text-white shadow" : "bg-fuchsia-50 hover:bg-fuchsia-100"}`}
                    aria-pressed={tabla.loop === l.id}
                  >
                    <span className="block font-semibold">
                      Groove {l.id.split("-")[2]} · {l.bpm} BPM
                    </span>
                    <span className={`text-xs ${tabla.loop === l.id ? "text-white/85" : "text-[var(--muted)]"}`}>{l.beats} beats</span>
                  </button>
                ))}
                {!loops.length ? <p className="text-sm text-[var(--muted)]">Loading grooves…</p> : null}
              </div>
              {loopInfo ? (
                <div className="mt-4 flex flex-wrap gap-1">
                  {Array.from({ length: loopInfo.beats }, (_, i) => (
                    <div
                      key={i}
                      className={`tt-matra grid h-9 w-9 place-items-center rounded-xl text-xs font-semibold ${
                        matra && tabOn && matra.matra === i ? "tt-matra-on bg-fuchsia-600 text-white" : i === 0 ? "bg-white ring-2 ring-fuchsia-300" : "bg-white ring-1 ring-slate-200"
                      }`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-5 space-y-3">
            <Slider label="Tabla volume" value={tabla.volume} min={0} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => updB({ volume: v })} />
            <Slider label="Bayan (bass drum)" value={tabla.bayan} min={0} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => updB({ bayan: v })} />
            {tabla.mode === "strokes" ? (
              <>
                <Slider label="Human feel" value={tabla.humanize} min={0} max={1} step={0.01} fmt={(v) => (v < 0.05 ? "Machine-tight" : `${Math.round(v * 100)}%`)} onChange={(v) => updB({ humanize: v })} />
                <div>
                  <p className="text-sm font-semibold">Tabla tuned to</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip on={tabla.tune === "S"} onClick={() => updB({ tune: "S" })}>
                      Sa (your key)
                    </Chip>
                    <Chip on={tabla.tune === "P"} onClick={() => updB({ tune: "P" })}>
                      Pa
                    </Chip>
                    <Chip on={tabla.tune === "off"} onClick={() => updB({ tune: "off" })}>
                      Natural
                    </Chip>
                  </div>
                </div>
                {tabla.tune !== "off" ? (
                  <Slider label="Tabla fine tune" value={tabla.tuneCents} min={-50} max={50} step={1} fmt={(v) => `${v > 0 ? "+" : ""}${v} cents`} onChange={(v) => updB({ tuneCents: v })} />
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      </div>

      {/* ---------- presets + timer ---------- */}
      <section className="grid gap-6 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-sm md:grid-cols-2" aria-label="Presets and timer">
        <div>
          <h3 className="text-lg font-bold">⭐ My presets</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">Saved in this browser on this device.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Name, e.g. Yaman practice"
              maxLength={40}
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              aria-label="Preset name"
            />
            <button type="button" onClick={savePreset} className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700">
              Save
            </button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {presets.map((p) => (
              <li key={p.name} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <button type="button" onClick={() => loadPreset(p)} className="flex-1 truncate text-left font-medium hover:text-fuchsia-700">
                  {p.name}
                </button>
                <span className="text-xs text-[var(--muted)]">{KEYS[p.tanpura.key]}</span>
                <button type="button" onClick={() => deletePreset(p.name)} className="text-xs text-red-600 hover:underline" aria-label={`Delete ${p.name}`}>
                  Delete
                </button>
              </li>
            ))}
            {!presets.length ? <li className="text-sm text-[var(--muted)]">No presets yet — set things up and press Save.</li> : null}
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-bold">⏲ Practice timer</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">Fades out and stops by itself.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TIMERS.map((m) => (
              <Chip key={m} on={timerMin === m && (m === 0 || !!timerEnd)} onClick={() => setTimer(m)}>
                {m === 0 ? "Off" : `${m} min`}
              </Chip>
            ))}
          </div>
          <ul className="mt-4 space-y-1 text-xs text-[var(--muted)]">
            <li>🎧 Headphones sound best. Keep the volume comfortable.</li>
            <li>📱 On most Android phones it keeps playing with the screen off and shows lock-screen controls. On iPhone, keep this page open.</li>
            <li>🔒 Everything plays on your device — nothing is recorded.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition active:scale-95 ${on ? "bg-fuchsia-600 text-white shadow" : "bg-slate-100 text-slate-800 hover:bg-slate-200"}`}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-[var(--muted)]">{fmt(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="tt-range mt-1" />
    </label>
  );
}
