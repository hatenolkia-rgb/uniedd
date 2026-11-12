// Chess puzzle data: a static, chunked set in /public/chess-puzzles (public-domain CC0 data),
// lazy-loaded per difficulty level. Each chunk holds ~4,000 puzzles sorted by rating.

export type RawPuzzle = [id: string, fen4: string, moves: string, rating: number, themes: number[]];

export type Puzzle = {
  id: string;
  /** Position BEFORE the opponent's first move (moves[0] is auto-played). */
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  level: LevelId;
};

export type LevelId = "beginner" | "easy" | "medium" | "hard" | "expert";

export type ManifestLevel = {
  id: LevelId;
  name: string;
  stars: number;
  min: number;
  max: number;
  count: number;
  /** t = puzzles per theme index in that chunk (lets a theme search skip chunks without it). */
  chunks: { f: string; n: number; min: number; max: number; t?: Record<string, number> }[];
  themes: Record<string, number>;
};

export type Manifest = { version: number; themes: string[]; levels: ManifestLevel[] };

export const BASE = "/chess-puzzles";

/** Friendly names for the themes shown in the filter (others are kept but not listed). */
export const THEME_LABELS: Record<string, string> = {
  mateIn1: "Mate in 1",
  mateIn2: "Mate in 2",
  mateIn3: "Mate in 3",
  mateIn4: "Mate in 4",
  mate: "Checkmate",
  fork: "Fork",
  pin: "Pin",
  skewer: "Skewer",
  discoveredAttack: "Discovered attack",
  doubleCheck: "Double check",
  hangingPiece: "Hanging piece",
  trappedPiece: "Trapped piece",
  sacrifice: "Sacrifice",
  deflection: "Deflection",
  attraction: "Attraction",
  clearance: "Clearance",
  intermezzo: "In-between move",
  interference: "Interference",
  xRayAttack: "X-ray",
  zugzwang: "Zugzwang",
  quietMove: "Quiet move",
  defensiveMove: "Defensive move",
  backRankMate: "Back-rank mate",
  smotheredMate: "Smothered mate",
  promotion: "Promotion",
  underPromotion: "Under-promotion",
  advancedPawn: "Advanced pawn",
  kingsideAttack: "Kingside attack",
  queensideAttack: "Queenside attack",
  exposedKing: "Exposed king",
  attackingF2F7: "Attacking f2/f7",
  capturingDefender: "Remove the defender",
  enPassant: "En passant",
  castling: "Castling",
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
  pawnEndgame: "Pawn endgame",
  rookEndgame: "Rook endgame",
  bishopEndgame: "Bishop endgame",
  knightEndgame: "Knight endgame",
  queenEndgame: "Queen endgame",
  oneMove: "One-move puzzle",
  short: "Short (2 moves)",
  long: "Long (3 moves)",
  veryLong: "Very long (4+ moves)",
};

export function decode(raw: RawPuzzle, themes: string[], level: LevelId): Puzzle {
  return {
    id: raw[0],
    fen: `${raw[1]} 0 1`,
    moves: raw[2].split(" "),
    rating: raw[3],
    themes: raw[4].map((i) => themes[i]).filter(Boolean),
    level,
  };
}

export function levelForRating(levels: ManifestLevel[], rating: number) {
  return levels.find((l) => rating >= l.min && rating < l.max) ?? (rating < levels[0].min ? levels[0] : levels[levels.length - 1]);
}

// ---------- loading ----------
let manifestP: Promise<Manifest> | null = null;
const chunkCache = new Map<string, Promise<RawPuzzle[]>>();

export function loadManifest(): Promise<Manifest> {
  if (!manifestP) {
    manifestP = fetch(`${BASE}/manifest.json`).then((r) => {
      if (!r.ok) throw new Error(`manifest ${r.status}`);
      return r.json() as Promise<Manifest>;
    });
    manifestP.catch(() => (manifestP = null));
  }
  return manifestP;
}

export function loadChunk(file: string): Promise<RawPuzzle[]> {
  let p = chunkCache.get(file);
  if (!p) {
    p = fetch(`${BASE}/${file}`).then((r) => {
      if (!r.ok) throw new Error(`chunk ${r.status}`);
      return r.json() as Promise<RawPuzzle[]>;
    });
    p.catch(() => chunkCache.delete(file));
    chunkCache.set(file, p);
  }
  return p;
}

// ---------- picking ----------
const SEEN_KEY = "uniedd-chess-seen";
function seenSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}
export function markSeen(id: string) {
  try {
    const arr = (JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as string[]).filter((x) => x !== id);
    arr.push(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr.slice(-3000)));
  } catch {
    /* ignore */
  }
}

type PickOpts = { level?: LevelId; rating?: number; window?: number; theme?: string; rnd?: () => number };

/** How well a pick matched the request: exact, or which constraint had to be relaxed. */
export type PickNote = "exact" | "wider-rating" | "other-level" | "no-theme";
export type Pick = { puzzle: Puzzle; note: PickNote };

/** Puzzles of a theme in one level (from the manifest). */
export function themeCount(level: ManifestLevel, themeIdx: number) {
  return themeIdx < 0 ? level.count : level.themes[themeIdx] ?? 0;
}

const chunkHas = (c: ManifestLevel["chunks"][number], themeIdx: number) => themeIdx < 0 || !c.t || (c.t[themeIdx] ?? 0) > 0;

