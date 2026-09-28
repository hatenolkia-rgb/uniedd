import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, clientKey } from "../rate-limit";
import { getSupabase } from "../../lib/supabase";
import { sendWhatsAppNotification, sendCustomerWelcomeMessage } from "../../lib/whatsapp";
import { sendEmail } from "../../lib/resend";

const VALID_INSTRUMENTS = ["Guitar", "Keyboard", "Vocals", "Tabla", "Dance", "Public Speaking", "Chess"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = 100;
// Country code from the form's selector, then the local number, e.g. "+91 98765 43210".
const PHONE_RE = /^\+\d{1,4} [\d\s().-]{6,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  try {
    if (await isRateLimited(`contact:${clientKey(request)}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      instrument,
      demoDate,
      demoTime,
      timezone,
      ageGroup,
      source,
      website,
    } = body;

    // Honeypot field (hidden in CTA.tsx) -- only bots fill it in. Pretend it
    // worked so they don't learn to skip it, but don't send anything.
    if (website) {
      return NextResponse.json({ success: true, emailSent: true, message: "Booking confirmed!" });
    }

    if (!firstName || !email || !phone || !instrument || !demoDate || !demoTime) {
      return NextResponse.json({ error: "Please fill all required fields." }, { status: 400 });
    }

    if (
      typeof firstName !== "string" || firstName.length > MAX_LEN ||
      typeof lastName === "string" && lastName.length > MAX_LEN ||
      typeof email !== "string" || email.length > MAX_LEN || !EMAIL_RE.test(email) ||
      typeof phone !== "string" || phone.length > 25 ||
      !VALID_INSTRUMENTS.includes(instrument) ||
      typeof demoDate !== "string" || !DATE_RE.test(demoDate) ||
      typeof demoTime !== "string" || !TIME_RE.test(demoTime) ||
      typeof timezone === "string" && timezone.length > 60 ||
      typeof ageGroup === "string" && ageGroup.length > 40 ||
      typeof source === "string" && source.length > 40
    ) {
      return NextResponse.json({ error: "Please check your details and try again." }, { status: 400 });
    }

    if (!PHONE_RE.test(phone)) {
      return NextResponse.json(
        { error: "Please enter your mobile number without the country code (choose that from the list)." },
        { status: 400 }
      );
    }

    // Rejects impossible dates like 2026-02-31 (which Date would roll over
    // into March) as well as past dates or ones more than a year out. The
    // one-day slack covers visitors whose local date is behind the server's.
    const [year, month, day] = demoDate.split("-").map(Number);
    const chosenDate = new Date(Date.UTC(year, month - 1, day));
    const now = Date.now();
    if (
      chosenDate.getUTCFullYear() !== year ||
      chosenDate.getUTCMonth() !== month - 1 ||
      chosenDate.getUTCDate() !== day ||
      chosenDate.getTime() < now - 2 * DAY_MS ||
      chosenDate.getTime() > now + 366 * DAY_MS
    ) {
      return NextResponse.json({ error: "Please choose a valid upcoming date." }, { status: 400 });
    }

    // Each booking sends a WhatsApp template message to the submitted number,
    // so cap how often one number can be targeted -- otherwise the form could
    // be used to spam strangers from the business account.
    if (await isRateLimited(`contact-phone:${phone.replace(/\D/g, "")}`, 2, DAY_MS)) {
      return NextResponse.json(
        { error: "This number already has a booking request. Our team will be in touch." },
        { status: 429 }
      );
    }

    const formattedDate = chosenDate.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    const supabase = getSupabase();
    if (supabase) {
      // Not a permanent record -- see supabase/lead_digest_queue.sql. This
      // row gets emailed out and deleted by api/send-lead-digest within 24h.
      const { error: dbError } = await supabase.from("lead_digest_queue").insert({
        first_name: firstName,
        last_name: lastName || null,
        email,
        phone,
        instrument,
        demo_date: demoDate,
        demo_time: demoTime,
        timezone: timezone || null,
        age_group: ageGroup || null,
      });

      if (dbError) {
        // Don't block the booking on this -- WhatsApp + the customer's own
        // confirmation email still go out. Log it so it's visible in
        // Vercel's function logs. This fires if lead_digest_queue.sql
        // hasn't been run yet.
        console.error("lead_digest_queue insert error:", dbError);
      }
    }

    // Escape every user-supplied value before it goes into an HTML email —
    // otherwise the "name" field alone is an HTML/script injection vector
    // into whatever inbox renders this.
    const safe = {
      firstName: escapeHtml(firstName),
      phone: escapeHtml(phone),
      instrument: escapeHtml(instrument),
      demoTime: escapeHtml(demoTime),
      timezone: escapeHtml(String(timezone || "")),
      source: escapeHtml(String(source || "website")),
    };

    // No per-lead admin email anymore -- WhatsApp below is the immediate
    // alert, and api/send-lead-digest emails a summary of everything queued
    // in lead_digest_queue once every 24 hours instead.

    // WhatsApp notification to the team — no-ops if not configured (see lib/whatsapp.ts)
    await sendWhatsAppNotification({
      source: safe.source,
      name: `${firstName} ${lastName || ""}`.trim(),
      program: `${instrument}${ageGroup ? ` (${ageGroup})` : ""}`,
      phone,
      slot: `${formattedDate} at ${demoTime}${timezone ? ` (${timezone})` : ""}`,
    });

    // WhatsApp welcome message back to the customer — separate template/
    // number from the team alert above, no-ops if not configured.
    await sendCustomerWelcomeMessage({
      name: firstName,
      program: instrument,
      phone,
    });

    // Confirmation email to user -- best-effort, same as WhatsApp/Supabase
    // above. A booking is already captured (WhatsApp + digest queue) by this
    // point, so a delivery failure shouldn't fail the whole request and show
    // the visitor a false "booking failed" error.
    let emailSent = false;
    try {
      emailSent = await sendEmail({
        to: email,
        subject: `Your UniEDD Demo is Booked — ${formattedDate}`,
        html: `
          <h2>Hi ${safe.firstName},</h2>
          <p>Thanks for booking a demo with UniEDD! Here are your details:</p>
          <p>
            <strong>Program:</strong> ${safe.instrument}<br/>
            <strong>Date:</strong> ${formattedDate}<br/>
            <strong>Time:</strong> ${safe.demoTime}${safe.timezone ? ` (${safe.timezone})` : ""}
          </p>
          <p>Our team will reach out on ${safe.phone} to confirm this slot shortly. If you need to reschedule, just reply to this email or message us on WhatsApp.</p>
          <br/>
          <p>— The UniEDD Team</p>
        `,
      });
    } catch (mailError) {
      console.error("Confirmation email failed:", mailError);
    }

    return NextResponse.json({ success: true, emailSent, message: "Booking confirmed!" });
  } catch (error) {
    console.error("Booking error:", error);
    return NextResponse.json(
      { error: "Failed to complete booking. Please try again later." },
      { status: 500 }
    );
  }
}
