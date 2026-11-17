import { describe, expect, it } from "vitest";
import { CHORDS, STRUMS } from "../app/games/picking/patterns";
import { SustainMeter, bestChord, bestNote, chromaFromSpectrum, frameMatches, parseChord, sameChord } from "../app/games/picking/chroma";
import { analyserDb, singleNote, strumFrets } from "./helpers/guitarSynth";

const SR = 48000;
const N = 16384;
const LEVEL_CHORDS = [...new Set(Object.values(STRUMS).flatMap((list) => list.flatMap((e) => e.chords.map(([n]) => n))))];

function frames(sig: Float32Array) {
  return [0.45, 0.7, 0.95, 1.2].map((end) => chromaFromSpectrum(analyserDb(sig, Math.floor(end * SR), N), SR, N).chroma);
}

describe("chord recognition on synthesized guitar strums", () => {
  it("covers every chord used in the levels, including barre chords", () => {
    expect(LEVEL_CHORDS.length).toBeGreaterThanOrEqual(19);
    const beginner = new Set(STRUMS.beginner.flatMap((e) => e.chords.map(([n]) => n)));
    expect([...beginner].sort()).toEqual(["Am", "C", "D", "Em", "G"]);
    expect(LEVEL_CHORDS.filter((n) => CHORDS[n].barre).sort()).toEqual(["Bb", "Bm", "Cm", "F", "F#m", "Gm"]);
  });

  for (const [label, noise, hum] of [
    ["clean", 0, 0],
    ["noisy room (≈ +6 dB SNR + mains hum)", 0.5, 0.3],
    ["very noisy (≈ −3 dB SNR)", 1.5, 0.3],
  ] as const) {
    it(`recognises the called chord — ${label}`, () => {
      let hits = 0;
      let total = 0;
      const misses: string[] = [];
      for (const name of LEVEL_CHORDS) {
        for (const [seed, dir] of [[1, "D"], [2, "U"], [3, "D"]] as const) {
          const sig = strumFrets(CHORDS[name].frets, { sr: SR, noise, hum, seed, dir, seconds: 1.4 });
          const fr = frames(sig);
          const ok = fr.filter((c) => frameMatches(c, name).match).length;
          total++;
          // a strum counts when most frames of its ring match (the game needs ~0.6 s of matching)
          if (ok >= 3) hits++;
          else misses.push(`${name}/${dir}`);
        }
      }
      const rate = hits / total;
      console.log(`${label}: ${hits}/${total} strums recognised${misses.length ? ` (missed ${misses.join(", ")})` : ""}`);
      expect(rate).toBeGreaterThanOrEqual(noise > 1 ? 0.9 : 0.97);
    });
  }

  it("does not accept a different chord (wrong chord never passes)", () => {
    let falseAccepts = 0;
    let checks = 0;
    for (const played of LEVEL_CHORDS) {
      const sig = strumFrets(CHORDS[played].frets, { sr: SR, noise: 0.5, hum: 0.3, seed: 9, seconds: 1.4 });
      const fr = frames(sig);
      for (const target of LEVEL_CHORDS) {
        if (sameChord(parseChord(target)!, parseChord(played)!)) continue;
        checks++;
        // the game needs a sustained match, so a false accept = most frames matching
        if (fr.filter((c) => frameMatches(c, target).match).length >= 3) falseAccepts++;
      }
    }
    expect(checks).toBeGreaterThan(300);
    expect(falseAccepts).toBe(0);
  });

  it("tells major from minor on the same root", () => {
    for (const [maj, min] of [["E", "Em"], ["A", "Am"], ["D", "Dm"], ["G", "Gm"]]) {
      const c = frames(strumFrets(CHORDS[min].frets, { sr: SR, noise: 0.3, seed: 4 }))[1];
      expect(frameMatches(c, min).match, min).toBe(true);
      expect(frameMatches(c, maj).match, `${min} heard as ${maj}`).toBe(false);
    }
  });

  it("noise alone never names a chord with confidence", () => {
    const sig = new Float32Array(SR);
    let s = 1;
    for (let i = 0; i < sig.length; i++) {
      s = (s * 16807) % 2147483647;
      sig[i] = (s / 2147483647 - 0.5) * 0.1;
    }
    const c = chromaFromSpectrum(analyserDb(sig, SR, N), SR, N).chroma;
    const g = bestChord(c);
    const matchesAny = LEVEL_CHORDS.some((n) => frameMatches(c, n).match);
    expect(matchesAny && (g?.score ?? 0) > 0.9).toBe(false);
  });

  it("names single open-string notes for the picking string check", () => {
    const names: Record<number, string> = { 40: "E", 45: "A", 50: "D", 55: "G", 59: "B", 64: "E" };
    for (const [midi, name] of Object.entries(names)) {
      const sig = singleNote(Number(midi), { sr: SR, noise: 0.3, seed: Number(midi) });
      const c = chromaFromSpectrum(analyserDb(sig, Math.floor(0.4 * SR), N), SR, N).chroma;
      expect(bestNote(c)?.name, `midi ${midi}`).toBe(name);
    }
  });
});

describe("SustainMeter", () => {
  it("needs ~0.6 s of matching, short gaps only drain it slowly", () => {
    const m = new SustainMeter(0.6);
    let done = false;
    for (let i = 0; i < 5; i++) done = m.update(true, 0.06) || done;
    expect(done).toBe(false);
    m.update(false, 0.06);
    for (let i = 0; i < 6 && !done; i++) done = m.update(true, 0.06);
    expect(done).toBe(true);
    m.reset();
    expect(m.progress).toBe(0);
  });
});
