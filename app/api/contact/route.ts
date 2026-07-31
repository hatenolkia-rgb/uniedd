import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, instrument } = body;

    if (!firstName || !email || !phone || !instrument) {
      return NextResponse.json(
        { error: "Please fill all required fields." },
        { status: 400 }
      );
    }

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
      subject: `New Student Inquiry - ${firstName} ${lastName}`,
      html: `
        <h2>New Student Registration</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Instrument:</strong> ${instrument}</p>
        <br/>
        <p>This inquiry was submitted from the Uniedd website.</p>
      `,
    });

    // Confirmation email to user
    await transporter.sendMail({
      from: process.env.MAIL_ID,
      to: email,
      subject: "Welcome to Uniedd — Your Musical Journey Starts Here!",
      html: `
        <h2>Hi ${firstName},</h2>
        <p>Thank you for signing up for Uniedd! We're excited to have you on board.</p>
        <p>You've expressed interest in learning <strong>${instrument}</strong>. Our team will be in touch shortly with next steps to get you started.</p>
        <br/>
        <p>In the meantime, feel free to explore our courses.</p>
        <br/>
        <p>— The Uniedd Team</p>
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
