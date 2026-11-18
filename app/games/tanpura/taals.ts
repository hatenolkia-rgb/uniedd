// Tabla thekas and the scheduling maths — pure data/functions (unit tested).

export type StrokeId = "na" | "tin" | "tun" | "ti" | "ke" | "ge" | "gem" | "geb";

/** How each bol is played: dayan / bayan strokes plus a relative loudness. */
export const BOLS: Record<string, { strokes: StrokeId[]; vel?: number }> = {
  Dha: { strokes: ["na", "ge"] },
  Dhin: { strokes: ["tin", "ge"] },
  Dhi: { strokes: ["tin", "ge"], vel: 0.9 },
  Din: { strokes: ["tin", "ge"] },
  Na: { strokes: ["na"] },
  Ta: { strokes: ["na"] },
  Tin: { strokes: ["tin"] },
  Ti: { strokes: ["tin"], vel: 0.85 },
  Tu: { strokes: ["tun"] },
  Ge: { strokes: ["ge"], vel: 0.85 },
  Ga: { strokes: ["ge"], vel: 0.85 },
  Ka: { strokes: ["ke"] },
  Ke: { strokes: ["ke"] },
  Kat: { strokes: ["ke"], vel: 1 },
  Kit: { strokes: ["ke"], vel: 0.8 },
  // fast-phrase syllables (closed dayan strokes)
  Te: { strokes: ["ti"], vel: 0.8 },
  Ṭi: { strokes: ["ti"], vel: 0.85 },
  Ra: { strokes: ["ti"], vel: 0.65 },
  Ki: { strokes: ["ke"], vel: 0.7 },
  Di: { strokes: ["tin", "gem"], vel: 0.8 },
  "-": { strokes: [] },
};

export type Mark = "X" | "0" | string; // X = sam, 0 = khali, numbers = tali

export type Taal = {
  id: string;
  name: string;
  matras: number;
  /** Matras per vibhag (section). */
  vibhags: number[];
  /** Clap marks for each vibhag: X (sam), 0 (khali) or the tali number. */
  marks: Mark[];
  /** One entry per matra; each matra lists its evenly spaced bols ("-" = rest). */
  theka: string[][];
  /** Suggested tempo (matras per minute). */
  bpm: number;
  feel: string;
  /** Rupak's sam falls on a khali (wave). */
  samIsKhali?: boolean;
};

const m = (...matras: string[]) => matras.map((x) => x.split(" "));

export const TAALS: Taal[] = [
  {
    id: "teentaal", name: "Teentaal", matras: 16, vibhags: [4, 4, 4, 4], marks: ["X", "2", "0", "3"], bpm: 120,
    feel: "The most popular taal — 16 beats",
    theka: m("Dha", "Dhin", "Dhin", "Dha", "Dha", "Dhin", "Dhin", "Dha", "Dha", "Tin", "Tin", "Ta", "Ta", "Dhin", "Dhin", "Dha"),
  },
  {
    id: "keherwa", name: "Keherwa", matras: 8, vibhags: [4, 4], marks: ["X", "0"], bpm: 100,
    feel: "Bhajans, film and folk songs — 8 beats",
    theka: m("Dha", "Ge", "Na", "Ti", "Na", "Ke", "Dhi", "Na"),
  },
  {
    id: "dadra", name: "Dadra", matras: 6, vibhags: [3, 3], marks: ["X", "0"], bpm: 110,
    feel: "Light songs and ghazals — 6 beats",
    theka: m("Dha", "Dhi", "Na", "Dha", "Tu", "Na"),
  },
  {
    id: "rupak", name: "Rupak", matras: 7, vibhags: [3, 2, 2], marks: ["0", "1", "2"], bpm: 110, samIsKhali: true,
    feel: "7 beats — the sam is a wave (khali)",
    theka: m("Tin", "Tin", "Na", "Dhi", "Na", "Dhi", "Na"),
  },
  {
    id: "jhaptaal", name: "Jhaptaal", matras: 10, vibhags: [2, 3, 2, 3], marks: ["X", "2", "0", "3"], bpm: 110,
    feel: "Classical songs — 10 beats",
    theka: m("Dhi", "Na", "Dhi", "Dhi", "Na", "Ti", "Na", "Dhi", "Dhi", "Na"),
  },
  {
    id: "ektaal", name: "Ektaal", matras: 12, vibhags: [2, 2, 2, 2, 2, 2], marks: ["X", "0", "2", "0", "3", "4"], bpm: 60,
    feel: "Slow (vilambit) and fast khayal — 12 beats",
    theka: m("Dhin", "Dhin", "Dha Ge", "Ṭi Ra Ki Ta", "Tu", "Na", "Kat", "Ta", "Dha Ge", "Ṭi Ra Ki Ta", "Dhin", "Na"),
  },
  {
    id: "deepchandi", name: "Deepchandi", matras: 14, vibhags: [3, 4, 3, 4], marks: ["X", "2", "0", "3"], bpm: 90,
    feel: "Thumri and Holi songs — 14 beats",
    theka: m("Dha", "Dhin", "-", "Dha", "Dha", "Tin", "-", "Ta", "Tin", "-", "Dha", "Dha", "Dhin", "-"),
  },
  {
    id: "tilwada", name: "Tilwada", matras: 16, vibhags: [4, 4, 4, 4], marks: ["X", "2", "0", "3"], bpm: 45,
    feel: "Slow (vilambit) khayal — 16 beats",
    theka: m("Dha", "Ṭi Ra Ki Ta", "Dhin", "Dhin", "Dha", "Dha", "Tin", "Tin", "Ta", "Ṭi Ra Ki Ta", "Dhin", "Dhin", "Dha", "Dha", "Dhin", "Dhin"),
  },
  {
    id: "jhoomra", name: "Jhoomra", matras: 14, vibhags: [3, 4, 3, 4], marks: ["X", "2", "0", "3"], bpm: 40,
    feel: "Slow (vilambit) khayal — 14 beats",
    theka: m("Dhin", "- Dha", "Ṭi Ra Ki Ta", "Dhin", "Dhin", "Dha Ge", "Ṭi Ra Ki Ta", "Tin", "- Ta", "Ṭi Ra Ki Ta", "Dhin", "Dhin", "Dha Ge", "Ṭi Ra Ki Ta"),
  },
  {
    id: "dhamar", name: "Dhamar", matras: 14, vibhags: [5, 2, 3, 4], marks: ["X", "2", "0", "3"], bpm: 70,
    feel: "Dhrupad-style Holi songs — 14 beats",
    theka: m("Ka", "Dhi", "Ta", "Dhi", "Ta", "Dha", "-", "Ga", "Ti", "Ta", "Ti", "Ta", "Ta", "-"),
  },
  {
    id: "chautaal", name: "Chautaal", matras: 12, vibhags: [2, 2, 2, 2, 2, 2], marks: ["X", "0", "2", "0", "3", "4"], bpm: 80,
    feel: "Dhrupad style — 12 beats",
    theka: m("Dha", "Dha", "Din", "Ta", "Kit Dha", "Din", "Ta", "Te Te", "Ka Ta", "Ga Di", "Ge Na", "-"),
  },
];

