import { NextResponse } from "next/server";
import Razorpay from "razorpay";

// One-time demo-booking fee charged to visitors browsing from India.
const DEMO_FEE_INR = 199;

export async function POST() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Payments are not configured yet. Please try again later or contact us directly." },
      { status: 503 }
    );
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const order = await razorpay.orders.create({
      amount: DEMO_FEE_INR * 100, // paise
      currency: "INR",
      receipt: `demo_${Date.now()}`,
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId, // Razorpay's Key ID is public by design, safe to return to the client
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    return NextResponse.json(
      { error: "Could not start payment. Please try again." },
      { status: 500 }
    );
  }
}
