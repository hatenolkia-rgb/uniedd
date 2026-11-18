import { describe, expect, it } from "vitest";
import {
  FIRST_STRING,
  KEYS,
  SWARAS,
  centsBetween,
  defaultStrings,
  noteName,
  pluckOffsets,
  saHz,
  stringHz,
  tablaRate,
} from "../app/games/tanpura/theory";
import { estimatePitch, renderPluck } from "../app/games/tanpura/synth";
import { BOLS, TAALS, clampBpm, cycleEvents, cycleSeconds, matraInfo, pickLayer } from "../app/games/tanpura/taals";
import { GAMES } from "../app/games/catalog";

const SR = 44100;

describe("tanpura tuning maths", () => {
  it("puts Sa in a natural male and female range for all 12 keys", () => {
    for (let k = 0; k < 12; k++) {
      const male = saHz(k, "male");
      const female = saHz(k, "female");
      expect(male).toBeGreaterThanOrEqual(109);
      expect(male).toBeLessThan(208);
      expect(female).toBeGreaterThanOrEqual(164);
      expect(female).toBeLessThan(312);
    }
    expect(saHz(1, "male")).toBeCloseTo(138.59, 1); // C#3
    expect(saHz(9, "female")).toBeCloseTo(220, 5); // A3
    expect(noteName(saHz(1, "male"))).toBe("C#3");
  });

  it("applies the A4 reference and fine tune in cents", () => {
    expect(saHz(9, "female", { a4: 432 })).toBeCloseTo(216, 5);
    expect(centsBetween(saHz(0, "male", { cents: 23 }), saHz(0, "male"))).toBeCloseTo(23, 6);
    expect(saHz(0, "male", { octaveShift: 1 }) / saHz(0, "male")).toBeCloseTo(2, 9);
  });

  it("uses natural (just) ratios for the strings, or equal temperament if chosen", () => {
    const sa = 130;
    expect(stringHz(sa, { swar: "P", octave: -1, cents: 0 }, "just")).toBeCloseTo(97.5, 9);
    expect(stringHz(sa, { swar: "m", octave: -1, cents: 0 }, "just")).toBeCloseTo((130 * 4) / 3 / 2, 9);
    expect(centsBetween(stringHz(sa, { swar: "P", octave: 0, cents: 0 }, "equal"), sa)).toBeCloseTo(700, 6);
    expect(SWARAS).toHaveLength(12);
  });

  it("builds 4, 5 and 6 string sets with the chosen first string", () => {
    for (const f of FIRST_STRING) {
      for (const n of [4, 5, 6] as const) {
        const s = defaultStrings(n, f.id);
        expect(s).toHaveLength(n);
        expect(s[0].swar).toBe(f.id);
        expect(s[n - 1]).toMatchObject({ swar: "S", octave: -1 });
      }
    }
  });

  it("spaces plucks evenly with a longer pause after the last string", () => {
    const o = pluckOffsets(4);
    expect(o[0]).toBe(0);
    expect(o[1] - o[0]).toBeCloseTo(o[2] - o[1], 9);
    expect(1 - o[3]).toBeGreaterThan(o[1] - o[0]);
  });

  it("tunes the tabla dayan to Sa or Pa within ±6 semitones", () => {
    for (let k = 0; k < 12; k++) {
      for (const v of ["male", "female"] as const) {
        const sa = saHz(k, v);
        const { rate, semis } = tablaRate(sa, 265.5);
        expect(Math.abs(semis)).toBeLessThanOrEqual(6);
        const pc = (((centsBetween(265.5 * rate, sa) % 1200) + 1200) % 1200);
        expect(Math.min(pc, 1200 - pc)).toBeLessThan(0.01);
        const pa = tablaRate(sa, 265.5, "P");
        const pcp = (((centsBetween(265.5 * pa.rate, sa * 1.5) % 1200) + 1200) % 1200);
        expect(Math.min(pcp, 1200 - pcp)).toBeLessThan(0.01);
      }
    }
  });
});

