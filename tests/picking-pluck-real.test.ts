/**
 * Optional check against REAL recordings (not committed — licences vary). Runs only when
 * PICK_REAL_AUDIO points at a folder of mono 48 kHz float32 files (`*.f32`):
 *   guitar-<kind>-<NOTE>.f32   e.g. guitar-nylon-A2.f32 (a single plucked note)
 *   speech-*.f32 / sing-*.f32  human speech and singing
 * Decode with: ffmpeg -i in.mp3 -ac 1 -ar 48000 -f f32le out.f32
 */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { OnsetTracker, STRUM_MERGE_S, analyzeOnset, matchTarget, type PluckKind } from "../app/games/picking/pluck";

const DIR = process.env.PICK_REAL_AUDIO;
const SR = 48000;
const NOTE: Record<string, number> = { E2: 40, F2: 41, A2: 45, C3: 48, D3: 50, G3: 55, A3: 57, B3: 59, E4: 64 };

function load(f: string) {
  const b = fs.readFileSync(f);
  const x = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  let pk = 0;
  for (const v of x) pk = Math.max(pk, Math.abs(v));
  const y = new Float32Array(x.length + SR / 5); // 0.2 s lead-in
  for (let i = 0; i < x.length; i++) y[i + SR / 5] = (x[i] * 0.5) / (pk || 1);
  return y;
}

function listen(x: Float32Array, kind: PluckKind) {
  const tr = new OnsetTracker(SR);
  const ons: number[] = [];
  for (let i = 0; i < x.length; i += 1024)
    for (const at of tr.push(x.subarray(i, i + 1024))) {
      if (kind === "strum" && ons.length && at - ons[ons.length - 1] < STRUM_MERGE_S * SR) continue;
      ons.push(at);
    }
  const pre = SR / 10;
  const post = (SR * 3) / 10;
  return ons.map((at, k) => {
    const buf = new Float32Array(pre + post);
    for (let i = 0; i < buf.length; i++) buf[i] = x[at - pre + i] ?? 0;
    const next = ons[k + 1];
    return analyzeOnset(buf, SR, pre, { kind, end: next !== undefined && next < at + post ? pre + next - at : undefined });
  });
}

describe.skipIf(!DIR)("real recordings", () => {
  const files = DIR ? fs.readdirSync(DIR).filter((f) => f.endsWith(".f32")) : [];
  it("every recorded guitar note counts for its own note and nothing else", () => {
    const guitars = files.filter((f) => /^guitar-.*-([A-G]\d)\.f32$/.test(f));
    for (const f of guitars) {
      const note = NOTE[f.replace(/.*-([A-G]\d)\.f32$/, "$1")];
      const v = listen(load(path.join(DIR!, f)), "note").filter((r) => r.ok && r.f0 !== null);
      expect(v.filter((r) => matchTarget(r.f0!, note).ok).length, f).toBeGreaterThanOrEqual(1);
      for (const other of [40, 45, 50, 55, 59, 64].filter((m) => m !== note)) expect(v.filter((r) => matchTarget(r.f0!, other).ok).length, `${f} as ${other}`).toBe(0);
    }
  });
  it("re-picking the same recorded note counts each pick exactly once", () => {
    for (const f of files.filter((f) => /^guitar-(acoustic|nylon)-.*\.f32$/.test(f))) {
      const note = NOTE[f.replace(/.*-([A-G]\d)\.f32$/, "$1")];
      const s = load(path.join(DIR!, f));
      let j = 0;
      while (Math.abs(s[j]) < 0.0005) j++;
      const one = s.subarray(Math.max(0, j - 96), j - 96 + SR * 1.2);
      for (const gap of [0.8, 0.4]) {
        const x = new Float32Array(Math.round(SR * (1.5 + 8 * gap)));
        for (let k = 0; k < 8; k++) {
          const at = Math.round(SR * (0.3 + k * gap));
          const fade = Math.round(SR * 0.008); // the pick touching the ringing string
          for (let i = at - fade; i < x.length; i++) x[i] *= i < at ? (at - i) / fade : 0;
          for (let i = 0; i < one.length && at + i < x.length; i++) x[at + i] += one[i];
        }
        for (let i = 0; i < x.length; i++) x[i] += (Math.random() - 0.5) * 0.004;
        const n = listen(x, "note").filter((r) => r.ok && r.f0 !== null && matchTarget(r.f0, note).ok).length;
        expect(n, `${f} @${gap}`).toBeGreaterThanOrEqual(7);
        expect(n, `${f} @${gap}`).toBeLessThanOrEqual(8);
      }
    }
  });
  it("recorded speech and singing never count as a note or a strum", () => {
    for (const f of files.filter((f) => /^(speech|sing)-/.test(f))) {
      const x = load(path.join(DIR!, f));
      expect(listen(x, "note").filter((r) => r.ok).length, `${f} note`).toBe(0);
      expect(listen(x, "strum").filter((r) => r.ok).length, `${f} strum`).toBe(0);
    }
  });
});
