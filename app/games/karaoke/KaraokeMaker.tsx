"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  LONG_SONG_SECONDS,
  MAX_SEMITONES,
  MAX_SONG_SECONDS,
  MIN_SEMITONES,
  clampSemitones,
  detectKey,
  encodeWav,
  formatMB,
  formatTime,
  keyName,
  outputName,
  quickVocals,
  semitoneLabel,
  stereoWidth,
  toMono,
  type MusicKey,
  type Stereo,
} from "./dsp";
import {
  KaraokeError,
  KaraokePlayer,
  MODEL_DOWNLOAD_BYTES,
  audioSupported,
  decodeFile,
  encodeMp3,
  renderMix,
  separateVocals,
  type SeparationStatus,
} from "./engine";
import "./karaoke.css";

type Song = { name: string; duration: number; audio: Stereo; key: MusicKey | null; mono: boolean };
type Method = "ai" | "quick";
type Job = { title: string; detail: string; fraction: number | null; cancel?: () => void };
type Download = { url: string; name: string; size: number };

const NOTES = ["🎵", "🎶", "🎤", "⭐", "🎵", "🎶"];
const PRIVACY = "Your song stays on your device; nothing is uploaded or saved.";

const noopSubscribe = () => () => {};

function isLowMemoryDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof mem === "number" && mem > 0 && mem < 4;
}

function isPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function statusToJob(s: SeparationStatus, cancel: () => void): Job {
  if (s.stage === "download") {
    return {
      title: s.cached ? "AI helper ready (saved on this device)" : "Downloading the AI helper (one time only)…",
      detail: s.cached ? "Loaded from your browser's storage" : `${formatMB(s.loaded)} of ${formatMB(s.total)}`,
      fraction: s.total ? s.loaded / s.total : null,
      cancel,
    };
  }
  if (s.stage === "init") return { title: "Warming up the AI helper…", detail: "This takes a few seconds", fraction: null, cancel };
  const eta = s.eta !== undefined && s.done > 0 ? ` · about ${formatTime(s.eta)} left` : "";
  return {
    title: "Removing the vocals… 🎤➡️🎸",
    detail: `Part ${s.done} of ${s.total}${eta}${s.backend.startsWith("webgpu") ? " · using your graphics chip" : ""}`,
    fraction: s.total ? s.done / s.total : null,
    cancel,
  };
}

