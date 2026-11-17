import { describe, expect, it } from "vitest";
import { OnsetTracker, STRUM_MERGE_S, analyzeOnset, matchTarget, noteLabel, stringName, type PluckKind } from "../app/games/picking/pluck";
import { CHORDS, STRUMS } from "../app/games/picking/patterns";
import { chromaFromSpectrum, frameMatches } from "../app/games/picking/chroma";
import { analyserDb, singleNote, strumFrets } from "./helpers/guitarSynth";
import { addNoise, clap, mix, pickedRun, realishPluck, sing, speech, tap, voice } from "./helpers/soundSynth";

const SR = 48000;
const OPEN = [40, 45, 50, 55, 59, 64];

/** The game's pipeline: onset tracker → 100 ms before / 300 ms after → analyzeOnset. */
function listen(x: Float32Array, kind: PluckKind, sr = SR) {
  const tr = new OnsetTracker(sr);
  const ons: number[] = [];
  for (let i = 0; i < x.length; i += 1024) {
    for (const at of tr.push(x.subarray(i, i + 1024))) {
      if (kind === "strum" && ons.length && at - ons[ons.length - 1] < STRUM_MERGE_S * sr) continue;
      ons.push(at);
    }
  }
  const pre = Math.round(0.1 * sr);
  const post = Math.round(0.3 * sr);
  return ons.map((at, k) => {
    const buf = new Float32Array(pre + post);
    for (let i = 0; i < buf.length; i++) buf[i] = x[at - pre + i] ?? 0;
    const next = ons[k + 1];
    return { at, v: analyzeOnset(buf, sr, pre, { kind, end: next !== undefined && next < at + post ? pre + (next - at) : undefined }) };
  });
}

/** Notes that would count for `target` (a real string sound at the right pitch). */
const counted = (x: Float32Array, target: number) => listen(x, "note").filter((r) => r.v.ok && r.v.f0 !== null && matchTarget(r.v.f0, target).ok).length;
const acceptedStrums = (x: Float32Array) => listen(x, "strum").filter((r) => r.v.ok).length;

const scale = (x: Float32Array, peak = 0.5) => {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  return x.map((v) => (v * peak) / (m || 1));
};

describe("target matching", () => {
  it("is note- and octave-aware within ±50 cents", () => {
    expect(matchTarget(110, 45).ok).toBe(true);
    expect(matchTarget(110 * Math.pow(2, 45 / 1200), 45).ok).toBe(true);
    expect(matchTarget(110 * Math.pow(2, 60 / 1200), 45).ok).toBe(false);
    expect(matchTarget(220, 45)).toMatchObject({ ok: false, octaveOff: true });
    expect(matchTarget(146.8, 45).ok).toBe(false); // D string when A was asked
    expect(noteLabel(45)).toBe("A2");
    expect(stringName(40)).toBe("low E");
  });
});