describe("tanpura synthesis", () => {
  it("renders every first-string tuning at the exact pitch (within 2 cents)", () => {
    for (const voice of ["male", "female"] as const) {
      for (const key of [1, 7, 10]) {
        const sa = saHz(key, voice);
        for (const f of FIRST_STRING) {
          for (const spec of defaultStrings(4, f.id)) {
            const hz = stringHz(sa, spec, "just");
            const x = renderPluck(hz, { sampleRate: SR, duration: 3, jawari: 0.7, brightness: voice === "female" ? 1 : 0, decay: 3, seed: key + 3 });
            const est = estimatePitch(x, SR, hz, 0.2, 2.5);
            expect(Math.abs(centsBetween(est, hz)), `${voice} ${KEYS[key]} ${f.label} ${spec.swar}${spec.octave}`).toBeLessThan(2);
          }
        }
      }
    }
  }, 60_000);

  it("is loud at the pluck, rings, and fades to silence at the end", () => {
    const x = renderPluck(138.6, { sampleRate: SR, duration: 5, jawari: 0.6, brightness: 0, decay: 3 });
    const rms = (a: number, b: number) => {
      let e = 0;
      for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) e += x[i] * x[i];
      return Math.sqrt(e / ((b - a) * SR));
    };
    expect(rms(0.05, 0.5)).toBeGreaterThan(0.1);
    expect(rms(2, 2.5)).toBeGreaterThan(0.01);
    expect(Math.abs(x[x.length - 1])).toBeLessThan(1e-3);
    expect(Math.max(...x.subarray(0, SR).map(Math.abs))).toBeLessThanOrEqual(0.9001);
  });

  it("changes timbre with jawari (more upper harmonics)", () => {
    const hf = (j: number) => {
      const x = renderPluck(130, { sampleRate: SR, duration: 2, jawari: j, brightness: 0, decay: 3, seed: 5 });
      let d = 0, e = 0;
      for (let i = SR * 0.5; i < SR * 1.5; i++) {
        const dx = x[i] - x[i - 1];
        d += dx * dx;
        e += x[i] * x[i];
      }
      return d / e;
    };
    expect(hf(1)).toBeGreaterThan(hf(0) * 1.5);
  });
});

describe("taals", () => {
  it("has correct matra counts, vibhags and theka lengths", () => {
    const expected: Record<string, number> = {
      teentaal: 16, keherwa: 8, dadra: 6, rupak: 7, jhaptaal: 10, ektaal: 12,
      deepchandi: 14, tilwada: 16, jhoomra: 14, dhamar: 14, chautaal: 12,
    };
    expect(TAALS.map((t) => t.id).sort()).toEqual(Object.keys(expected).sort());
    for (const t of TAALS) {
      expect(t.matras).toBe(expected[t.id]);
      expect(t.theka).toHaveLength(t.matras);
      expect(t.vibhags.reduce((a, b) => a + b, 0)).toBe(t.matras);
      expect(t.marks).toHaveLength(t.vibhags.length);
      for (const matra of t.theka) for (const bol of matra) expect(BOLS[bol], `${t.id}: ${bol}`).toBeDefined();
    }
  });

  it("marks sam and khali in the right places", () => {
    const tt = TAALS.find((t) => t.id === "teentaal")!;
    const info = matraInfo(tt);
    expect(info.map((i) => i.mark)).toEqual(["X", null, null, null, "2", null, null, null, "0", null, null, null, "3", null, null, null]);
    expect(tt.theka.slice(8, 12).flat()).toEqual(["Dha", "Tin", "Tin", "Ta"]);
    const rupak = TAALS.find((t) => t.id === "rupak")!;
    expect(rupak.marks[0]).toBe("0");
    expect(rupak.samIsKhali).toBe(true);
    const jhap = TAALS.find((t) => t.id === "jhaptaal")!;
    expect(matraInfo(jhap).findIndex((i) => i.mark === "0")).toBe(5);
    const ek = TAALS.find((t) => t.id === "ektaal")!;
    expect(matraInfo(ek).filter((i) => i.mark === "0").length).toBe(2);
  });

  it("schedules one cycle at the exact tempo with the sam accented", () => {
    for (const t of TAALS) {
      for (const bpm of [30, 60, 120, 300]) {
        const ev = cycleEvents(t, bpm);
        const beat = 60 / bpm;
        expect(cycleSeconds(t, bpm)).toBeCloseTo(t.matras * beat, 9);
        expect(ev[0].time).toBe(0);
        expect(ev[0].vel).toBe(1);
        expect(Math.max(...ev.map((e) => e.time))).toBeLessThan(t.matras * beat);
        // every sounding matra starts on its beat
        for (const e of ev.filter((e) => e.sub === 0)) expect(e.time).toBeCloseTo(e.matra * beat, 9);
        // time strictly increases
        for (let i = 1; i < ev.length; i++) expect(ev[i].time).toBeGreaterThan(ev[i - 1].time);
      }
    }
    const tt = cycleEvents(TAALS[0], 120);
    expect(tt).toHaveLength(16);
    expect(tt[8].strokes).toEqual(["na", "ge"]); // matra 9 (khali) begins with Dha
    expect(tt[9].strokes).toEqual(["tin"]); // …then Tin without the bayan
  });

  it("clamps tempo to 30–300 and picks velocity layers", () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(999)).toBe(300);
    expect(pickLayer(0, 3)).toBe(0);
    expect(pickLayer(0.5, 3)).toBe(1);
    expect(pickLayer(1, 3)).toBe(2);
  });
});

