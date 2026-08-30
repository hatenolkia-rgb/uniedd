"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FaUser, FaPhoneAlt, FaRegEnvelope, FaRegCalendarAlt, FaRegClock, FaCheckCircle, FaPaperPlane, FaGraduationCap } from "react-icons/fa";
import { loadRazorpayScript, type RazorpayResponse } from "../lib/razorpay";
import { COUNTRY_CODES } from "../lib/countryCodes";

gsap.registerPlugin(ScrollTrigger);

const DEMO_FEE_INR = 199;

// Decorative preview grid — Mon-start, 4 weeks. "today" and "selected" are just illustrative.
const CALENDAR_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const TODAY_INDEX = 13;
const SELECTED_INDEX = 17;
const PREVIEW_CHIPS = ["6:30 AM", "1:00 PM", "7:45 PM", "11:00 PM"];
const SELECTED_CHIP_INDEX = 2;

const INCLUDED = [
  "30-minute live 1:1 session",
  "Meet your mentor before you commit",
  "Available 24/7, any time zone",
];

export default function CTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bgElementsRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  // TEMPORARILY DISABLED (2026-08-27): demo bookings are free for everyone
  // right now, including India. To bring back the ₹199 India fee, restore
  // the useState<boolean | null>(null) + this useEffect:
  //   useEffect(() => {
  //     fetch("/api/geo")
  //       .then((r) => r.json())
  //       .then((d) => setRequiresPayment(d.country === "IN"))
  //       .catch(() => setRequiresPayment(false));
  //   }, []);
  const requiresPayment = false;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const countryCode = formData.get("countryCode") as string;
    const phoneDigits = formData.get("phone") as string;

    const data = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      phone: `${countryCode} ${phoneDigits}`.trim(),
      instrument: formData.get("instrument") as string,
      demoDate: formData.get("demoDate") as string,
      demoTime: formData.get("demoTime") as string,
      timezone,
    };

    const finishBooking = async (paymentFields?: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => {
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, ...paymentFields }),
        });
        const result = await res.json();
        if (res.ok) {
          setStatus({
            type: "success",
            message: `Demo booked for ${data.demoDate} at ${data.demoTime}! A confirmation has been sent to your email.`,
          });
          (e.target as HTMLFormElement).reset();
        } else {
          setStatus({ type: "error", message: result.error || "Something went wrong." });
        }
      } catch {
        setStatus({ type: "error", message: "Network error. Please try again." });
      } finally {
        setLoading(false);
      }
    };

    if (!requiresPayment) {
      await finishBooking();
      return;
    }

    // India flow: pay ₹199 via Razorpay before the booking is created
    try {
      const orderRes = await fetch("/api/create-order", { method: "POST" });
      const order = await orderRes.json();
      if (!orderRes.ok) {
        setStatus({ type: "error", message: order.error || "Could not start payment." });
        setLoading(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setStatus({ type: "error", message: "Could not load payment gateway. Please try again." });
        setLoading(false);
        return;
      }

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "UniEDD",
        description: `Demo booking — ${data.instrument}`,
        order_id: order.orderId,
        prefill: { name: `${data.firstName} ${data.lastName}`.trim(), email: data.email, contact: data.phone },
        theme: { color: "#3B82C4" },
        handler: async (response: RazorpayResponse) => {
          const verifyRes = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });
          const verifyResult = await verifyRes.json();
          if (!verifyRes.ok || !verifyResult.verified) {
            setStatus({ type: "error", message: "Payment could not be verified. Please contact us." });
            setLoading(false);
            return;
          }
          await finishBooking({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setStatus({ type: "error", message: "Payment cancelled — your demo wasn't booked." });
          },
        },
      });
      razorpay.open();
    } catch {
      setStatus({ type: "error", message: "Could not start payment. Please try again." });
      setLoading(false);
    }
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );

      // Animate background elements
      if (bgElementsRef.current) {
        const elements = bgElementsRef.current.children;
        Array.from(elements).forEach((el, i) => {
          gsap.to(el, {
            y: `random(-25, 25)`,
            x: `random(-15, 15)`,
            rotation: `random(-15, 15)`,
            scale: `random(0.9, 1.1)`,
            opacity: `random(0.04, 0.12)`,
            duration: `random(3, 6)`,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: i * 0.4,
          });
        });
      }

      // Booking preview panel
      if (previewRef.current) {
        const cells = previewRef.current.querySelectorAll(".calendar-cell");
        gsap.fromTo(
          cells,
          { opacity: 0, scale: 0.6 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.35,
            stagger: 0.015,
            ease: "back.out(2)",
            scrollTrigger: { trigger: previewRef.current, start: "top 80%" },
          }
        );

        const chips = previewRef.current.querySelectorAll(".time-chip");
        gsap.fromTo(
          chips,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.08,
            delay: 0.3,
            ease: "power3.out",
            scrollTrigger: { trigger: previewRef.current, start: "top 80%" },
          }
        );

        const checks = previewRef.current.querySelectorAll(".included-item");
        gsap.fromTo(
          checks,
          { opacity: 0, x: -10 },
          {
            opacity: 1,
            x: 0,
            duration: 0.4,
            stagger: 0.1,
            delay: 0.5,
            ease: "power3.out",
            scrollTrigger: { trigger: previewRef.current, start: "top 80%" },
          }
        );

        // Gentle pulse on the "selected" calendar cell
        gsap.to(previewRef.current.querySelector(".calendar-cell-selected"), {
          scale: 1.12,
          duration: 1.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="contact" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div ref={contentRef} className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start border border-[var(--border)] rounded-3xl p-6 sm:p-10 lg:p-14 overflow-hidden relative">
          {/* Animated background elements */}
          <div ref={bgElementsRef} className="absolute inset-0 pointer-events-none select-none overflow-hidden">
            <span className="absolute top-[8%] right-[10%] text-5xl text-[var(--brand-blue)] opacity-[0.06]">♪</span>
            <span className="absolute bottom-[12%] left-[5%] text-4xl text-[var(--brand-orange)] opacity-[0.06]">♫</span>
            <span className="absolute top-[50%] right-[30%] text-3xl text-[var(--brand-blue)] opacity-[0.04]">♬</span>
            <span className="absolute top-[20%] left-[40%] text-2xl text-[var(--brand-orange)] opacity-[0.05]">♩</span>
            <span className="absolute bottom-[30%] right-[15%] text-4xl text-[var(--brand-blue)] opacity-[0.04]">♪</span>
            <span className="absolute top-[70%] left-[25%] text-3xl text-[var(--brand-orange)] opacity-[0.05]">♫</span>
            {/* Circles */}
            <div className="absolute top-[15%] left-[8%] w-20 h-20 rounded-full border border-[var(--brand-blue)]/[0.06]" />
            <div className="absolute bottom-[20%] right-[8%] w-32 h-32 rounded-full border border-[var(--brand-orange)]/[0.06]" />
            <div className="absolute top-[60%] right-[45%] w-14 h-14 rounded-full border border-[var(--brand-blue)]/[0.04]" />
            {/* Dots */}
            <div className="absolute top-[30%] right-[5%] w-2 h-2 rounded-full bg-[var(--brand-blue)] opacity-[0.08]" />
            <div className="absolute bottom-[40%] left-[12%] w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)] opacity-[0.08]" />
            <div className="absolute top-[80%] right-[40%] w-2.5 h-2.5 rounded-full bg-[var(--brand-blue)] opacity-[0.06]" />
          </div>

          {/* Left — Booking Form */}
          <div className="relative z-10">
            <p className="text-sm tracking-widest uppercase text-[var(--brand-blue)] mb-3 font-medium">
              Get Started
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] tracking-tight mb-3"
              style={{ fontFamily: "var(--font-playfair), serif" }}
            >
              Book a demo and
              <br />
              start your next chapter.
            </h2>
            <p className="text-[var(--muted)] mb-8 text-sm leading-relaxed">
              Tell us your age, interest, and goals. We’ll match you with the right mentor and help you begin the right program for your growth.
            </p>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              {/* Section: Your details */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
                  Your details
                </p>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <FaUser className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={13} />
                      <input
                        type="text"
                        name="firstName"
                        placeholder="First name"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
                      />
                    </div>
                    <input
                      type="text"
                      name="lastName"
                      placeholder="Last name"
                      className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex gap-2">
                      <select
                        name="countryCode"
                        defaultValue="+91"
                        aria-label="Country code"
                        className="px-2.5 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.label} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                      <div className="relative flex-1 min-w-0">
                        <FaPhoneAlt className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={13} />
                        <input
                          type="tel"
                          name="phone"
                          placeholder="Mobile number"
                          required
                          className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <FaRegEnvelope className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={13} />
                      <input
                        type="email"
                        name="email"
                        placeholder="Email address"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <FaGraduationCap className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={14} />
                    <select
                      name="instrument"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--muted)] text-sm focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors appearance-none"
                      defaultValue=""
                    >
                      <option value="" disabled>What do you want to learn?</option>
                      <option value="Guitar">Guitar</option>
                      <option value="Keyboard">Keyboard</option>
                      <option value="Vocals">Vocals</option>
                      <option value="Tabla">Tabla</option>
                      <option value="Dance">Dance</option>
                      <option value="Public Speaking">Public Speaking</option>
                      <option value="Chess">Chess</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section: Schedule */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
                  Schedule your demo
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <FaRegCalendarAlt className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] z-10" size={13} />
                    <input
                      type="date"
                      name="demoDate"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <FaRegClock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] z-10" size={13} />
                    <input
                      type="time"
                      name="demoTime"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--muted)] mt-2">
                  Open 24/7 — pick any date and time in your own time zone. We&rsquo;ll confirm your slot by email.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-xl text-sm font-semibold hover:opacity-90 hover:-translate-y-px transition-all duration-300 shadow-lg shadow-[var(--brand-blue)]/20 mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  "Booking..."
                ) : (
                  <>
                    <FaPaperPlane size={12} />
                    {requiresPayment ? `Book a Demo — ₹${DEMO_FEE_INR}` : "Book a Demo"}
                  </>
                )}
              </button>
              {status && (
                <p className={`text-sm mt-1 ${status.type === "success" ? "text-green-600" : "text-red-500"}`}>
                  {status.message}
                </p>
              )}
            </form>
          </div>

          {/* Right — Booking preview widget */}
          <div
            ref={previewRef}
            className="relative bg-[#fafafa] rounded-3xl border border-[var(--border)] p-8 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-widest uppercase text-[var(--muted)] font-medium">
                Your Demo, At a Glance
              </p>
              <span
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                  requiresPayment
                    ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                    : "bg-green-500/10 text-green-600"
                }`}
              >
                {requiresPayment ? `₹${DEMO_FEE_INR}` : "FREE"}
              </span>
            </div>

            {/* Mini calendar */}
            <div className="mb-6">
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i} className="text-center text-[10px] font-medium text-[var(--muted)]">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {CALENDAR_DAYS.map((day, i) => (
                  <div
                    key={day}
                    className={`calendar-cell flex items-center justify-center h-7 rounded-lg text-[11px] font-medium ${
                      i === SELECTED_INDEX
                        ? "calendar-cell-selected bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-orange)] text-white shadow-sm"
                        : i === TODAY_INDEX
                        ? "border border-[var(--brand-blue)]/40 text-[var(--brand-blue)]"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>
            </div>

            {/* Time chips */}
            <div className="mb-6">
              <p className="text-[10px] tracking-widest uppercase text-[var(--muted)] mb-2 font-medium">Book Any Time, Day or Night</p>
              <div className="flex flex-wrap gap-2">
                {PREVIEW_CHIPS.map((chip, i) => (
                  <span
                    key={chip}
                    className={`time-chip text-xs px-3 py-1.5 rounded-full border font-medium ${
                      i === SELECTED_CHIP_INDEX
                        ? "bg-[var(--brand-blue)]/10 border-[var(--brand-blue)]/30 text-[var(--brand-blue)]"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="h-px bg-[var(--border)] mb-6" />

            {/* What's included */}
            <div className="flex flex-col gap-3">
              {INCLUDED.map((item) => (
                <div key={item} className="included-item flex items-center gap-2.5 text-sm text-[var(--foreground)]">
                  <FaCheckCircle className="text-[var(--brand-blue)] shrink-0" size={14} />
                  {item}
                </div>
              ))}
            </div>

            {/* Decorative corner accents */}
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[var(--brand-blue)]/10 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[var(--brand-orange)]/10 rounded-bl-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}
