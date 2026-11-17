"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NO_RECORDING_FULL,
  StrokeTracker,
  centerX,
  checkChordShape,
  judgeCameraSequence,
  loadHandModel,
  pickStrummingHand,
  strumY,
  type CamStroke,
  type CamSummary,
  type HandModel,
  type Pt,
} from "./camera";
import type { Dir } from "./patterns";

export type CamStatus = "off" | "asking" | "loading" | "on" | "denied" | "error" | "unsupported";

export type CamLive = { dir: Dir; ok: boolean | null; key: number } | null;

type Session = {
  /** Down/up order to compare with (null = just watch, e.g. Chords mode). */
  expected: Dir[] | null;
  strokes: CamStroke[];
  /** Live position in `expected`. */
  idx: number;
  chord?: () => string | undefined;
};

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

/** Webcam + on-device hand tracking for the picking & strumming game. */
export function useCameraCoach() {
  const [status, setStatus] = useState<CamStatus>("off");
  const [live, setLive] = useState<CamLive>(null);
  const [shapeMsg, setShapeMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [handSeen, setHandSeen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<HandModel | null>(null);
  const runningRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const trackerRef = useRef(new StrokeTracker());
  const historyRef = useRef<number[][]>([[], []]);
  const lastShapeRef = useRef(0);
  const keyRef = useRef(0);
  const seenRef = useRef(false);
  const strumSideRef = useRef<number | null>(null);
  const lastStrumXRef = useRef<number | null>(null);


  const draw = useCallback((hands: Pt[][], strumIdx: number) => {
    const c = canvasRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    const g = c.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, w, h);
    hands.forEach((lm, i) => {
      const color = i === strumIdx ? "#ec4899" : "#22c55e";
      g.strokeStyle = color;
      g.lineWidth = 4;
      for (const [a, b] of CONNECTIONS) {
        g.beginPath();
        g.moveTo(lm[a].x * w, lm[a].y * h);
        g.lineTo(lm[b].x * w, lm[b].y * h);
        g.stroke();
      }
      g.fillStyle = "#fff";
      for (const p of lm) {
        g.beginPath();
        g.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
        g.fill();
      }
    });
  }, []);

  const onFrame = useCallback(
    (perf: number) => {
      const model = modelRef.current;
      const v = videoRef.current;
      if (!model || !v || v.readyState < 2) return;
      let res;
      try {
        res = model.detectForVideo(v, perf);
      } catch {
        return;
      }
      // Sort hands left → right (in camera image) so their histories stay stable.
      const hands = [...(res.landmarks || [])].sort((a, b) => centerX(a) - centerX(b)).slice(0, 2);
      const seen = hands.length > 0;
      if (seen !== seenRef.current) {
        seenRef.current = seen;
        setHandSeen(seen);
      }
      const hist = historyRef.current;
      if (hands.length === 2) {
        hands.forEach((lm, i) => {
          hist[i].push(strumY(lm));
          if (hist[i].length > 45) hist[i].shift();
        });
      }
      // Strumming hand = the one moving up and down most; keep the choice steady
      // (hysteresis) and, with one hand in view, only accept it near the last strum hand.
      let strumIdx = 0;
      if (hands.length === 2) {
        const pick = pickStrummingHand(hist);
        const motion = hist.map((h) => h.slice(1).reduce((acc, y, k) => acc + Math.abs(y - h[k]), 0));
        const prev = strumSideRef.current;
        strumIdx = prev === null || motion[pick] > motion[prev] * 1.5 ? pick : prev;
        strumSideRef.current = strumIdx;
      }
      let strum: Pt[] | undefined = hands[strumIdx];
      if (hands.length === 1 && lastStrumXRef.current !== null && Math.abs(centerX(hands[0]) - lastStrumXRef.current) > 0.2) strum = undefined;
      if (strum) lastStrumXRef.current = centerX(strum);
      draw(hands, strum ? strumIdx : -1);
      const fret = hands.length === 2 ? hands[1 - strumIdx] : hands.length === 1 && !strum ? hands[0] : null;
      const dbg = (window as unknown as { __uniPickDebug?: { cam?: { frames: number; ys: number[]; ts: number[] } } }).__uniPickDebug;
      if (dbg) {
        dbg.cam ??= { frames: 0, ys: [], ts: [] };
        dbg.cam.frames++;
        if (strum) {
          dbg.cam.ys.push(strumY(strum));
          dbg.cam.ts.push(perf);
          if (dbg.cam.ys.length > 300) {
            dbg.cam.ys.shift();
            dbg.cam.ts.shift();
          }
        }
      }
      const t = perf / 1000;
      if (strum) {
        const s = trackerRef.current.push(t, strumY(strum));
        const sess = sessionRef.current;
        if (s && sess) {
          sess.strokes.push(s);
          let ok: boolean | null = null;
          const exp = sess.expected;
          if (exp && sess.idx < exp.length) {
            if (s.dir === exp[sess.idx]) {
              ok = true;
              sess.idx++;
            } else if (sess.idx === 0 || exp[sess.idx - 1] === exp[sess.idx]) {
              ok = null; // wind-up / return swing between two same-way strokes
            } else {
              ok = false;
              sess.idx++;
            }
          }
          keyRef.current++;
          setLive({ dir: s.dir, ok, key: keyRef.current });
        }
      }
      const sess = sessionRef.current;
      if (sess?.chord && perf - lastShapeRef.current > 600) {
        lastShapeRef.current = perf;
        const chord = sess.chord();
        if (chord) setShapeMsg(checkChordShape(chord, fret as Pt[] | null));
      }
    },
    [draw],
  );

  const genRef = useRef(0);
  const loop = useCallback(() => {
    const gen = ++genRef.current;
    const step = () => {
      const v = videoRef.current as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number) => void) => number }) | null;
      if (!runningRef.current || !v || gen !== genRef.current) return;
      const next = (now: number) => {
        if (gen !== genRef.current) return;
        onFrame(now);
        step();
      };
      if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(next);
      else requestAnimationFrame(next);
    };
    step();
  }, [onFrame]);

  /** Callback ref for the preview <video>: re-attaches the live stream when the preview moves. */
  const attachVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && streamRef.current) {
        el.srcObject = streamRef.current;
        el.muted = true;
        el.playsInline = true;
        el.play().catch(() => undefined);
        if (runningRef.current) loop();
      }
    },
    [loop],
  );

  const stop = useCallback(() => {
    runningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    sessionRef.current = null;
    setStatus("off");
    setLive(null);
    setShapeMsg(null);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return "on" as CamStatus;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof WebAssembly === "undefined") {
      setStatus("unsupported");
      return "unsupported" as CamStatus;
    }
    setStatus("asking");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      });
    } catch {
      setStatus("denied");
      return "denied" as CamStatus;
    }
    streamRef.current = stream;
    setStatus("loading");
    try {
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.muted = true;
        v.playsInline = true;
        await v.play().catch(() => undefined);
      }
      modelRef.current = await loadHandModel();
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStatus("error");
      return "error" as CamStatus;
    }
    runningRef.current = true;
    setStatus("on");
    loop();
    return "on" as CamStatus;
  }, [loop]);

  /** Start watching one exercise: `expected` = the down/up order (or null), `chord` = current chord getter. */
  const begin = useCallback((expected: Dir[] | null, chord?: () => string | undefined) => {
    if (!runningRef.current) return;
    trackerRef.current.reset();
    sessionRef.current = { expected, strokes: [], idx: 0, chord };
    setShapeMsg(null);
    setLive(null);
  }, []);

  /** Finish the exercise and summarise what the camera saw. */
  const end = useCallback((): CamSummary | null => {
    const sess = sessionRef.current;
    sessionRef.current = null;
    if (!sess) return null;
    return judgeCameraSequence(sess.expected, sess.strokes);
  }, []);

  useEffect(
    () => () => {
      runningRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const attachCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
  }, []);

  return { status, live, shapeMsg, handSeen, attachVideo, attachCanvas, start, stop, begin, end };
}