describe("guitar plucks count (right string), wrong strings don't", () => {
  for (const [label, make] of [
    ["Karplus-Strong", (m: number, seed: number) => singleNote(m, { seconds: 1, noise: 0.05, seed })],
    ["realistic pluck", (m: number, seed: number) => realishPluck(m, { seed, noise: 0.05 })],
    ["realistic pluck + room noise + hum", (m: number, seed: number) => realishPluck(m, { seed, noise: 0.3, hum: 0.3 })],
  ] as const) {
    it(label, () => {
      for (const m of OPEN) {
        for (const seed of [1, 2]) {
          const x = make(m, seed);
          expect(counted(x, m), `${noteLabel(m)} seed ${seed}`).toBe(1);
          for (const other of OPEN.filter((o) => o !== m)) expect(counted(x, other), `${noteLabel(m)} heard as ${noteLabel(other)}`).toBe(0);
        }
      }
    });
  }

  it("counts every note of a picked run on one string (8th notes at 100 bpm and 16ths at 75 bpm)", () => {
    for (const gap of [0.3, 0.2]) {
      const x = pickedRun(Array.from({ length: 8 }, (_, k) => ({ midi: 45, string: 1, t: 0.2 + k * gap })), { noise: 0.05 });
      const heard = listen(x, "note");
      expect(heard.length, `onsets @${gap}`).toBe(8);
      expect(counted(x, 45), `counted @${gap}`).toBeGreaterThanOrEqual(7);
    }
  });

  it("re-picking a long-ringing string counts every note (the pick damps it for a moment)", () => {
    for (const gap of [0.8, 0.5]) {
      let x = new Float32Array(Math.round(SR * (1 + 8 * gap)));
      for (let k = 0; k < 8; k++) {
        const at = Math.round(SR * (0.2 + k * gap));
        const fade = Math.round(SR * 0.008);
        for (let i = Math.max(0, at - fade); i < x.length; i++) x[i] *= i < at ? (at - i) / fade : 0;
        const p = realishPluck(40, { seed: k + 1, sustain: 3, seconds: 2 });
        x = mix(x, p.subarray(Math.round(SR * 0.1)), at).subarray(0, x.length); // (realishPluck starts after 0.1 s of silence)
      }
      addNoise(x, 0.03);
      const n = counted(x, 40);
      expect(n, `@${gap}`).toBeGreaterThanOrEqual(7);
      expect(n, `@${gap}`).toBeLessThanOrEqual(8);
    }
  });

  it("level dips while one note rings (tremolo, a glitch) never count as extra notes", () => {
    const x = realishPluck(40, { seed: 3, sustain: 3, seconds: 2 });
    for (let t = 0.3; t < 1.9; t += 0.065) for (let i = Math.round(t * SR); i < Math.round((t + 0.01) * SR); i++) x[i] *= 0.3;
    expect(counted(x, 40)).toBeLessThanOrEqual(1);
  });

  it("string hop: 4 on the low E, then 4 on the A while the E still rings", () => {
    const notes = [...Array.from({ length: 4 }, (_, k) => ({ midi: 40, string: 0, t: 0.2 + k * 0.3 })), ...Array.from({ length: 4 }, (_, k) => ({ midi: 45, string: 1, t: 1.4 + k * 0.3 }))];
    const x = pickedRun(notes, { noise: 0.05 });
    const heard = listen(x, "note");
    const ok = heard.filter((r) => r.v.ok && r.v.f0 !== null);
    const e = ok.filter((r) => r.at < 1.35 * SR && matchTarget(r.v.f0!, 40).ok).length;
    const a = ok.filter((r) => r.at > 1.35 * SR && matchTarget(r.v.f0!, 45).ok).length;
    expect(e).toBeGreaterThanOrEqual(3);
    expect(a).toBeGreaterThanOrEqual(3);
  });
});

