import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { isRateLimited, clientKey } from "../rate-limit";
import { getSupabase } from "../../lib/supabase";
import { sendWhatsAppNotification } from "../../lib/whatsapp";

const DEMO_FEE_INR = 199;
const VALID_INSTRUMENTS = ["Guitar", "Keyboard", "Vocals", "Tabla", "Dance", "Public Speaking", "Chess"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = 100;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Best-effort defense-in-depth against payment replay: rejects a Razorpay
// payment ID that's already been used to complete a booking on this
// (warm) serverless instance. This does NOT fully solve replay across
// cold starts/instances -- that needs a persistent store (e.g. a DB row
// per payment ID). Flagging here rather than pretending this is sufficient.
const usedPaymentIds = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(`contact:${clientKey(request)}`, 5, 10 * 60 * 1000)) {
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
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = body;

    if (!firstName || !email || !phone || !instrument || !demoDate || !demoTime) {
      return NextResponse.json({ error: "Please fill all required fields." }, { status: 400 });
    }

    if (
      typeof firstName !== "string" || firstName.length > MAX_LEN ||
      typeof lastName === "string" && lastName.length > MAX_LEN ||
      typeof email !== "string" || email.length > MAX_LEN || !EMAIL_RE.test(email) ||
      typeof phone !== "string" || phone.length > 20 ||
      !VALID_INSTRUMENTS.includes(instrument) ||
      typeof demoTime !== "string" || demoTime.length > 20 ||
      typeof timezone === "string" && timezone.length > 60 ||
      typeof ageGroup === "string" && ageGroup.length > 40 ||
      typeof source === "string" && source.length > 40
    ) {
      return NextResponse.json({ error: "Please check your details and try again." }, { status: 400 });
    }

    const [year, month, day] = String(demoDate).split("-").map(Number);
    const chosenDate = new Date(year, month - 1, day);
    if (Number.isNaN(chosenDate.getTime())) {
      return NextResponse.json({ error: "Please choose a valid date." }, { status: 400 });
    }

    const formattedDate = chosenDate.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // TEMPORARILY DISABLED (2026-08-27): demo bookings are free for everyone
    // right now, including India. To bring back the ₹199 India fee, restore:
    //   const country = request.headers.get("x-vercel-ip-country");
    //   const requiresPayment = country === "IN";
    // (Determine locale from the request itself, not a client-submitted flag
    // -- that could be spoofed to skip payment once this is re-enabled.)
    const requiresPayment = false;

    if (requiresPayment) {
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return NextResponse.json(
          { error: "This demo requires payment. Please complete checkout before booking." },
          { status: 402 }
        );
      }

      if (usedPaymentIds.has(razorpayPaymentId)) {
        return NextResponse.json({ error: "This payment has already been used for a booking." }, { status: 409 });
      }

      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        return NextResponse.json({ error: "Payment could not be verified." }, { status: 402 });
      }

      usedPaymentIds.add(razorpayPaymentId);
    }

    // Note: payment-replay protection for the India flow now rests entirely
    // on the in-memory `usedPaymentIds` Set above (best-effort within one
    // warm serverless instance -- see its comment). There's no longer a
    // permanent `bookings` table with a unique constraint on
    // razorpay_payment_id backing this across cold starts/instances, since
    // this route no longer persists bookings at all -- only a transient
    // digest-queue row (see below), which isn't a reliable replay guard.
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
        requires_payment: requiresPayment,
      });

      if (dbError) {
        // Don't block the booking on this -- WhatsApp + the customer's own
        // confirmation email still go out. Log it so it's visible in
        // Vercel's function logs. This fires if lead_digest_queue.sql
        // hasn't been run yet.
        console.error("lead_digest_queue insert error:", dbError);
      }
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_ID,
        pass: process.env.PASSWORD,
      },
    });

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

    // Confirmation email to user
    await transporter.sendMail({
      from: process.env.MAIL_ID,
      to: email,
      subject: `Your UniEDD Demo is Booked — ${formattedDate}`,
      html: `
        <h2>Hi ${safe.firstName},</h2>
        <p>Thanks for booking a demo with UniEDD! Here are your details:</p>
        <p>
          <strong>Program:</strong> ${safe.instrument}<br/>
          <strong>Date:</strong> ${formattedDate}<br/>
          <strong>Time:</strong> ${safe.demoTime}${safe.timezone ? ` (${safe.timezone})` : ""}
          ${requiresPayment ? `<br/><strong>Amount paid:</strong> ₹${DEMO_FEE_INR}` : ""}
        </p>
        <p>Our team will reach out on ${safe.phone} to confirm this slot shortly. If you need to reschedule, just reply to this email or message us on WhatsApp.</p>
        <br/>
        <p>— The UniEDD Team</p>
      `,
    });

    return NextResponse.json({ success: true, message: "Booking confirmed!" });
  } catch (error) {
    console.error("Booking error:", error);
    return NextResponse.json(
      { error: "Failed to complete booking. Please try again later." },
      { status: 500 }
    );
  }
}
