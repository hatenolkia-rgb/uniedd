import { getSupabase } from "../supabase";

export type ScoreEntry = { name: string; score: number; at: number };

const memory = new Map<string, ScoreEntry[]>();
const usedNonces = new Map<string, number>();

export type StorageKind = "redis" | "supabase" | "memory";

function redisCreds() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function redisCommand(command: unknown[]) {
  const creds = redisCreds();
  if (!creds) return null;
  const res = await fetch(creds.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return (await res.json()) as { result?: unknown };
}

export function isoWeekKey(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekStartIso(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - (day - 1));
  return utc.toISOString();
}

function pruneMemory() {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  for (const [key, rows] of memory) {
    memory.set(
      key,
      rows.filter((row) => row.at > cutoff).sort((a, b) => b.score - a.score || b.at - a.at).slice(0, 25),
    );
  }
  const now = Date.now();
  for (const [nonce, exp] of usedNonces) {
    if (exp < now) usedNonces.delete(nonce);
  }
}

function top10(rows: ScoreEntry[]) {
  return [...rows].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 10);
}

export async function detectStorage(): Promise<StorageKind> {
  if (redisCreds()) return "redis";
  if (getSupabase()) return "supabase";
  return "memory";
}

export async function addScore(game: string, entry: ScoreEntry) {
  const kind = await detectStorage();
  if (kind === "redis") {
    const member = `${entry.at}:${entry.name}:${Math.random().toString(36).slice(2, 7)}`;
    const allKey = `games:lb:${game}:all`;
    const weekKey = `games:lb:${game}:w:${isoWeekKey()}`;
    const payload = JSON.stringify(entry);
    await redisCommand(["ZADD", allKey, entry.score, member]);
    await redisCommand(["HSET", `games:lb:meta`, member, payload]);
    await redisCommand(["ZADD", weekKey, entry.score, member]);
    await redisCommand(["EXPIRE", weekKey, 60 * 60 * 24 * 21]);
    return kind;
  }

  if (kind === "supabase") {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from("game_scores").insert({
        game,
        nickname: entry.name,
        score: entry.score,
        created_at: new Date(entry.at).toISOString(),
      });
      if (!error) return kind;
      console.error("Supabase game_scores insert failed:", error.message);
    }
  }

  pruneMemory();
  const all = memory.get(`all:${game}`) || [];
  all.push(entry);
  memory.set(`all:${game}`, all);
  const week = memory.get(`week:${game}:${isoWeekKey()}`) || [];
  week.push(entry);
  memory.set(`week:${game}:${isoWeekKey()}`, week);
  return (await detectStorage()) === "supabase" ? ("memory" as StorageKind) : kind;
}

async function redisTop(key: string): Promise<ScoreEntry[]> {
  const listed = await redisCommand(["ZREVRANGE", key, 0, 9]);
  const members = (listed?.result as string[] | undefined) || [];
  const rows: ScoreEntry[] = [];
  for (const member of members) {
    const raw = await redisCommand(["HGET", "games:lb:meta", member]);
    if (typeof raw?.result === "string") {
      try {
        rows.push(JSON.parse(raw.result) as ScoreEntry);
        continue;
      } catch {
        /* fall through */
      }
    }
    const [at, ...nameParts] = member.split(":");
    rows.push({ name: nameParts.slice(0, -1).join(":") || "Player", score: 0, at: Number(at) || Date.now() });
  }
  // If meta missing, pull scores from ZSET
  if (rows.some((row) => row.score === 0)) {
    const withScores = await redisCommand(["ZREVRANGE", key, 0, 9, "WITHSCORES"]);
    const flat = (withScores?.result as Array<string | number>) || [];
    for (let i = 0; i < rows.length; i++) {
      const score = Number(flat[i * 2 + 1]);
      if (Number.isFinite(score)) rows[i].score = score;
    }
  }
  return rows;
}

export async function listScores(game: string) {
  const kind = await detectStorage();
  if (kind === "redis") {
    try {
      const [allTime, week] = await Promise.all([
        redisTop(`games:lb:${game}:all`),
        redisTop(`games:lb:${game}:w:${isoWeekKey()}`),
      ]);
      return { allTime, week, storage: kind, persistent: true };
    } catch (err) {
      console.error("Redis leaderboard read failed:", err);
    }
  }

  if (kind === "supabase") {
    const supabase = getSupabase();
    if (supabase) {
      const mapRow = (row: { nickname: string; score: number; created_at: string }) => ({
        name: row.nickname,
        score: row.score,
        at: new Date(row.created_at).getTime(),
      });
      const all = await supabase
        .from("game_scores")
        .select("nickname, score, created_at")
        .eq("game", game)
        .order("score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(10);
      const week = await supabase
        .from("game_scores")
        .select("nickname, score, created_at")
        .eq("game", game)
        .gte("created_at", weekStartIso())
        .order("score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(10);
      if (!all.error && !week.error) {
        return {
          allTime: (all.data || []).map(mapRow),
          week: (week.data || []).map(mapRow),
          storage: kind,
          persistent: true,
        };
      }
      if (all.error) console.error("Supabase game_scores read failed:", all.error.message);
    }
  }

  pruneMemory();
  return {
    allTime: top10(memory.get(`all:${game}`) || []),
    week: top10(memory.get(`week:${game}:${isoWeekKey()}`) || []),
    storage: "memory" as StorageKind,
    persistent: false,
  };
}

export async function consumeNonce(nonce: string) {
  if (usedNonces.has(nonce)) return false;
  if (redisCreds()) {
    try {
      const set = await redisCommand(["SET", `games:nonce:${nonce}`, "1", "EX", "7200", "NX"]);
      if (set?.result === null) return false;
      return true;
    } catch {
      // fall through to memory
    }
  }
  usedNonces.set(nonce, Date.now() + 2 * 60 * 60 * 1000);
  return true;
}