describe("voices, claps and taps never count", () => {
  const VOICE_PHRASES = [
    ["down", "up", "down", "up"],
    ["play", "the", "a", "string"],
    ["hello", "is", "this", "right"],
    ["one", "two", "three", "four", "five"],
  ];

  it("speech (several speakers, adult and child pitch) — as picked notes and as strums", () => {
    for (const [i, words] of VOICE_PHRASES.entries()) {
      for (const f0 of [100, 140, 220, 300]) {
        const x = speech(words, { seed: i * 7 + f0, f0 });
        for (const m of OPEN) expect(counted(x, m), `speech ${words.join(" ")} @${f0} as ${noteLabel(m)}`).toBe(0);
        expect(acceptedStrums(x), `speech ${words.join(" ")} @${f0} as strum`).toBe(0);
      }
    }
  });

  it("singing the target note (vibrato, straight tone, sharp 'ta' starts, humming)", () => {
    for (const m of OPEN) {
      const takes = [
        sing(m, { seed: m }),
        sing(m, { seed: m + 1, vibratoCents: 0 }),
        sing(m, { seed: m + 2, vibratoCents: 0, attackMs: 8, consonant: "t", seconds: 0.5 }),
        sing(m, { seed: m + 3, vibratoCents: 15, attackMs: 20, consonant: "d", seconds: 0.4 }),
        sing(m, { seed: m + 4, vowel: "u", consonant: "m", vibratoCents: 10 }), // humming
        sing(m + 12, { seed: m + 5 }), // a child an octave up
        // hard case: a sung note shaped like a pluck (fast start, dying away)
        sing(m, { seed: m + 6, vibratoCents: 0, attackMs: 5, decay: 0.3, consonant: "t", seconds: 0.8 }),
      ];
      takes.forEach((x, k) => {
        expect(counted(x, m), `sung ${noteLabel(m)} take ${k}`).toBe(0);
        expect(acceptedStrums(x), `sung ${noteLabel(m)} take ${k} as strum`).toBe(0);
      });
    }
  });

  it("singing the chord notes one after another (G major arpeggio) is not a strum", () => {
    const g = [55, 59, 62, 67].map((m) => 440 * Math.pow(2, (m - 69) / 12));
    const x = voice(g.map((f) => ({ f0: [f, f] as [number, number], seconds: 0.45, vowel: "a" as const, vibratoCents: 30, consonant: "l" as const })), { gapS: 0.05 });
    expect(acceptedStrums(x)).toBe(0);
  });

  it("claps and taps (on a table or the guitar body)", () => {
    for (let seed = 1; seed <= 6; seed++) {
      for (const x of [clap({ seed }), tap({ seed, f: 120 + seed * 40 })]) {
        for (const m of OPEN) expect(counted(x, m)).toBe(0);
        expect(acceptedStrums(x)).toBe(0);
      }
    }
  });

  it("a practice session: plucks mixed with talking, singing and claps — only the plucks count", () => {
    const parts: [Float32Array, number][] = [
      [speech(["down", "up", "down", "up"], { seed: 3 }), 0],
      [realishPluck(45, { seed: 1 }), 1.6],
      [clap({ seed: 2 }), 2.8],
      [sing(45, { seed: 9 }), 3.4],
      [realishPluck(45, { seed: 2 }), 5.0],
      [speech(["is", "this", "right"], { seed: 8, f0: 260 }), 6.2],
      [realishPluck(50, { seed: 3 }), 7.6], // wrong string
      [tap({ seed: 4 }), 8.8],
      [realishPluck(45, { seed: 4 }), 9.4],
    ];
    let x = new Float32Array(Math.floor(SR * 11));
    for (const [p, t] of parts) x = mix(x, scale(p, 0.4), Math.floor(t * SR));
    addNoise(x, 0.02);
    expect(counted(x, 45)).toBe(3);
  });
});

describe("strums: every level chord still passes the strum check and the chord match", () => {
  const chords = [...new Set(Object.values(STRUMS).flatMap((l) => l.flatMap((e) => e.chords.map(([n]) => n))))];
  it("all 19 chords, down and up strums, with room noise", () => {
    expect(chords.length).toBe(19);
    const misses: string[] = [];
    for (const name of chords) {
      for (const [dir, seed] of [["D", 1], ["U", 2]] as const) {
        const x = new Float32Array(Math.floor(SR * 1.6));
        x.set(strumFrets(CHORDS[name].frets, { seconds: 1.4, noise: 0.3, hum: 0.2, dir, seed }), Math.floor(0.1 * SR));
        const strums = listen(x, "strum").filter((r) => r.v.ok);
        const chroma = chromaFromSpectrum(analyserDb(x, Math.floor(0.9 * SR), 16384), SR, 16384).chroma;
        if (strums.length < 1 || !frameMatches(chroma, name).match) misses.push(`${name}/${dir}`);
      }
    }
    expect(misses).toEqual([]);
  });
});

describe("OnsetTracker", () => {
  it("finds one onset per pluck and none for a steady hum or tremolo", () => {
    const x = new Float32Array(SR * 2);
    for (let i = 0; i < x.length; i++) x[i] = 0.2 * Math.sin((2 * Math.PI * 110 * i) / SR) * (0.6 + 0.4 * Math.sin((2 * Math.PI * 5 * i) / SR));
    const tr = new OnsetTracker(SR);
    const found: number[] = [];
    for (let i = 0; i < x.length; i += 1024) found.push(...tr.push(x.subarray(i, i + 1024)));
    expect(found.length).toBeLessThanOrEqual(1); // only the very start
    const y = mix(mix(new Float32Array(SR * 2), realishPluck(45, { seed: 1 }), 0), realishPluck(50, { seed: 2 }), SR);
    const tr2 = new OnsetTracker(SR);
    const f2: number[] = [];
    for (let i = 0; i < y.length; i += 1024) f2.push(...tr2.push(y.subarray(i, i + 1024)));
    expect(f2.length).toBe(2);
  });
});