export type CameraCoach = ReturnType<typeof useCameraCoach>;

/** Mirrored preview with the hand skeleton, live stroke arrows and the privacy badge. */
export function CameraPreview({ cam, big = false, showShape = false }: { cam: CameraCoach; big?: boolean; showShape?: boolean }) {
  const { status, live, shapeMsg, handSeen, attachVideo, attachCanvas } = cam;
  const on = status === "on" || status === "loading";
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-900 shadow-lg ring-2 ring-white/60 ${big ? "w-full max-w-sm" : "w-44 sm:w-56"} ${on ? "" : "hidden"}`} data-testid="camera-preview">
      <div className="relative aspect-[4/3]">
        <video ref={attachVideo} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" muted playsInline autoPlay />
        <canvas ref={attachCanvas} className="absolute inset-0 h-full w-full -scale-x-100" />
        {status === "loading" ? <p className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-white">Waking up my camera eyes… 👀</p> : null}
        {status === "on" && !handSeen ? <p className="absolute inset-x-0 top-1 text-center text-[11px] font-bold text-white drop-shadow">Show me both hands ✋🤚</p> : null}
        {live ? (
          <span
            key={live.key}
            className="pk-judge rounded-2xl px-3 py-1 text-2xl font-black text-white shadow-lg"
            style={{ background: live.ok === false ? "#a855f7" : live.ok ? "#22c55e" : "#64748bcc" }}
            data-testid="camera-stroke"
          >
            {live.dir === "D" ? "↓" : "↑"} {live.ok === false ? "Other way!" : live.ok ? "✓" : ""}
          </span>
        ) : null}
      </div>
      <p className="bg-emerald-600 px-2 py-1 text-[10px] font-semibold leading-tight text-white" data-testid="camera-badge">
        🔒 {NO_RECORDING_FULL}
      </p>
      {showShape && shapeMsg ? (
        <p className={`px-2 py-1 text-[11px] font-bold leading-tight ${shapeMsg.ok ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`} data-testid="camera-shape">
          ✋ {shapeMsg.message}
        </p>
      ) : null}
    </div>
  );
}

/** Opt-in card on the setup screen. */
export function CameraOptIn({ cam, enabled, setEnabled }: { cam: CameraCoach; enabled: boolean; setEnabled: (v: boolean) => void }) {
  const msg: Partial<Record<CamStatus, string>> = {
    asking: "Please allow the camera in the box your browser shows.",
    denied: "No problem! The camera wasn't allowed, so Camera Coach is off. You can still play — and you can allow the camera in your browser settings later.",
    error: "Camera Coach couldn't start on this device. You can still play without it.",
    unsupported: "This browser can't run Camera Coach. You can still play without it.",
  };
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-violet-100" data-testid="camera-optin">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-black text-slate-800">📷 Camera Coach <span className="text-xs font-semibold text-slate-500">(optional)</span></h4>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => {
            if (enabled) cam.stop();
            setEnabled(!enabled);
          }}
          className={`relative h-8 w-14 rounded-full transition ${enabled ? "bg-violet-600" : "bg-slate-300"}`}
          data-testid="camera-toggle"
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? "left-7" : "left-1"}`} />
          <span className="sr-only">Camera Coach</span>
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-600">Picky watches your strumming hand to spot strokes that go the wrong way, missed or extra strokes and uneven timing. In Chords mode it also takes a rough (approximate) look at your chord hand.</p>
      {enabled ? (
        <div className="mt-3 space-y-3">
          <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900 ring-1 ring-emerald-200" data-testid="camera-privacy">
            🔒 {NO_RECORDING_FULL}
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-600">
            <li>Sit so both hands and the guitar are in the picture. Good light helps!</li>
            <li>Play at a comfortable speed — very fast strokes are hard for a camera to see.</li>
            <li>The hand model is downloaded once and then runs inside this page.</li>
          </ul>
          {cam.status === "on" || cam.status === "loading" ? null : (
            <button type="button" onClick={() => cam.start()} className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-black text-white shadow" data-testid="camera-start">
              📷 Turn on camera
            </button>
          )}
          {msg[cam.status] ? <p className="rounded-2xl bg-amber-50 p-2 text-sm font-semibold text-amber-900">{msg[cam.status]}</p> : null}
          <CameraPreview cam={cam} big />
          {cam.status === "on" ? (
            <button type="button" onClick={() => cam.stop()} className="text-sm font-semibold text-violet-700 underline">
              Turn camera off
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
