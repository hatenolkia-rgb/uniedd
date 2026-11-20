import { describe, expect, it } from "vitest";
import {
  clickFor,
  nextTick,
  planWindow,
  tapTempo,
  voiceFor,
  type TimelineSettings,
} from "../app/jam/metronome/timeline";
import { KIND_PEAK, renderClick, SOUND_KITS } from "../app/jam/metronome/sounds";
import { analyseVoice, MetronomeEngine, type EngineSettings } from "../app/jam/metronome/engine";

const base: TimelineSettings = {
  bpm: 120,
  beats: ["accent", "normal", "normal", "normal"],
  subdivision: 1,
  accent: true,
  voiceSubdivisions: true,
};

describe("metronome timeline", () => {
  it("click and voice of each beat share the exact same tick time", () => {
    const { events } = planWindow({ time: 1, beat: 0, sub: 0 }, base, 3);
    expect(events).toHaveLength(4);
    events.forEach((e, i) => {
      expect(e.tick.time).toBeCloseTo(1 + i * 0.5, 9);
      expect(e.click).toBe(i === 0 ? "accent" : "beat");
      expect(e.voice).toBe(String(i + 1));
    });
  });

  it("voice keeps counting on a muted beat (voice is not bound to the click)", () => {
    const s = { ...base, beats: ["accent", "mute", "normal", "mute"] as TimelineSettings["beats"] };
    const { events } = planWindow({ time: 0, beat: 0, sub: 0 }, s, 2);
    expect(events.map((e) => e.click)).toEqual(["accent", null, "beat", null]);
    expect(events.map((e) => e.voice)).toEqual(["1", "2", "3", "4"]);
  });

  it("accent off plays the normal beat sound on beat 1", () => {
    expect(clickFor({ time: 0, beat: 0, sub: 0 }, { ...base, accent: false })).toBe("beat");
  });

  it("speaks subdivisions: and / e-and-a / trip-let", () => {
    const words = (subdivision: 1 | 2 | 3 | 4) =>
      planWindow({ time: 0, beat: 0, sub: 0 }, { ...base, bpm: 60, subdivision }, 0.999).events.map((e) => e.voice);
    expect(words(2)).toEqual(["1", "and"]);
    expect(words(3)).toEqual(["1", "trip", "let"]);
    expect(words(4)).toEqual(["1", "e", "and", "a"]);
    const off = planWindow({ time: 0, beat: 0, sub: 0 }, { ...base, bpm: 60, subdivision: 4, voiceSubdivisions: false }, 0.999);
    expect(off.events.map((e) => e.voice)).toEqual(["1", null, null, null]);
    expect(off.events.map((e) => e.click)).toEqual(["accent", "sub", "sub", "sub"]);
  });

  it("drops spoken subdivisions when they would be too fast, but keeps the numbers", () => {
    const s = { ...base, bpm: 200, subdivision: 4 as const };
    expect(voiceFor({ time: 0, beat: 0, sub: 0 }, s)).toBe("1");
    expect(voiceFor({ time: 0, beat: 0, sub: 2 }, s)).toBeNull();
  });

  it("follows the time signature (6/8 counts to six then wraps)", () => {
    const s = { ...base, beats: ["accent", "normal", "normal", "normal", "normal", "normal"] as TimelineSettings["beats"] };
    const { events } = planWindow({ time: 0, beat: 0, sub: 0 }, s, 3.9);
    expect(events.map((e) => e.voice)).toEqual(["1", "2", "3", "4", "5", "6", "1", "2"]);
  });

  it("tempo changes apply from the next tick with no jump", () => {
    let t = { time: 0, beat: 0, sub: 0 };
    t = nextTick(t, base);
    expect(t.time).toBeCloseTo(0.5, 9);
    t = nextTick(t, { ...base, bpm: 60 });
    expect(t.time).toBeCloseTo(1.5, 9);
  });

  it("tap tempo averages recent taps and ignores a stray one", () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(tapTempo([0, 500, 1000, 1700, 2200, 2700])).toBe(120);
    expect(tapTempo([0])).toBeNull();
  });
});

describe("click sounds", () => {
  for (const sr of [44100, 48000]) {
    for (const { id } of SOUND_KITS) {
      it(`${id} @ ${sr} Hz is clean, short and distinct per kind`, () => {
        const bufs = (["accent", "beat", "sub"] as const).map((k) => {
          const b = renderClick(id, k, sr);
          expect(b.every(Number.isFinite)).toBe(true);
          expect(b[0]).toBe(0);
          expect(b[b.length - 1]).toBe(0);
          expect(b.length / sr).toBeLessThan(0.25);
          const peak = b.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
          expect(peak).toBeCloseTo(KIND_PEAK[k], 3);
          expect(peak).toBeLessThan(0.9); // headroom, never clips
          return b;
        });
        expect(bufs[0]).not.toEqual(bufs[1]);
      });
    }
  }
});

