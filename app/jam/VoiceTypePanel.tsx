"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  VOICE_TYPES,
  classifyVoiceType,
  formatNoteMidi,
  freqToMidi,
  nearestNote,
} from "./musicTheory";
import { PitchTracker, detectPitch } from "./pitchDetect";

type Step = "intro" | "phrase" | "low" | "high" | "result";

const STEPS: { id: Step; title: string; hint: string }[] = [
  {
    id: "intro",
    title: "Find your voice type",
    hint: "We’ll listen while you sing a short phrase, then your lowest and highest comfortable notes. Takes about a minute.",
  },
  {
    id: "phrase",
    title: "Step 1 · Sing a comfortable phrase",
    hint: "Try “Happy birthday to you” or count “1 2 3 4 5” on “ah” at a volume that feels easy. Keep going for a few seconds.",
  },
  {
    id: "low",
    title: "Step 2 · Sing as low as is comfortable",
    hint: "Slide or hop down slowly. Stop where it still feels easy — don’t strain.",
  },
  {
    id: "high",
    title: "Step 3 · Sing as high as is comfortable",
    hint: "Slide or hop up slowly. Stay relaxed. Stop before it feels tight.",
  },
];

export default function VoiceTypePanel() {
  const [step, setStep] = useState<Step>("intro");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveNote, setLiveNote] = useState("—");
  const [liveFreq, setLiveFreq] = useState<number | null>(null);
  const [phraseMidis, setPhraseMidis] = useState<number[]>([]);
  const [lowMidi, setLowMidi] = useState<number | null>(null);
  const [highMidi, setHighMidi] = useState<number | null>(null);
  const [samples, setSamples] = useState(0);

  const audioRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const tracker = useRef(new PitchTracker(8));
  const tickRef = useRef<() => void>(() => {});
  const stepRef = useRef<Step>("intro");
  const lowRef = useRef<number | null>(null);
  const highRef = useRef<number | null>(null);
  const phraseRef = useRef<number[]>([]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const stopMic = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    tracker.current.clear();
    setListening(false);
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioRef.current;
    if (!analyser || !ctx) return;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    // Voice range ~80–1000 Hz
    const result = detectPitch(buf, ctx.sampleRate, 80, 1000);
    const stable = tracker.current.push(result?.frequency ?? null);
    if (stable != null) {
      const n = nearestNote(stable);
      setLiveNote(`${n.name}${n.octave}`);
      setLiveFreq(stable);
      const midi = freqToMidi(stable);
      const s = stepRef.current;
      if (s === "phrase") {
        phraseRef.current.push(midi);
        if (phraseRef.current.length % 5 === 0) {
          setPhraseMidis([...phraseRef.current]);
          setSamples(phraseRef.current.length);
        }
      } else if (s === "low") {
        if (lowRef.current == null || midi < lowRef.current) {
          lowRef.current = midi;
          setLowMidi(midi);
        }
        setSamples((c) => c + 1);
      } else if (s === "high") {
        if (highRef.current == null || midi > highRef.current) {
          highRef.current = midi;
          setHighMidi(midi);
        }
        setSamples((c) => c + 1);
      }
    }
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, []);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const startMic = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
      streamRef.current = stream;
      const ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      analyserRef.current = analyser;
      tracker.current.clear();
      setListening(true);
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    } catch {
      setError("Microphone access is needed. Please allow the mic and try again.");
    }
  }, []);

  useEffect(() => () => stopMic(), [stopMic]);

  const begin = async () => {
    phraseRef.current = [];
    lowRef.current = null;
    highRef.current = null;
    setPhraseMidis([]);
    setLowMidi(null);
    setHighMidi(null);
    setSamples(0);
    setStep("phrase");
    await startMic();
  };

  const nextFrom = async (current: Step) => {
    if (current === "phrase") {
      setStep("low");
      setSamples(0);
      tracker.current.clear();
    } else if (current === "low") {
      setStep("high");
      setSamples(0);
      tracker.current.clear();
    } else if (current === "high") {
      stopMic();
      setStep("result");
    }
  };

  const retry = () => {
    stopMic();
    setStep("intro");
    setLiveNote("—");
    setLiveFreq(null);
    setPhraseMidis([]);
    setLowMidi(null);
    setHighMidi(null);
    setSamples(0);
  };

  const avgPhrase =
    phraseMidis.length > 0
      ? phraseMidis.reduce((a, b) => a + b, 0) / phraseMidis.length
      : null;

  const effectiveLow = lowMidi ?? (avgPhrase != null ? avgPhrase - 5 : null);
  const effectiveHigh = highMidi ?? (avgPhrase != null ? avgPhrase + 5 : null);

  const result =
    effectiveLow != null && effectiveHigh != null && effectiveHigh > effectiveLow
      ? classifyVoiceType(effectiveLow, effectiveHigh)
      : null;

  const octaves =
    effectiveLow != null && effectiveHigh != null
      ? ((effectiveHigh - effectiveLow) / 12).toFixed(1)
      : null;

  // Chart span E1 (28) to E5 (76)
  const chartMin = 28;
  const chartMax = 76;
  const pct = (m: number) => ((m - chartMin) / (chartMax - chartMin)) * 100;

  const stepMeta = STEPS.find((s) => s.id === step);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-b from-[#f4f9fd] to-white p-6 sm:p-8">
        {step !== "result" && stepMeta && (
          <>
            <h3 className="text-xl font-semibold">{stepMeta.title}</h3>
            <p className="mt-2 text-[var(--muted)] leading-relaxed">{stepMeta.hint}</p>

            {step !== "intro" && (
              <div className="mt-6 flex flex-col items-center rounded-2xl border border-[var(--border)] bg-white p-6">
                <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Live pitch</p>
                <div className="mt-1 text-5xl font-bold tabular-nums">{liveNote}</div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {liveFreq != null ? `${liveFreq.toFixed(1)} Hz` : listening ? "Sing into the mic…" : "Mic off"}
                </p>
                {step === "low" && lowMidi != null && (
                  <p className="mt-3 text-sm font-medium text-[var(--brand-blue)]">
                    Lowest so far: {formatNoteMidi(lowMidi)}
                  </p>
                )}
                {step === "high" && highMidi != null && (
                  <p className="mt-3 text-sm font-medium text-[var(--brand-orange)]">
                    Highest so far: {formatNoteMidi(highMidi)}
                  </p>
                )}
                {step === "phrase" && avgPhrase != null && (
                  <p className="mt-3 text-sm font-medium">
                    Average so far: {formatNoteMidi(avgPhrase)} · {samples} samples
                  </p>
                )}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-6 flex flex-wrap gap-3">
              {step === "intro" ? (
                <button
                  type="button"
                  onClick={() => void begin()}
                  className="rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-8 py-3 text-sm font-semibold text-white"
                >
                  Start · allow microphone
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void nextFrom(step)}
                    className="rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-8 py-3 text-sm font-semibold text-white"
                  >
                    {step === "high" ? "See my result" : "Next step"}
                  </button>
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-full border border-[var(--border)] bg-white px-6 py-3 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {step === "result" && result && effectiveLow != null && effectiveHigh != null && (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Your estimate</p>
            <h3
              className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-playfair), serif" }}
            >
              {result.best.label}
            </h3>
            <p className="mt-3 text-lg">
              Range{" "}
              <span className="font-semibold">
                {formatNoteMidi(effectiveLow)} – {formatNoteMidi(effectiveHigh)}
              </span>
              {octaves != null && (
                <span className="text-[var(--muted)]"> · about {octaves} octaves</span>
              )}
            </p>
            {avgPhrase != null && (
              <p className="mt-1 text-sm text-[var(--muted)]">
                Comfortable phrase centre: {formatNoteMidi(avgPhrase)}
              </p>
            )}

            <div className="mt-8 space-y-3">
              <p className="text-sm font-medium text-[var(--muted)]">Where you sit on the chart</p>
              {VOICE_TYPES.map((t) => {
                const isBest = t.id === result.best.id;
                return (
                  <div key={t.id} className="relative">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className={isBest ? "font-semibold text-[var(--brand-blue)]" : "text-[var(--muted)]"}>
                        {t.label}
                      </span>
                      <span className="text-[var(--muted)]">
                        {formatNoteMidi(t.low)}–{formatNoteMidi(t.high)}
                      </span>
                    </div>
                    <div className="relative h-3 rounded-full bg-[var(--background)] border border-[var(--border)]">
                      <div
                        className={`absolute inset-y-0 rounded-full ${
                          isBest ? "bg-[var(--brand-blue)]/40" : "bg-[var(--border)]"
                        }`}
                        style={{ left: `${pct(t.low)}%`, width: `${pct(t.high) - pct(t.low)}%` }}
                      />
                      {isBest && (
                        <div
                          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] opacity-90"
                          style={{
                            left: `${pct(effectiveLow)}%`,
                            width: `${Math.max(2, pct(effectiveHigh) - pct(effectiveLow))}%`,
                          }}
                          title="Your range"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-[var(--muted)]">Gradient bar on your match = the range we heard from you.</p>
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5 p-4 text-sm leading-relaxed">
              <strong>Friendly note:</strong> this is only an estimate for fun and practice. Voices — especially kids’
              voices — change with age, training and the day. A teacher can help you explore safely without strain.
            </div>

            {result.alternatives.length > 0 && (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Also close: {result.alternatives.map((a) => a.type.label).join(", ")}
              </p>
            )}

            <button
              type="button"
              onClick={retry}
              className="mt-6 rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-8 py-3 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {step === "result" && !result && (
          <div>
            <h3 className="text-xl font-semibold">We need a clearer sample</h3>
            <p className="mt-2 text-[var(--muted)]">
              Try again in a quiet room, sing a bit louder, and hold each note for a second.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-6 rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-8 py-3 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
