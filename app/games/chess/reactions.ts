// Quick emoji reactions for online chess (shared by browser + server).
//
// Reactions are picked from a fixed, family-friendly allowlist and sent as an
// id (never free text). The server stores the latest reaction per player in
// the existing chess_games.last_move jsonb column under `rx`, so no new SQL is
// needed: the opponent receives it through the same Realtime UPDATE / polling
// that already delivers moves. The next move overwrites last_move, which
// clears old reactions automatically.

export type Side = "w" | "b";

export const REACTIONS = [
  { id: "wave", emoji: "👋", label: "Hi!" },
  { id: "thumbs", emoji: "👍", label: "Nice" },
  { id: "clap", emoji: "👏", label: "Well played" },
  { id: "fire", emoji: "🔥", label: "On fire" },
  { id: "wow", emoji: "😮", label: "Wow" },
  { id: "think", emoji: "🤔", label: "Hmm…" },
  { id: "laugh", emoji: "😄", label: "Ha!" },
  { id: "oops", emoji: "😅", label: "Oops" },
  { id: "party", emoji: "🎉", label: "Yay" },
  { id: "gg", emoji: "🤝", label: "Good game" },
] as const;

export type ReactionId = (typeof REACTIONS)[number]["id"];
export type Reaction = { e: ReactionId; id: string; at: number };
export type Reactions = { w?: Reaction; b?: Reaction };

/** Minimum gap between two reactions from the same player (checked on the server). */
export const REACTION_COOLDOWN_MS = 1500;
/** Per-IP cap on reactions (on top of the per-player cooldown). */
export const REACTION_IP_LIMIT = 30;
export const REACTION_IP_WINDOW_MS = 60_000;

const IDS = new Set<string>(REACTIONS.map((r) => r.id));
const TOKEN = /^[a-z0-9]{4,24}$/i;

export function isReactionId(x: unknown): x is ReactionId {
  return typeof x === "string" && IDS.has(x);
}

export function reactionEmoji(id: ReactionId): string {
  return REACTIONS.find((r) => r.id === id)?.emoji ?? "";
}

export function reactionLabel(id: ReactionId): string {
  return REACTIONS.find((r) => r.id === id)?.label ?? "";
}

function parseOne(raw: unknown): Reaction | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (!isReactionId(r.e) || typeof r.id !== "string" || !TOKEN.test(r.id)) return undefined;
  const at = Number(r.at);
  if (!Number.isFinite(at) || at <= 0) return undefined;
  return { e: r.e, id: r.id, at };
}

/** Read (and validate) the `rx` object stored inside last_move. Unknown data is dropped. */
export function parseReactions(raw: unknown): Reactions | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const out: Reactions = {};
  const w = parseOne(r.w);
  const b = parseOne(r.b);
  if (w) out.w = w;
  if (b) out.b = b;
  return w || b ? out : undefined;
}

export type AddReaction = { ok: true; reactions: Reactions; reaction: Reaction } | { ok: false; error: string; retryMs: number };

/** Add a reaction by `side`, enforcing the allowlist and the per-player cooldown. */
export function addReaction(current: Reactions | undefined, side: Side, e: unknown, now: number, id: string): AddReaction {
  if (!isReactionId(e)) return { ok: false, error: "Pick one of the emoji buttons.", retryMs: 0 };
  const prev = current?.[side];
  if (prev && now - prev.at < REACTION_COOLDOWN_MS) {
    return { ok: false, error: "Slow down a little 🙂", retryMs: REACTION_COOLDOWN_MS - (now - prev.at) };
  }
  const reaction: Reaction = { e, id, at: now };
  return { ok: true, reaction, reactions: { ...(current ?? {}), [side]: reaction } };
}

/** Combine two copies of the same position's reactions, keeping the newest per player. */
export function mergeReactions(a: Reactions | undefined, b: Reactions | undefined): Reactions | undefined {
  if (!a) return b;
  if (!b) return a;
  const pick = (x?: Reaction, y?: Reaction) => (!x ? y : !y ? x : y.at > x.at ? y : x);
  const out: Reactions = {};
  const w = pick(a.w, b.w);
  const bl = pick(a.b, b.b);
  if (w) out.w = w;
  if (bl) out.b = bl;
  return out;
}

export function sameReactions(a: Reactions | undefined, b: Reactions | undefined): boolean {
  const k = (r?: Reaction) => (r ? `${r.e}:${r.id}:${r.at}` : "");
  return k(a?.w) === k(b?.w) && k(a?.b) === k(b?.b);
}

/** Reactions not seen yet (by key), oldest first. Adds them to `seen`. */
export function takeNewReactions(reactions: Reactions | undefined, seen: Set<string>): { side: Side; reaction: Reaction }[] {
  const out: { side: Side; reaction: Reaction }[] = [];
  for (const side of ["w", "b"] as const) {
    const r = reactions?.[side];
    if (!r) continue;
    const key = `${side}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ side, reaction: r });
  }
  return out.sort((x, y) => x.reaction.at - y.reaction.at);
}

export function reactionToken(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