describe("voice onset analysis", () => {
  it("finds where the sound starts and its perceived beat point", () => {
    const sr = 48000;
    const x = new Float32Array(sr * 0.5);
    // 50 ms of silence (like codec padding), then a word that swells over 40 ms
    for (let i = 0; i < x.length; i++) {
      const t = i / sr - 0.05;
      if (t > 0) x[i] = Math.sin(2 * Math.PI * 200 * t) * Math.min(1, t / 0.04) * Math.exp(-Math.max(0, t - 0.15) / 0.05);
    }
    const { start, onset } = analyseVoice(x, sr);
    expect(start).toBeGreaterThan(0.04);
    expect(start).toBeLessThan(0.051);
    expect(onset).toBeGreaterThan(0.01);
    expect(onset).toBeLessThan(0.06);
  });
});

// --- engine scheduling against a fake AudioContext --------------------------------

class FakeParam {
  value = 1;
  setTargetAtTime(v: number) { this.value = v; }
  setValueAtTime() {}
  linearRampToValueAtTime() {}
}
class FakeNode {
  constructor(public ctx: FakeCtx, public name = "") {}
  gain = new FakeParam();
  target: FakeNode | null = null;
  connect(n: FakeNode) { this.target = n; return n; }
}
class FakeSource extends FakeNode {
  buffer: { duration: number; sampleRate: number } | null = null;
  start(when: number, offset = 0) { this.ctx.starts.push({ src: this, when, offset }); }
  stop() {}
}
class FakeCtx {
  currentTime = 10;
  sampleRate = 48000;
  state = "running";
  outputLatency = 0;
  baseLatency = 0;
  destination = new FakeNode(this, "destination");
  starts: { src: FakeSource; when: number; offset: number }[] = [];
  gains: FakeNode[] = [];
  createGain() { const g = new FakeNode(this, "gain"); this.gains.push(g); return g; }
  createDynamicsCompressor() {
    const n = new FakeNode(this, "limiter") as FakeNode & Record<string, FakeParam>;
    for (const k of ["threshold", "knee", "ratio", "attack", "release"]) n[k] = new FakeParam();
    return n;
  }
  createBufferSource() { return new FakeSource(this); }
  createBuffer(_c: number, len: number, sr: number) {
    return { duration: len / sr, sampleRate: sr, copyToChannel() {} };
  }
  resume() { return Promise.resolve(); }
}

/** voice source -> its own per-word gain -> bus */
const busOf = (n: FakeNode) => n.target!.target!;

function makeEngine(patch: Partial<EngineSettings>) {
  const ctx = new FakeCtx();
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = { AudioContext: function () { return ctx; }, setInterval: () => 1, clearInterval() {} };
  const e = new MetronomeEngine({ ...base, kit: "click", clickOn: true, clickVolume: 0.8, voiceOn: true, voiceVolume: 0.8, voice: "female", ...patch });
  e.unlock();
  // inject decoded voice samples (normally fetched + decoded): each word "starts" 5 ms in, onset 40 ms
  const words = new Map();
  for (const w of ["1", "2", "3", "4", "5", "6", "7", "and", "e", "a", "trip", "let"])
    words.set(w, { buffer: { duration: 0.4, sampleRate: 48000 }, start: 0.005, onset: 0.04 });
  (e as unknown as { voices: Map<string, unknown> }).voices.set("female", words);
  const [, clickBus, voiceBus] = ctx.gains; // master, clickBus, voiceBus (creation order)
  return { e, ctx, clickBus, voiceBus };
}

describe("metronome engine", () => {
  it("schedules beat N's click and voice for the same AudioContext time, on separate buses", () => {
    const { e, ctx, clickBus, voiceBus } = makeEngine({});
    e.start();
    const clicks = ctx.starts.filter((s) => s.src.target === clickBus).map((s) => s.when);
    const voices = ctx.starts.filter((s) => s.src.buffer?.duration === 0.4).map((s) => s.when + 0.04);
    expect(clicks.length).toBeGreaterThan(0);
    expect(voices.length).toBe(clicks.length);
    clicks.forEach((t, i) => expect(voices[i]).toBeCloseTo(t, 9));
    // voice words route through their own gain into the voice bus, never the click bus
    ctx.starts.filter((s) => s.src.buffer?.duration === 0.4).forEach((s) => expect(busOf(s.src)).toBe(voiceBus));
    e.stop();
  });

  it("voice still counts with the click switched off, and the click with the voice off", () => {
    const a = makeEngine({ clickOn: false });
    a.e.start();
    expect(a.clickBus.gain.value).toBe(0);
    expect(a.voiceBus.gain.value).toBeGreaterThan(0);
    expect(a.ctx.starts.some((s) => s.src.buffer?.duration === 0.4)).toBe(true);
    a.e.stop();

    const b = makeEngine({ voiceOn: false });
    b.e.start();
    expect(b.voiceBus.gain.value).toBe(0);
    expect(b.clickBus.gain.value).toBeGreaterThan(0);
    b.e.stop();
  });

  it("volumes are independent", () => {
    const { e, clickBus, voiceBus } = makeEngine({ clickVolume: 0.5, voiceVolume: 1 });
    expect(clickBus.gain.value).toBeCloseTo(0.25, 6);
    expect(voiceBus.gain.value).toBeCloseTo(1, 6);
    e.update({ clickVolume: 1 });
    expect(clickBus.gain.value).toBeCloseTo(1, 6);
    expect(voiceBus.gain.value).toBeCloseTo(1, 6);
  });
});