export function KaraokeMaker() {
  const playerRef = useRef<KaraokePlayer | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const supported = useSyncExternalStore(noopSubscribe, audioSupported, () => true);
  const [song, setSong] = useState<Song | null>(null);
  const [vocals, setVocals] = useState<Stereo | null>(null);
  const [vocalsBy, setVocalsBy] = useState<Method | null>(null);
  const [method, setMethod] = useState<Method>("ai");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [semis, setSemis] = useState(0);
  const [vocalPct, setVocalPct] = useState(0);
  const [original, setOriginal] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [format, setFormat] = useState<"mp3" | "wav">("mp3");
  const [download, setDownload] = useState<Download | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  // The AI helper runs much faster with cross-origin isolation (multi-threaded
  // WASM). Those headers only apply on a full page load, so if we got here by
  // an in-app link, reload once.
  useEffect(() => {
    if (typeof window === "undefined" || window.crossOriginIsolated) return;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const landed = nav ? new URL(nav.name).pathname : window.location.pathname;
    if (landed !== window.location.pathname) window.location.reload();
  }, []);

  useEffect(() => {
    const p = new KaraokePlayer();
    p.onEnded = () => {
      setPlaying(false);
      setTime(0);
    };
    playerRef.current = p;
    return () => {
      void p.close();
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      setTime(playerRef.current?.currentTime() ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => () => {
    if (download) URL.revokeObjectURL(download.url);
  }, [download]);

  const clearDownload = useCallback(() => setDownload(null), []);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    setDownload(null);
    setVocals(null);
    setVocalsBy(null);
    setLastRun(null);
    setPlaying(false);
    setTime(0);
    playerRef.current?.stop();
    setJob({ title: "Opening your song…", detail: file.name, fraction: null });
    try {
      const audio = await decodeFile(file);
      if (audio.duration > MAX_SONG_SECONDS) {
        throw new KaraokeError(`This file is ${formatTime(audio.duration)} long. Please pick a song shorter than 30 minutes.`, "memory");
      }
      setJob({ title: "Finding the key…", detail: "Listening to the notes", fraction: null });
      await new Promise((r) => setTimeout(r, 30));
      const key = detectKey(toMono(audio));
      const mono = stereoWidth(audio.left, audio.right) < 0.002;
      const s: Song = { name: file.name, duration: audio.duration, audio: { left: audio.left, right: audio.right }, key, mono };
      setSong(s);
      setSemis(0);
      setOriginal(false);
      await playerRef.current?.load(s.audio);
      playerRef.current?.setSemitones(0);
      const warns: string[] = [];
      if (audio.duration > LONG_SONG_SECONDS) warns.push("This is a long song (over 10 minutes). AI mode may be slow and could run out of memory on phones and tablets — Quick mode is safer.");
      else if (isLowMemoryDevice() || isPhone()) warns.push("On phones and tablets AI mode can take a while and needs about 1–2 GB of free memory. Close other apps, or use Quick mode.");
      if (mono) warns.push("This song is in mono, so Quick mode can't find the vocals. Use AI mode.");
      if (mono) setMethod("ai");
      setNotice(warns.join(" ") || null);
      setJob(null);
    } catch (e) {
      setJob(null);
      setSong(null);
      setError(e instanceof KaraokeError ? e.message : "We couldn't read this file. Try an MP3, WAV or M4A song.");
    }
  }, []);

  const removeVocals = useCallback(async () => {
    if (!song) return;
    setError(null);
    setDownload(null);
    playerRef.current?.pause();
    setPlaying(false);
    const t0 = performance.now();
    if (method === "quick") {
      setJob({ title: "Removing the vocals (Quick mode)…", detail: "Almost instant", fraction: null });
      await new Promise((r) => setTimeout(r, 30));
      const v = quickVocals(song.audio.left, song.audio.right);
      setVocals(v);
      setVocalsBy("quick");
      await playerRef.current?.setVocals(v);
      setLastRun(`Quick mode took ${((performance.now() - t0) / 1000).toFixed(1)} s`);
      setJob(null);
      return;
    }
    const run = separateVocals(song.audio, {
      preferGpu: true,
      onStatus: (s) => setJob(statusToJob(s, () => run.cancel())),
    });
    setJob({ title: "Starting the AI helper…", detail: "", fraction: null, cancel: () => run.cancel() });
    try {
      const res = await run.promise;
      const v = { left: res.left, right: res.right };
      setVocals(v);
      setVocalsBy("ai");
      await playerRef.current?.setVocals(v);
      setLastRun(`AI mode took ${formatTime(res.seconds)} (${res.backend.startsWith("webgpu") ? "graphics chip" : "processor"})`);
      setJob(null);
    } catch (e) {
      setJob(null);
      if (e instanceof KaraokeError && e.code === "cancelled") return;
      setError(e instanceof KaraokeError ? e.message : "Something went wrong. Try Quick mode.");
    }
  }, [song, method]);

  const togglePlay = useCallback(async () => {
    const p = playerRef.current;
    if (!p || !song) return;
    if (p.playing) {
      p.pause();
      setPlaying(false);
    } else {
      await p.play();
      setPlaying(true);
    }
  }, [song]);

  const changeSemis = useCallback(
    (n: number) => {
      const v = clampSemitones(n);
      setSemis(v);
      playerRef.current?.setSemitones(v);
      clearDownload();
    },
    [clearDownload],
  );

  const changeVocal = useCallback(
    (pct: number) => {
      setVocalPct(pct);
      playerRef.current?.setVocalLevel(pct / 100);
      clearDownload();
    },
    [clearDownload],
  );

  const pickAB = useCallback((orig: boolean) => {
    setOriginal(orig);
    playerRef.current?.setOriginal(orig);
  }, []);

  const makeFile = useCallback(async () => {
    if (!song) return;
    setError(null);
    setDownload(null);
    const signal = { cancelled: false };
    cancelRef.current = signal;
    const cancel = () => {
      signal.cancelled = true;
      setJob(null);
    };
    try {
      setJob({ title: semis ? "Changing the key…" : "Mixing your track…", detail: "Keeping the same speed", fraction: 0, cancel });
      const mixed = await renderMix(song.audio, vocals, vocalPct / 100, semis, (f) => {
        if (!signal.cancelled) setJob({ title: semis ? "Changing the key…" : "Mixing your track…", detail: `${Math.round(f * 100)}%`, fraction: f * (format === "mp3" ? 0.5 : 0.9), cancel });
      }, signal);
      if (signal.cancelled) return;
      let blob: Blob;
      if (format === "mp3") {
        blob = await encodeMp3(mixed, 192, (f) => {
          if (!signal.cancelled) setJob({ title: "Making the MP3 file…", detail: `${Math.round(f * 100)}%`, fraction: 0.5 + f * 0.5, cancel });
        }, signal);
      } else {
        setJob({ title: "Making the WAV file…", detail: "", fraction: 0.95, cancel });
        await new Promise((r) => setTimeout(r, 20));
        blob = encodeWav(mixed);
      }
      if (signal.cancelled) return;
      const name = `${outputName(song.name, { karaoke: !!vocals && vocalPct < 100, semitones: semis })}.${format}`;
      setDownload({ url: URL.createObjectURL(blob), name, size: blob.size });
      setJob(null);
    } catch (e) {
      setJob(null);
      if (e instanceof KaraokeError && e.code === "cancelled") return;
      setError(e instanceof KaraokeError ? e.message : "Making the file failed. Try WAV, or a shorter song.");
    }
  }, [song, vocals, vocalPct, semis, format]);

  const reset = useCallback(() => {
    playerRef.current?.stop();
    setPlaying(false);
    setSong(null);
    setVocals(null);
    setVocalsBy(null);
    setDownload(null);
    setError(null);
    setNotice(null);
    setLastRun(null);
    setSemis(0);
    setVocalPct(0);
    setTime(0);
    if (fileInput.current) fileInput.current.value = "";
  }, []);

  const busy = !!job;
  const newKey = song?.key ? keyName(song.key, semis) : null;

  return (
    <div className="space-y-5" data-testid="karaoke-maker">
      {/* Hero */}
      <div className="km-sky relative overflow-hidden rounded-3xl p-5 text-white shadow-lg sm:p-8">
        {NOTES.map((n, i) => (
          <span key={i} className="km-note" style={{ left: `${8 + i * 16}%`, bottom: 0, animationDelay: `${i * 0.75}s` }} aria-hidden>
            {n}
          </span>
        ))}
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="km-float text-6xl sm:text-7xl" aria-hidden>
            🎤
          </div>
          <div>
            <p className="text-2xl font-black sm:text-3xl">Make any song a karaoke track!</p>
            <p className="mt-1 text-white/90">Upload a song → remove the singer&apos;s voice → move it to your key → sing along or download it.</p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-1.5 text-sm font-bold text-emerald-700 shadow" data-testid="privacy-note">
              🔒 {PRIVACY}
            </p>
          </div>
        </div>
      </div>

      {!supported ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-amber-900">
          Your browser is missing the audio features Karaoke Maker needs. Please use a recent Chrome, Edge, Firefox or Safari.
        </p>
      ) : null}

      {/* Step 1: upload */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6" aria-labelledby="km-step1">
        <h2 id="km-step1" className="text-lg font-black text-slate-800">
          <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1a9fd4] text-sm text-white">1</span>
          Pick a song
        </h2>
        {song ? (
          <div className="km-pop mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sky-50 p-3" data-testid="song-info">
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-800">🎵 {song.name}</p>
              <p className="text-sm text-slate-600">
                {formatTime(song.duration)}
                {song.key ? (
                  <>
                    {" · "}Key: <b data-testid="song-key">{keyName(song.key)}</b>
                  </>
                ) : null}
                {song.mono ? " · mono" : " · stereo"}
              </p>
            </div>
            <button type="button" onClick={reset} disabled={busy} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#1a9fd4] disabled:opacity-50">
              Choose another song
            </button>
          </div>
        ) : (
          <label
            className={`km-drop mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center ${dragging ? "km-drop-active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void onFile(e.dataTransfer.files?.[0]);
            }}
          >
            <span className="text-5xl" aria-hidden>
              📂
            </span>
            <span className="mt-2 text-lg font-black text-slate-800">Tap to choose a song</span>
            <span className="text-sm text-slate-600">or drop it here · MP3, WAV, M4A, AAC, OGG, FLAC</span>
            <input
              ref={fileInput}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.webm,.opus"
              className="sr-only"
              data-testid="file-input"
              disabled={busy}
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Please only use songs you own or have permission to use. {PRIVACY}
        </p>
        {notice ? (
          <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="notice">
            ⚠️ {notice}
          </p>
        ) : null}
      </section>

      {/* Progress */}
      {job ? (
        <div className="km-pop rounded-3xl border border-violet-200 bg-violet-50 p-4 sm:p-5" role="status" aria-live="polite" data-testid="progress">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-black text-violet-900">{job.title}</p>
              {job.detail ? <p className="text-sm text-violet-700" data-testid="progress-detail">{job.detail}</p> : null}
            </div>
            {job.cancel ? (
              <button type="button" onClick={job.cancel} className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-violet-800 shadow hover:bg-violet-100" data-testid="cancel">
                Cancel
              </button>
            ) : null}
          </div>
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-white">
            <div
              className="km-stripes h-full rounded-full bg-gradient-to-r from-[#1a9fd4] via-violet-500 to-[#e8962e] transition-[width] duration-300"
              style={{ width: job.fraction === null ? "100%" : `${Math.max(3, Math.round(job.fraction * 100))}%`, opacity: job.fraction === null ? 0.6 : 1 }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="km-pop rounded-2xl bg-rose-50 p-4 font-semibold text-rose-800" role="alert" data-testid="error">
          😕 {error}
        </p>
      ) : null}

      {song ? (
        <>
          {/* Step 2: remove vocals */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6" aria-labelledby="km-step2">
            <h2 id="km-step2" className="text-lg font-black text-slate-800">
              <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-sm text-white">2</span>
              Remove the vocals
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Vocal removal mode">
              <button
                type="button"
                role="radio"
                aria-checked={method === "ai"}
                onClick={() => setMethod("ai")}
                disabled={busy}
                data-testid="method-ai"
                className={`rounded-2xl border-2 p-4 text-left transition ${method === "ai" ? "border-violet-500 bg-violet-50 shadow" : "border-slate-200 bg-white hover:border-violet-300"}`}
              >
                <p className="font-black text-slate-800">✨ AI mode <span className="ml-1 rounded-full bg-violet-500 px-2 py-0.5 text-xs text-white">best</span></p>
                <p className="mt-1 text-sm text-slate-600">
                  A smart helper listens and lifts out just the voice. One-time download of about {formatMB(MODEL_DOWNLOAD_BYTES)} (kept on this device for next time). A 4-minute song takes about 1–3 minutes on a laptop, longer on phones.
                </p>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={method === "quick"}
                onClick={() => setMethod("quick")}
                disabled={busy || song.mono}
                data-testid="method-quick"
                className={`rounded-2xl border-2 p-4 text-left transition disabled:opacity-50 ${method === "quick" ? "border-[#e8962e] bg-orange-50 shadow" : "border-slate-200 bg-white hover:border-orange-300"}`}
              >
                <p className="font-black text-slate-800">⚡ Quick mode</p>
                <p className="mt-1 text-sm text-slate-600">
                  Instant, no download. Works best on studio songs with the singer in the middle. It also softens other instruments in the middle, and it can&apos;t work on mono songs.
                </p>
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void removeVocals()}
                disabled={busy}
                data-testid="remove-vocals"
                className="rounded-full bg-gradient-to-r from-violet-500 to-[#1a9fd4] px-6 py-3 text-lg font-black text-white shadow-lg transition hover:scale-[1.03] disabled:opacity-50"
              >
                {vocals ? "🔁 Remove vocals again" : "🎤 Remove vocals"}
              </button>
              {vocals ? (
                <span className="km-pop rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800" data-testid="vocals-done">
                  ✅ Vocals removed ({vocalsBy === "ai" ? "AI mode" : "Quick mode"}){lastRun ? ` · ${lastRun}` : ""}
                </span>
              ) : (
                <span className="text-sm text-slate-500">You can also skip this and just change the key.</span>
              )}
            </div>
          </section>

          {/* Step 3: key */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6" aria-labelledby="km-step3">
            <h2 id="km-step3" className="text-lg font-black text-slate-800">
              <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#e8962e] text-sm text-white">3</span>
              Change the key (same speed)
            </h2>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label="Down a half step"
                onClick={() => changeSemis(semis - 1)}
                disabled={busy || semis <= MIN_SEMITONES}
                className="h-14 w-14 rounded-full bg-sky-100 text-3xl font-black text-sky-700 shadow transition hover:scale-105 disabled:opacity-40"
              >
                −
              </button>
              <div className="min-w-[9rem] text-center">
                <p key={semis} className="km-pop text-5xl font-black text-slate-800" data-testid="semitones">
                  {semis > 0 ? `+${semis}` : semis < 0 ? `−${-semis}` : "0"}
                </p>
                <p className="text-sm font-semibold text-slate-600" data-testid="semitone-label">
                  {semitoneLabel(semis)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Up a half step"
                onClick={() => changeSemis(semis + 1)}
                disabled={busy || semis >= MAX_SEMITONES}
                className="h-14 w-14 rounded-full bg-orange-100 text-3xl font-black text-orange-700 shadow transition hover:scale-105 disabled:opacity-40"
              >
                +
              </button>
            </div>
            <input
              type="range"
              min={MIN_SEMITONES}
              max={MAX_SEMITONES}
              step={1}
              value={semis}
              disabled={busy}
              onChange={(e) => changeSemis(Number(e.target.value))}
              aria-label="Key change in half steps"
              className="km-range mt-4 w-full"
              data-testid="semitone-slider"
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: "−1 whole step", d: -2 },
                { label: "−½ step", d: -1 },
                { label: "Original key", d: 0 },
                { label: "+½ step", d: 1 },
                { label: "+1 whole step", d: 2 },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  disabled={busy}
                  onClick={() => changeSemis(b.d === 0 ? 0 : semis + b.d)}
                  className={`rounded-full border px-3 py-2 text-sm font-bold transition disabled:opacity-50 ${b.d === 0 ? "col-span-2 border-slate-300 bg-slate-50 text-slate-700 sm:col-span-1" : "border-slate-200 bg-white text-slate-700 hover:border-violet-400"}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            {song.key ? (
              <p className="mt-3 text-center text-sm text-slate-600" data-testid="key-change">
                🎼 Key: <b>{keyName(song.key)}</b>
                {semis ? (
                  <>
                    {" → "}
                    <b className="text-violet-700">{newKey}</b>
                  </>
                ) : null}
                <span className="text-slate-400"> (best guess)</span>
              </p>
            ) : null}
          </section>

          {/* Step 4: listen */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6" aria-labelledby="km-step4">
            <h2 id="km-step4" className="text-lg font-black text-slate-800">
              <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">4</span>
              Listen
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void togglePlay()}
                disabled={busy}
                data-testid="play"
                aria-label={playing ? "Pause" : "Play"}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-[#1a9fd4] text-2xl text-white shadow-lg transition hover:scale-105 disabled:opacity-50"
              >
                {playing ? "⏸" : "▶"}
              </button>
              <div className="min-w-0 flex-1">
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, song.duration)}
                  step={0.1}
                  value={Math.min(time, song.duration)}
                  onChange={(e) => {
                    const t = Number(e.target.value);
                    setTime(t);
                    void playerRef.current?.seek(t);
                  }}
                  aria-label="Position in the song"
                  className="km-range w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span data-testid="time">{formatTime(time)}</span>
                  <span>{formatTime(song.duration)}</span>
                </div>
              </div>
              <div className={`flex h-10 items-end text-violet-500 ${playing ? "km-eq-on" : ""}`} aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="km-bar" />
                ))}
              </div>
            </div>
            <div className="mt-4 inline-flex rounded-full bg-slate-100 p-1" role="radiogroup" aria-label="Compare">
              {[
                { orig: true, label: "🎙️ A: Original" },
                { orig: false, label: "🎤 B: Karaoke" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={original === o.orig}
                  onClick={() => pickAB(o.orig)}
                  disabled={!vocals}
                  data-testid={o.orig ? "ab-original" : "ab-karaoke"}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${original === o.orig ? "bg-white text-violet-700 shadow" : "text-slate-600"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="flex justify-between text-sm font-semibold text-slate-700">
                <span>Singer&apos;s voice volume</span>
                <span data-testid="vocal-pct">{vocalPct}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={vocalPct}
                disabled={!vocals || busy}
                onChange={(e) => changeVocal(Number(e.target.value))}
                className="km-range w-full"
                data-testid="vocal-slider"
              />
              <span className="text-xs text-slate-500">
                {vocals ? "0% = no singer (karaoke), 30% = a quiet guide voice, 100% = the original." : "Remove the vocals first to use this."}
              </span>
            </label>
            <p className="mt-2 text-xs text-slate-500">The A/B switch and the key change apply to the preview straight away.</p>
          </section>

          {/* Step 5: download */}
          <section className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6" aria-labelledby="km-step5">
            <h2 id="km-step5" className="text-lg font-black text-slate-800">
              <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-pink-500 text-sm text-white">5</span>
              Download your track
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full bg-slate-100 p-1" role="radiogroup" aria-label="File type">
                {(["mp3", "wav"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={format === f}
                    onClick={() => {
                      setFormat(f);
                      clearDownload();
                    }}
                    disabled={busy}
                    data-testid={`format-${f}`}
                    className={`rounded-full px-4 py-2 text-sm font-bold uppercase transition ${format === f ? "bg-white text-pink-600 shadow" : "text-slate-600"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void makeFile()}
                disabled={busy}
                data-testid="make-file"
                className="rounded-full bg-gradient-to-r from-pink-500 to-[#e8962e] px-6 py-3 font-black text-white shadow-lg transition hover:scale-[1.03] disabled:opacity-50"
              >
                💾 Make my file
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {format === "mp3" ? "MP3 is small and plays everywhere." : "WAV is full quality but big (about 10 MB per minute)."} The file is made on your device.
            </p>
            {download ? (
              <a
                href={download.url}
                download={download.name}
                data-testid="download-link"
                className="km-pop mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-white shadow-lg hover:bg-emerald-600"
              >
                ⬇️ <span className="truncate">Download “{download.name}”</span>
                <span className="shrink-0 text-sm font-semibold text-white/80">{formatMB(download.size)}</span>
              </a>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default KaraokeMaker;
