"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TUNINGS, centsOff, formatNoteMidi, midiToFreq, nearestNote } from "./musicTheory";
import { PitchTracker, detectPitch } from "./pitchDetect";

export default function TunerPanel() {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tuningId, setTuningId] = useState("standard");
  const [mode, setMode] = useState<"auto" | "string">("auto");
  const [stringIdx, setStringIdx] = useState(0);
  const [freq, setFreq] = useState<number | null>(null);
  const [note, setNote] = useState<string>("—");
  const [cents, setCents] = useState(0);
  const [clarity, setClarity] = useState(0);

  const audioRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const tracker = useRef(new PitchTracker(10));
  const tickRef = useRef<() => void>(() => {});
  const refOscRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);

  const tuning = TUNINGS.find((t) => t.id === tuningId) ?? TUNINGS[0];

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    tracker.current.clear();
    setListening(false);
    setFreq(null);
    setClarity(0);
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioRef.current;
    if (!analyser || !ctx) return;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    const result = detectPitch(buf, ctx.sampleRate, 70, 1100);
    const stable = tracker.current.push(result?.frequency ?? null);
    if (stable != null) {
      setFreq(stable);
      setClarity(result?.clarity ?? 0);
      if (mode === "string") {
        const target = tuning.strings[stringIdx];
        const targetFreq = midiToFreq(target.midi);
        setNote(target.name);
        setCents(centsOff(stable, targetFreq));
      } else {
        // Snap to nearest string in current tuning if close, else chromatic
        let best = nearestNote(stable);
        let bestDiff = Infinity;
        for (const s of tuning.strings) {
          // Also consider octaves of the open string (±1)
          for (const oct of [-12, 0, 12]) {
            const f = midiToFreq(s.midi + oct);
            const c = Math.abs(centsOff(stable, f));
            if (c < bestDiff && c < 50) {
              bestDiff = c;
              best = {
                name: formatNoteMidi(s.midi + oct).replace(/\d+$/, "") || s.name.replace(/\d+$/, ""),
                midi: s.midi + oct,
                targetFreq: f,
                cents: centsOff(stable, f),
                octave: Math.floor((s.midi + oct) / 12) - 1,
              };
              best = {
                ...nearestNote(stable),
                cents: centsOff(stable, f),
                targetFreq: f,
                name: formatNoteMidi(s.midi + oct),
                midi: s.midi + oct,
              };
            }
          }
        }
        if (bestDiff === Infinity) {
          const n = nearestNote(stable);
          setNote(`${n.name}${n.octave}`);
          setCents(n.cents);
        } else {
          setNote(best.name);
          setCents(best.cents);
        }
      }
    }
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, [mode, stringIdx, tuning]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      analyserRef.current = analyser;
      tracker.current.clear();
      setListening(true);
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    } catch {
      setError("Microphone access is needed to tune. Please allow the mic and try again.");
      setListening(false);
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const playReference = async () => {
    const ctx = audioRef.current ?? new AudioContext();
    audioRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    refOscRef.current?.osc.stop();
    const targetMidi =
      mode === "string" ? tuning.strings[stringIdx].midi : nearestNote(freq ?? midiToFreq(tuning.strings[0].midi)).midi;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = midiToFreq(targetMidi);
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.stop(ctx.currentTime + 1.25);
    refOscRef.current = { osc, gain };
  };

  const needle = Math.max(-50, Math.min(50, cents));
  const inTune = Math.abs(cents) < 5 && freq != null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-b from-[#f4f9fd] to-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Guitar tuner</h3>
            <p className="text-sm text-[var(--muted)]">Hold a note near the mic — we’ll show the pitch and cents.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!listening ? (
              <button
                type="button"
                onClick={() => void start()}
                className="rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-6 py-2.5 text-sm font-semibold text-white"
              >
                Start listening
              </button>
            ) : (
              <button
                type="button"
                onClick={stop}
                className="rounded-full border border-[var(--border)] bg-white px-6 py-2.5 text-sm font-semibold"
              >
                Stop
              </button>
            )}
            <button
              type="button"
              onClick={() => void playReference()}
              className="rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-medium"
            >
              Play reference
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-8 flex flex-col items-center">
          <div className="text-6xl sm:text-7xl font-bold tracking-tight tabular-nums">{note}</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {freq != null ? `${freq.toFixed(1)} Hz · clarity ${(clarity * 100).toFixed(0)}%` : "Waiting for a note…"}
          </div>

          {/* Needle */}
          <div className="relative mt-8 h-28 w-full max-w-md">
            <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]" />
            <div className="absolute left-1/2 bottom-0 h-20 w-px -translate-x-1/2 bg-[var(--brand-blue)]/40" />
            <div
              className={`absolute left-1/2 bottom-0 origin-bottom transition-transform duration-75 ${
                inTune ? "text-[var(--brand-blue)]" : "text-[var(--brand-orange)]"
              }`}
              style={{ transform: `translateX(-50%) rotate(${needle * 1.4}deg)` }}
            >
              <div className="h-24 w-1 rounded-full bg-current mx-auto" />
              <div className="mx-auto -mt-1 h-3 w-3 rounded-full bg-current" />
            </div>
            <div className="absolute inset-x-0 top-0 flex justify-between text-xs text-[var(--muted)] px-2">
              <span>−50¢</span>
              <span className={inTune ? "font-semibold text-[var(--brand-blue)]" : ""}>
                {freq != null ? `${cents >= 0 ? "+" : ""}${cents.toFixed(0)}¢` : "—"}
              </span>
              <span>+50¢</span>
            </div>
            {inTune && (
              <p className="absolute -bottom-7 inset-x-0 text-center text-sm font-semibold text-[var(--brand-blue)]">
                In tune ✓
              </p>
            )}
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <label className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Tuning</span>
            <select
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
              value={tuningId}
              onChange={(e) => {
                setTuningId(e.target.value);
                setStringIdx(0);
              }}
            >
              {TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Mode</span>
            <div className="mt-2 flex gap-2">
              {(["auto", "string"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-medium ${
                    mode === m
                      ? "bg-[var(--brand-blue)] text-white"
                      : "border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {m === "auto" ? "Auto" : "Per string"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {tuning.strings.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              type="button"
              onClick={() => {
                setMode("string");
                setStringIdx(i);
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "string" && stringIdx === i
                  ? "bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--foreground)]"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