async function pickIn(
  m: Manifest,
  level: ManifestLevel,
  themeIdx: number,
  rating: number | undefined,
  window: number,
  seen: Set<string>,
  rnd: () => number,
): Promise<Puzzle | null> {
  let chunks = level.chunks.filter((c) => chunkHas(c, themeIdx));
  if (rating !== undefined && Number.isFinite(window)) chunks = chunks.filter((c) => c.max >= rating - window && c.min <= rating + window);
  if (!chunks.length) return null;
  // chunks that know their theme counts are reliable; otherwise try a few
  const order = [...chunks].sort(() => rnd() - 0.5).slice(0, chunks[0].t ? chunks.length : 6);
  let fallback: RawPuzzle | null = null;
  for (const c of order) {
    const list = await loadChunk(c.f);
    const ok = list.filter(
      (p) => (themeIdx < 0 || p[4].includes(themeIdx)) && (rating === undefined || !Number.isFinite(window) || Math.abs(p[3] - rating) <= window),
    );
    if (!ok.length) continue;
    const fresh = ok.filter((p) => !seen.has(p[0]));
    if (fresh.length) return decode(fresh[Math.floor(rnd() * fresh.length)], m.themes, level.id);
    fallback ??= ok[Math.floor(rnd() * ok.length)];
    if (order.length > 3) break;
  }
  return fallback ? decode(fallback, m.themes, level.id) : null;
}

/**
 * Pick a random unseen puzzle by level and/or near a rating, optionally with a theme.
 * A theme is never silently dropped: if it has no puzzles in range the search widens the
 * rating window, then tries the nearest other levels, and says so in `note`.
 */
export async function pickPuzzleWithNote(m: Manifest, opts: PickOpts): Promise<Pick> {
  const rnd = opts.rnd ?? Math.random;
  const level = opts.level ? m.levels.find((l) => l.id === opts.level) ?? m.levels[0] : levelForRating(m.levels, opts.rating ?? 1200);
  const themeIdx = opts.theme ? m.themes.indexOf(opts.theme) : -1;
  const seen = seenSet();
  const r = opts.rating;
  const w = opts.window ?? 150;

  let p = await pickIn(m, level, themeIdx, r, w, seen, rnd);
  if (p) return { puzzle: p, note: "exact" };
  if (r !== undefined) {
    for (const wider of [w * 2, w * 4]) {
      p = await pickIn(m, level, themeIdx, r, wider, seen, rnd);
      if (p) return { puzzle: p, note: "wider-rating" };
    }
    p = await pickIn(m, level, themeIdx, undefined, Infinity, seen, rnd);
    if (p) return { puzzle: p, note: "wider-rating" };
  }
  if (themeIdx >= 0) {
    const i = m.levels.indexOf(level);
    const others = m.levels
      .map((l, j) => ({ l, d: Math.abs(j - i) }))
      .filter((x) => x.l !== level && themeCount(x.l, themeIdx) > 0)
      .sort((a, b) => a.d - b.d);
    for (const { l } of others) {
      p = await pickIn(m, l, themeIdx, undefined, Infinity, seen, rnd);
      if (p) return { puzzle: p, note: "other-level" };
    }
  }
  // the theme doesn't exist at all: any puzzle from the level
  const list = await loadChunk(level.chunks[Math.floor(rnd() * level.chunks.length)].f);
  return { puzzle: decode(list[Math.floor(rnd() * list.length)], m.themes, level.id), note: themeIdx >= 0 ? "no-theme" : "exact" };
}

export async function pickPuzzle(m: Manifest, opts: PickOpts): Promise<Puzzle> {
  return (await pickPuzzleWithNote(m, opts)).puzzle;
}

/** A specific puzzle from a share link (?p=<chunk>:<id>, e.g. ?p=easy-003:abc12). */
export async function puzzleFromLink(m: Manifest, link: string): Promise<Puzzle | null> {
  const [chunkName, id] = link.split(":");
  if (!chunkName || !id || !/^[a-z]+-\d{3}$/.test(chunkName)) return null;
  const level = m.levels.find((l) => l.chunks.some((c) => c.f === `${chunkName}.json`));
  if (!level) return null;
  const list = await loadChunk(`${chunkName}.json`);
  const raw = list.find((p) => p[0] === id);
  return raw ? decode(raw, m.themes, level.id) : null;
}

/** Same puzzle for everyone on a given day (local date), from the Medium level. */
export async function dailyPuzzle(m: Manifest, date = new Date()): Promise<Puzzle> {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const level = m.levels.find((l) => l.id === "medium") ?? m.levels[0];
  const chunk = level.chunks[h % level.chunks.length];
  const list = await loadChunk(chunk.f);
  return decode(list[Math.floor(h / level.chunks.length) % list.length], m.themes, level.id);
}

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ---------- rating ----------
export function expected(player: number, puzzle: number) {
  return 1 / (1 + Math.pow(10, (puzzle - player) / 400));
}

/** Elo-style update; bigger steps for the first 20 puzzles so a new rating settles fast. */
export function updateRating(player: number, puzzle: number, solved: boolean, played: number) {
  const k = played < 20 ? 48 : played < 60 ? 32 : 20;
  const next = player + k * ((solved ? 1 : 0) - expected(player, puzzle));
  return Math.max(400, Math.min(3200, Math.round(next)));
}

export type Progress = { rating: number; played: number; solved: number; streak: number; bestStreak: number; rushBest: number; daily: Record<string, boolean> };
export const PROGRESS_KEY = "uniedd-chess-progress";
export const DEFAULT_PROGRESS: Progress = { rating: 1000, played: 0, solved: 0, streak: 0, bestStreak: 0, rushBest: 0, daily: {} };

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null") as Partial<Progress> | null;
    return { ...DEFAULT_PROGRESS, ...(p ?? {}), daily: { ...(p?.daily ?? {}) } };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}
export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** UCI "e7e8q" -> {from,to,promotion}. */
export function parseUci(u: string) {
  return { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined };
}
