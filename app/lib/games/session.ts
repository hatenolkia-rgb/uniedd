import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getGame, MIN_DURATION_MS, SCORE_CAP } from "../../games/catalog";

function secret() {
  return (
    process.env.GAMES_SESSION_SECRET ||
    process.env.LMS_BOOKING_SECRET ||
    process.env.CRON_SECRET ||
    "uniedd-games-dev-preview"
  );
}

export type SessionPayload = {
  g: string;
  t: number;
  n: string;
};

function b64url(buf: Buffer | string) {
  const raw = typeof buf === "string" ? Buffer.from(buf) : buf;
  return raw.toString("base64url");
}

export function signSession(slug: string) {
  const payload: SessionPayload = {
    g: slug,
    t: Date.now(),
    n: randomBytes(8).toString("hex"),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return { token: `${body}.${sig}`, payload };
}

export function readSession(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload?.g || typeof payload.t !== "number" || !payload.n) return null;
    return payload;
  } catch {
    return null;
  }
}

export function validateScore(slug: string, score: number, startedAt: number) {
  const game = getGame(slug);
  if (!game) return "Unknown game.";
  if (!Number.isFinite(score) || score < 0) return "Invalid score.";
  if (score > SCORE_CAP) return `Score is too high for ${game.title}.`;
  if (Date.now() - startedAt < MIN_DURATION_MS) return "That round finished a little too quickly.";
  if (Date.now() - startedAt > 30 * 60 * 1000) return "That game session expired. Play again!";
  return null;
}