export const MIN_BPM = 30;
export const MAX_BPM = 300;

export function clampBpm(b: number) {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(b)));
}

export function laya(bpm: number): string {
  if (bpm < 60) return "Vilambit (slow)";
  if (bpm < 140) return "Madhya (medium)";
  if (bpm < 220) return "Drut (fast)";
  return "Ati-drut (very fast)";
}

/** Vibhag index and mark for each matra. */
export function matraInfo(t: Taal) {
  const info: { vibhag: number; mark: Mark | null; first: boolean }[] = [];
  t.vibhags.forEach((len, v) => {
    for (let i = 0; i < len; i++) info.push({ vibhag: v, mark: i === 0 ? t.marks[v] : null, first: i === 0 });
  });
  return info;
}

export function bolLabel(matra: string[]) {
  return matra.map((b) => (b === "-" ? "–" : b)).join("");
}

export type TablaEvent = {
  /** Seconds from the start of the cycle. */
  time: number;
  matra: number;
  sub: number;
  bol: string;
  strokes: StrokeId[];
  /** 0..1 intended loudness before humanising. */
  vel: number;
};

/** Every stroke in one avartan (cycle) at the given tempo. */
export function cycleEvents(t: Taal, bpm: number): TablaEvent[] {
  const beat = 60 / bpm;
  const info = matraInfo(t);
  const out: TablaEvent[] = [];
  t.theka.forEach((matra, mi) => {
    const sub = beat / matra.length;
    matra.forEach((bol, si) => {
      const def = BOLS[bol];
      if (!def) throw new Error(`unknown bol ${bol} in ${t.id}`);
      if (!def.strokes.length) return;
      const mk = info[mi];
      let vel = 0.72;
      if (si === 0 && mi === 0) vel = 1;
      else if (si === 0 && mk.first) vel = mk.mark === "0" ? 0.8 : 0.88;
      else if (si > 0) vel = 0.62;
      out.push({ time: mi * beat + si * sub, matra: mi, sub: si, bol, strokes: def.strokes, vel: mi === 0 && si === 0 ? 1 : Math.min(1, vel * (def.vel ?? 1)) });
    });
  });
  return out;
}

export function cycleSeconds(t: Taal, bpm: number) {
  return (t.matras * 60) / bpm;
}

/** Choose a sample layer for a velocity: layers are sorted soft → loud. */
export function pickLayer(vel: number, layers: number) {
  return Math.max(0, Math.min(layers - 1, Math.floor(vel * layers - 1e-9)));
}
