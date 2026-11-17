import { describe, expect, it } from "vitest";
import {
  SAMPLE_RATE,
  clampSemitones,
  detectKey,
  encodeWav,
  keyName,
  mixKaraoke,
  outputName,
  pitchRatio,
  preventClipping,
  quickVocals,
  semitoneLabel,
  stereoWidth,
} from "../app/games/karaoke/dsp";
import { GAMES, CATEGORIES } from "../app/games/catalog";

const sine = (f: number, sec: number, amp = 0.3, sr = SAMPLE_RATE) => {
  const x = new Float32Array(Math.round(sec * sr));
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * f * i) / sr);
  return x;
};
const rms = (x: Float32Array, from = 0) => {
  let e = 0;
  for (let i = from; i < x.length; i++) e += x[i] * x[i];
  return Math.sqrt(e / (x.length - from));
};

describe("semitone labels", () => {
  it("names half steps, whole steps and octaves", () => {
    expect(semitoneLabel(0)).toBe("0 = original key");
    expect(semitoneLabel(1)).toBe("+1 = ½ step up");
    expect(semitoneLabel(2)).toBe("+2 = 1 whole step up");
    expect(semitoneLabel(-2)).toBe("−2 = 1 whole step down");
    expect(semitoneLabel(3)).toBe("+3 = 1½ whole steps up");
    expect(semitoneLabel(4)).toBe("+4 = 2 whole steps up");
    expect(semitoneLabel(-5)).toBe("−5 = 2½ whole steps down");
    expect(semitoneLabel(12)).toBe("+12 = 1 octave up");
    expect(semitoneLabel(-12)).toBe("−12 = 1 octave down");
  });
  it("clamps to −12…+12", () => {
    expect(clampSemitones(15)).toBe(12);
    expect(clampSemitones(-30)).toBe(-12);
    expect(clampSemitones(NaN)).toBe(0);
    expect(clampSemitones(2.4)).toBe(2);
  });
  it("uses the equal-tempered ratio 2^(n/12)", () => {
    expect(pitchRatio(12)).toBeCloseTo(2, 10);
    expect(pitchRatio(-12)).toBeCloseTo(0.5, 10);
    expect(pitchRatio(2)).toBeCloseTo(1.122462, 5);
    expect(pitchRatio(7)).toBeCloseTo(1.498307, 5);
  });
});

describe("quick mode (centre cancellation)", () => {
  it("removes a centred voice but keeps the bass and the side instruments", () => {
    const sec = 2;
    const voice = sine(440, sec, 0.3);
    const guitar = sine(660, sec, 0.2); // hard left
    const L = new Float32Array(voice.length);
    const R = new Float32Array(voice.length);
    for (let i = 0; i < L.length; i++) {
      L[i] = voice[i] + guitar[i];
      R[i] = voice[i];
    }
    const kar = mixKaraoke({ left: L, right: R }, quickVocals(L, R), 0);
    const skip = SAMPLE_RATE / 2; // let the filter settle
    // Centre-cancelled: L' = S, R' = −S with S = guitar/2. Whatever else is left is voice.
    const resL = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) resL[i] = kar.left[i] - guitar[i] / 2;
    const reductionDb = 20 * Math.log10(rms(voice, skip) / rms(resL, skip));
    expect(reductionDb).toBeGreaterThan(15);
    expect(rms(kar.left, skip) / rms(guitar, skip)).toBeCloseTo(0.5, 1);
    // Bass survives almost untouched.
    const bass = sine(60, sec, 0.3);
    const bassOnly = mixKaraoke({ left: bass, right: bass }, quickVocals(bass, bass), 0);
    expect(rms(bassOnly.left, skip) / rms(bass, skip)).toBeGreaterThan(0.9);
  });
  it("vocal level 1 gives back the original exactly", () => {
    const L = sine(300, 0.5), R = sine(500, 0.5);
    const out = mixKaraoke({ left: L, right: R }, quickVocals(L, R), 1);
    for (let i = 0; i < L.length; i += 101) expect(out.left[i]).toBeCloseTo(L[i], 6);
  });
  it("detects mono files", () => {
    const x = sine(220, 0.5);
    expect(stereoWidth(x, x)).toBe(0);
    expect(stereoWidth(x, sine(330, 0.5))).toBeGreaterThan(0.5);
  });
});

describe("files", () => {
  it("writes a valid 16-bit stereo WAV", async () => {
    const n = 1000;
    const blob = encodeWav({ left: new Float32Array(n).fill(0.5), right: new Float32Array(n).fill(-1) });
    expect(blob.size).toBe(44 + n * 4);
    const v = new DataView(await blob.arrayBuffer());
    expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe("RIFF");
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getInt16(44, true)).toBe(Math.round(0.5 * 32767));
    expect(v.getInt16(46, true)).toBe(-32768);
  });
  it("never boosts, only prevents clipping", () => {
    const s = { left: new Float32Array([0.5, 2]), right: new Float32Array([-1.5, 0]) };
    preventClipping(s);
    expect(Math.max(...s.left.map(Math.abs), ...s.right.map(Math.abs))).toBeLessThanOrEqual(0.99 + 1e-6);
    const q = { left: new Float32Array([0.5]), right: new Float32Array([0.2]) };
    expect(preventClipping(q)).toBe(1);
  });
  it("names the download after the song", () => {
    expect(outputName("My Song.mp3", { karaoke: true, semitones: 2 })).toBe("My Song (karaoke, +2)");
    expect(outputName("a/b.m4a", { karaoke: false, semitones: -3 })).toBe("a b (-3)");
    expect(outputName("x.wav", { karaoke: false, semitones: 0 })).toBe("x");
  });
});

describe("key detection", () => {
  const chordTrack = (roots: number[][], sec = 2) => {
    const parts: Float32Array[] = [];
    for (const chord of roots) {
      const x = new Float32Array(Math.round(sec * SAMPLE_RATE));
      for (const m of chord) {
        const f = 440 * 2 ** ((m - 69) / 12);
        const s = sine(f, sec, 0.1);
        for (let i = 0; i < x.length; i++) x[i] += s[i];
      }
      parts.push(x);
    }
    const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  };
  it("finds C major from I–IV–V–I", () => {
    const k = detectKey(chordTrack([[48, 60, 64, 67], [53, 65, 69, 72], [55, 67, 71, 74], [48, 60, 64, 67], [48, 60, 64, 67]]));
    expect(k && keyName(k)).toBe("C major");
    expect(k && keyName(k, 2)).toBe("D major");
    expect(k && keyName(k, -1)).toBe("B major");
  });
  it("finds A minor from i–iv–v–i", () => {
    const k = detectKey(chordTrack([[45, 57, 60, 64], [50, 62, 65, 69], [52, 64, 67, 71], [45, 57, 60, 64], [45, 57, 60, 64]]));
    expect(k && keyName(k)).toBe("A minor");
  });
});

describe("catalog", () => {
  it("has a Karaoke Maker section with the karaoke game", () => {
    expect(CATEGORIES.some((c) => c.id === "karaoke" && c.label === "Karaoke Maker")).toBe(true);
    const g = GAMES.find((x) => x.slug === "karaoke-maker");
    expect(g?.category).toBe("karaoke");
    expect(g?.kind).toBe("karaoke-maker");
  });
});