describe("catalog", () => {
  it("lists the Tanpura & Tabla studio", () => {
    expect(GAMES.find((g) => g.slug === "tanpura-tabla")).toBeDefined();
  });
});

import { readFileSync, statSync } from "node:fs";
import { crossfadeCurves, tanpuraFrequencies, usesRecording, type RecManifest, type TanpuraSettings } from "../app/games/tanpura/engine";
import { REC_SHIFT, recordedSaHz } from "../app/games/tanpura/theory";

describe("recorded tanpura", () => {
  const man = JSON.parse(readFileSync("public/tanpura-rec/manifest.json", "utf8")) as RecManifest;
  const base: TanpuraSettings = {
    source: "recorded", key: 0, voice: "male", octaveShift: 0, cents: 0, a4: 440, temperament: "just", first: "P", count: 4,
    strings: defaultStrings(4, "P"), cycle: 5, jawari: 0.6, reverb: 0.3, volume: 0.8, shimmer: false, shimmerScale: "sapa", shimmerVolume: 0.5,
  };

  it("has a seamless-loop file for every key with Pa, Ma and Ni", () => {
    for (const t of ["P", "m", "N"]) {
      for (let k = 0; k < 12; k++) {
        const f = man.files[t][KEYS[k]];
        expect(f, `${t} ${KEYS[k]}`).toBeDefined();
        expect(f.saHz).toBeCloseTo(recordedSaHz(k), 2);
        expect(f.loop).toBeGreaterThanOrEqual(12);
        expect(f.duration).toBeCloseTo(f.loop + man.crossfade, 2);
        expect(f.onsets.length).toBeGreaterThan(3);
        for (const ext of ["ogg", "m4a"]) {
          const size = statSync(`public/tanpura-rec/${f.id}.${ext}`).size;
          expect(size).toBeGreaterThan(50_000);
          expect(size).toBeLessThan(450_000);
        }
      }
    }
  });

  it("keeps the recordings within −5…+6 semitones of the master and in a G2–F♯3 register", () => {
    expect(Math.min(...REC_SHIFT)).toBe(-5);
    expect(Math.max(...REC_SHIFT)).toBe(6);
    for (let k = 0; k < 12; k++) {
      expect(recordedSaHz(k)).toBeGreaterThan(97);
      expect(recordedSaHz(k)).toBeLessThan(186);
      expect(noteName(recordedSaHz(k)).slice(0, -1)).toBe(KEYS[k]);
    }
    expect(recordedSaHz(9, { a4: 432 }) / recordedSaHz(9)).toBeCloseTo(432 / 440, 9);
  });

  it("uses the recording for Pa, Ma and Ni and the synth for Sa and komal Ni", () => {
    expect(usesRecording({ source: "recorded", first: "P" })).toBe(true);
    expect(usesRecording({ source: "recorded", first: "m" })).toBe(true);
    expect(usesRecording({ source: "recorded", first: "N" })).toBe(true);
    expect(usesRecording({ source: "recorded", first: "S" })).toBe(false);
    expect(usesRecording({ source: "recorded", first: "n" })).toBe(false);
    expect(usesRecording({ source: "synth", first: "P" })).toBe(false);
    expect(tanpuraFrequencies({ ...base, key: 1, cents: 10 }).sa).toBeCloseTo(recordedSaHz(1, { cents: 10 }), 9);
    expect(tanpuraFrequencies({ ...base, key: 1, first: "S" }).sa).toBeCloseTo(saHz(1, "male"), 9);
  });

  it("crossfades with constant expected power for any seam correlation", () => {
    for (const rho of [0, 0.3, 0.6, 0.9]) {
      const { fin, fout } = crossfadeCurves(rho, 65);
      expect(fin[0]).toBeCloseTo(0, 9);
      expect(fout[64]).toBeCloseTo(0, 6);
      for (let i = 0; i < 65; i++) {
        const p = fin[i] ** 2 + fout[i] ** 2 + 2 * rho * fin[i] * fout[i];
        expect(p).toBeCloseTo(1, 5);
      }
    }
  });
});
