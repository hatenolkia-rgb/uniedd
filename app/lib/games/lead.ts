import { createHmac, timingSafeEqual } from "crypto";
import { getGame, type CategoryId } from "../../games/catalog";
import { gamesSecret } from "./session";
import { BLOCKED } from "./nickname";

// Lead capture on the game end screen: "Save your score + get a certificate
// on WhatsApp". Validation and the signed certificate link live here so the
// API routes stay small and the rules can be unit-tested.

export const AGE_OPTIONS = ["Under 5", "5–8", "9–12", "13–17", "18+"] as const;

// Which LMS course a game's category points to (the Leads page course list).
const COURSE_FOR: Partial<Record<CategoryId, string>> = {
  guitar: "Guitar",
  piano: "Keyboard",
  vocals: "Vocals",
  chess: "Chess",
};

export function courseForGame(slug: string): string | null {
  const game = getGame(slug);
  return (game && COURSE_FOR[game.category]) || null;
}

// "+<country code> <number>": the end screen starts the box with "+91 ".
const PHONE_RE = /^\+\d{1,4}[\s-]?[\d\s-]{6,16}$/;

export type LeadInput = { name?: unknown; phone?: unknown; childAge?: unknown; consent?: unknown };
export type CleanLead = { name: string; phoneDigits: string; childAge: (typeof AGE_OPTIONS)[number] };

export function cleanName(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

// Returns an error message for the player, or the cleaned lead.
export function validateLead(input: LeadInput): { error: string } | { lead: CleanLead } {
  const name = cleanName(typeof input.name === "string" ? input.name : "");
  if (name.length < 2 || name.length > 40 || !/^[\p{L}][\p{L} .'-]*$/u.test(name)) {
    return { error: "Please enter the learner's name (letters only)." };
  }
  // Blocks rude words in a name printed on a UniEDD certificate. Whole words
  // only (unlike nicknames), so real names like Michelle or Hassan pass.
  if (name.toLowerCase().split(/[\s.'-]+/).some((word) => BLOCKED.includes(word))) {
    return { error: "Please use the learner's real name." };
  }
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const phoneDigits = phone.replace(/\D/g, "");
  if (!PHONE_RE.test(phone) || phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { error: "Please enter a WhatsApp number with the country code, e.g. +91 98765 43210." };
  }
  if (!AGE_OPTIONS.includes(input.childAge as CleanLead["childAge"])) {
    return { error: "Please choose the learner's age." };
  }
  if (input.consent !== true) {
    return { error: "Please tick the box so we can send the certificate on WhatsApp." };
  }
  return { lead: { name, phoneDigits, childAge: input.childAge as CleanLead["childAge"] } };
}

// A certificate link carries its own details, signed so nobody can make a
// UniEDD certificate with any text they like.
export type CertData = { n: string; g: string; s: number; d: string };

function sign(body: string) {
  return createHmac("sha256", `${gamesSecret()}:certificate`).update(body).digest("base64url");
}

export function signCertificate(data: CertData) {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readCertificate(token: string): CertData | null {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CertData;
    if (typeof data?.n !== "string" || typeof data.g !== "string" || !Number.isFinite(data.s) || typeof data.d !== "string") return null;
    return data;
  } catch {
    return null;
  }
}
