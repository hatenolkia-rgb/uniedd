import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { isRateLimited, clientKey } from "../rate-limit";
import { getSupabase } from "../../lib/supabase";

const DEMO_FEE_INR = 199;
const VALID_INSTRUMENTS = ["Guitar", "Keyboard", "Vocals", "Tabla", "Dance", "Public Speaking"];
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
      typeof timezone === "string" && timezone.length > 60
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

    // Determine locale from the request itself — never trust a client-submitted
    // "country" or "isPaid" flag, since that could be spoofed to skip payment.
    const country = request.headers.get("x-vercel-ip-country");
    const requiresPayment = country === "IN";

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

    // Persist the booking. When Supabase is configured, its `unique`
    // constraint on razorpay_payment_id is the authoritative replay guard
    // (works across cold starts/instances, unlike the in-memory Set above).
    const supabase = getSupabase();
    if (supabase) {
      const { error: dbError } = await supabase.from("bookings").insert({
        first_name: firstName,
        last_name: lastName || null,
        email,
        phone,
        instrument,
        demo_date: demoDate,
        demo_time: demoTime,
        timezone: timezone || null,
        requires_payment: requiresPayment,
        razorpay_order_id: requiresPayment ? razorpayOrderId : null,
        razorpay_payment_id: requiresPayment ? razorpayPaymentId : null,
      });

      if (dbError) {
        if (dbError.code === "23505") {
          // Unique violation on razorpay_payment_id -- this payment was already used.
          return NextResponse.json(
            { error: "This payment has already been used for a booking." },
            { status: 409 }
          );
        }
        // Don't block the booking on a DB hiccup -- email is still the fallback
        // record. Log it so it's visible in Vercel's function logs.
        console.error("Supabase insert error:", dbError);
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
      lastName: escapeHtml(String(lastName || "")),
      email: escapeHtml(email),
      phone: escapeHtml(phone),
      instrument: escapeHtml(instrument),
      demoTime: escapeHtml(demoTime),
      timezone: escapeHtml(String(timezone || "")),
    };

    const paymentLine = requiresPayment
      ? `<p><strong>Payment:</strong> ₹${DEMO_FEE_INR} paid (Razorpay payment ID: ${escapeHtml(razorpayPaymentId)})</p>`
      : `<p><strong>Payment:</strong> Not required (visitor outside India)</p>`;

    // Email to admin
    await transporter.sendMail({
      from: process.env.MAIL_ID,
      to: process.env.MAIL_ID,
      subject: `New Demo Booking - ${safe.firstName} ${safe.lastName} - ${formattedDate}`,
      html: `
        <h2>New Demo Booking</h2>
        <p><strong>Name:</strong> ${safe.firstName} ${safe.lastName}</p>
        <p><strong>Email:</strong> ${safe.email}</p>
        <p><strong>Phone:</strong> ${safe.phone}</p>
        <p><strong>Instrument:</strong> ${safe.instrument}</p>
        <p><strong>Requested slot:</strong> ${formattedDate} at ${safe.demoTime}${safe.timezone ? ` (${safe.timezone})` : ""}</p>
        ${paymentLine}
        <br/>
        <p>This booking was submitted from the Uniedd website. Confirm the slot with the student, or follow up on WhatsApp if it needs to be rescheduled.</p>
      `,
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
