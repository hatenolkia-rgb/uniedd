import { NextResponse } from "next/server";
import { getGame } from "../../../games/catalog";
import { clientKey, isRateLimited } from "../../rate-limit";
import { readSession, validateScore } from "../../../lib/games/session";
import { consumeNonce } from "../../../lib/games/storage";
import { courseForGame, signCertificate, validateLead } from "../../../lib/games/lead";
import { getSupabase } from "../../../lib/supabase";
import { SITE_URL } from "../../../lib/site";

const DAY_MS = 24 * 60 * 60 * 1000;
const SITE = SITE_URL;

// Hands the lead to the LMS (lms.uniedd.com/api/meta, action 'game-lead'),
// which saves it to the Leads page and sends the WhatsApp certificate.
async function sendToLms(lead: Record<string, unknown>): Promise<boolean> {
  const secret = process.env.LMS_BOOKING_SECRET?.trim();
  if (!secret) return false;
  try {
    const res = await fetch("https://lms.uniedd.com/api/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-booking-secret": secret },
      body: JSON.stringify({ action: "game-lead", lead }),
    });
    if (!res.ok) console.error("LMS game-lead rejected:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("LMS game-lead failed:", err);
    return false;
  }
}

export async function POST(request: Request) {
  if (await isRateLimited(`games-lead:${clientKey(request)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries. Please wait a few minutes." }, { status: 429 });
  }

  let body: { token?: string; score?: number; name?: unknown; phone?: unknown; childAge?: unknown; consent?: unknown; website?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }
  // Honeypot: only bots fill the hidden field. Pretend it worked.
  if (body.website) return NextResponse.json({ ok: true });

  // Only someone who just played a round can ask for a certificate.
  const session = body.token ? readSession(body.token) : null;
  const game = session ? getGame(session.g) : null;
  if (!session || !game) return NextResponse.json({ error: "That game session is not valid. Play again!" }, { status: 400 });
  const scoreError = validateScore(session.g, Number(body.score), session.t);
  if (scoreError) return NextResponse.json({ error: scoreError }, { status: 400 });

  const checked = validateLead(body);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const { lead } = checked;

  // Each lead sends a WhatsApp message to the number given, so cap how often
  // one number can be targeted, and allow one certificate per round.
  if (await isRateLimited(`games-lead-phone:${lead.phoneDigits}`, 2, DAY_MS)) {
    return NextResponse.json({ error: "This number already got a certificate today. Our team will be in touch!" }, { status: 429 });
  }
  if (!(await consumeNonce(`lead:${session.n}`))) {
    return NextResponse.json({ error: "A certificate for this round was already sent." }, { status: 409 });
  }

  const score = Math.round(Number(body.score));
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const certificateUrl = `${SITE}/api/games/certificate?c=${signCertificate({ n: lead.name, g: game.slug, s: score, d: date })}`;
  const course = courseForGame(game.slug);

  const handed = await sendToLms({
    name: lead.name, phone: lead.phoneDigits, childAge: lead.childAge,
    gameSlug: game.slug, gameTitle: game.title, course, score, certificateUrl,
  });

  // Fallback when the LMS can't be reached: save straight to the Leads table
  // (same Supabase project). No WhatsApp from here; the team follows up.
  if (!handed) {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "We couldn't save that right now. Please try again in a minute." }, { status: 503 });
    }
    const today = new Date();
    const { error } = await supabase.from("leads").insert({
      full_name: lead.name, phone: lead.phoneDigits, whatsapp_number: lead.phoneDigits,
      course_interest: course, source: `Game: ${game.title}`, stage: "Intake", owner: "Unassigned", status: "New",
      notes: `Played ${game.title}, score ${score} · Learner's age: ${lead.childAge} · Certificate: ${certificateUrl}`,
      created_date: today.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
      import_date: today.toISOString().slice(0, 10),
    });
    if (error) {
      console.error("game lead insert error:", error);
      return NextResponse.json({ error: "We couldn't save that right now. Please try again in a minute." }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: true, certificateUrl, whatsapp: handed });
}
