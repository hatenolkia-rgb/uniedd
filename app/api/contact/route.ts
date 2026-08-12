import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, instrument, demoDate, demoTime } = body;

    if (!firstName || !email || !phone || !instrument || !demoDate || !demoTime) {
      return NextResponse.json(
        { error: "Please fill all required fields." },
        { status: 400 }
      );
    }

    // Reject Sundays and past dates server-side too (client validation can be bypassed)
    const [year, month, day] = demoDate.split("-").map(Number);
    const chosenDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(chosenDate.getTime()) || chosenDate < today) {
      return NextResponse.json(
        { error: "Please choose a valid, upcoming date." },
        { status: 400 }
      );
    }
    if (chosenDate.getDay() === 0) {
      return NextResponse.json(
        { error: "We're closed on Sundays. Please choose another date." },
        { status: 400 }
      );
    }

    const formattedDate = chosenDate.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_ID,
        pass: process.env.PASSWORD,
      },
    });

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
        <p><strong>Requested slot:</strong> ${formattedDate} at ${demoTime}</p>
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
        <p>Thanks for booking a free demo with UniEDD! Here are your details:</p>
        <p>
          <strong>Program:</strong> ${instrument}<br/>
          <strong>Date:</strong> ${formattedDate}<br/>
          <strong>Time:</strong> ${demoTime} IST
        </p>
        <p>Our team will reach out on ${phone} to confirm this slot shortly. If you need to reschedule, just reply to this email or message us on WhatsApp.</p>
        <br/>
        <p>— The UniEDD Team</p>
      `,
    });

    return NextResponse.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Email error:", error);
    return NextResponse.json(
      { error: "Failed to send email. Please try again later." },
      { status: 500 }
    );
  }
}
