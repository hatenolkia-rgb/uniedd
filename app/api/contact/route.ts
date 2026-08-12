import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import crypto from "crypto";

const DEMO_FEE_INR = 199;

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: "Please fill all required fields." },
        { status: 400 }
      );
    }

    const [year, month, day] = demoDate.split("-").map(Number);
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

      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        return NextResponse.json({ error: "Payment could not be verified." }, { status: 402 });
      }
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_ID,
        pass: process.env.PASSWORD,
      },
    });

    const paymentLine = requiresPayment
      ? `<p><strong>Payment:</strong> ₹${DEMO_FEE_INR} paid (Razorpay payment ID: ${razorpayPaymentId})</p>`
      : `<p><strong>Payment:</strong> Not required (visitor outside India)</p>`;

    // Email to admin
    await transporter.sendMail({
      from: process.env.MAIL_ID,
      to: process.env.MAIL_ID,
      subject: `New Demo Booking - ${firstName} ${lastName} - ${formattedDate}`,
      html: `
        <h2>New Demo Booking</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Instrument:</strong> ${instrument}</p>
        <p><strong>Requested slot:</strong> ${formattedDate} at ${demoTime}${timezone ? ` (${timezone})` : ""}</p>
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
        <h2>Hi ${firstName},</h2>
        <p>Thanks for booking a demo with UniEDD! Here are your details:</p>
        <p>
          <strong>Program:</strong> ${instrument}<br/>
          <strong>Date:</strong> ${formattedDate}<br/>
          <strong>Time:</strong> ${demoTime}${timezone ? ` (${timezone})` : ""}
          ${requiresPayment ? `<br/><strong>Amount paid:</strong> ₹${DEMO_FEE_INR}` : ""}
        </p>
        <p>Our team will reach out on ${phone} to confirm this slot shortly. If you need to reschedule, just reply to this email or message us on WhatsApp.</p>
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
