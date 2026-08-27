"use client";

import { useEffect, useState } from "react";
import { FaUser, FaPhoneAlt, FaRegEnvelope, FaRegCalendarAlt, FaRegClock, FaPaperPlane, FaGraduationCap, FaCheckCircle, FaArrowLeft } from "react-icons/fa";
import { loadRazorpayScript, type RazorpayResponse } from "../lib/razorpay";

const DEMO_FEE_INR = 199;

const PROGRAMS = ["Guitar", "Keyboard", "Vocals", "Tabla", "Dance", "Public Speaking", "Chess"];
const AGE_GROUPS = ["5-12 (Kids)", "13-17 (Teens)", "18-45 (Adults)"];

const COUNTRY_CODES = [
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+65", label: "🇸🇬 +65" },
  { code: "+974", label: "🇶🇦 +974" },
  { code: "+966", label: "🇸🇦 +966" },
];

const STEPS = [
  { label: "Phone" },
  { label: "Details" },
  { label: "Schedule" },
];

interface FormState {
  countryCode: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  instrument: string;
  ageGroup: string;
  demoDate: string;
  demoTime: string;
}

const INITIAL_STATE: FormState = {
  countryCode: "+91",
  phone: "",
  firstName: "",
  lastName: "",
  email: "",
  instrument: "",
  ageGroup: "",
  demoDate: "",
  demoTime: "",
};

export default function BookTrialForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  // null = still checking; true = India (paid); false = elsewhere (free)
  const [requiresPayment, setRequiresPayment] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/geo")
      .then((r) => r.json())
      .then((d) => setRequiresPayment(d.country === "IN"))
      .catch(() => setRequiresPayment(false)); // fail open to "free" rather than blocking bookings
  }, []);

  const update = (field: keyof FormState, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const goNext = () => {
    setStatus(null);
    setStep((s) => Math.min(s + 1, 3));
  };
  const goBack = () => {
    setStatus(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  const step1Valid = form.phone.trim().length >= 6;
  const step2Valid =
    form.firstName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.instrument.length > 0 &&
    form.ageGroup.length > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.demoDate || !form.demoTime) return;
    setStatus(null);
    setLoading(true);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const data = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: `${form.countryCode} ${form.phone}`.trim(),
      instrument: form.instrument,
      ageGroup: form.ageGroup,
      demoDate: form.demoDate,
      demoTime: form.demoTime,
      timezone,
      source: "book-trial-landing",
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
            message: `You're booked for ${data.demoDate} at ${data.demoTime}! A confirmation has been sent to your email.`,
          });
          setForm(INITIAL_STATE);
          setStep(1);
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

  return (
    <div className="max-w-xl mx-auto rounded-3xl border border-[var(--border)] bg-white p-6 sm:p-10 shadow-sm">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-10">
        {STEPS.map((s, i) => {
          const num = i + 1;
          const active = num === step;
          const done = num < step;
          return (
            <div key={s.label} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-300 ${
                    done
                      ? "bg-[var(--brand-blue)] text-white"
                      : active
                      ? "bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-orange)] text-white shadow-md"
                      : "bg-[var(--background)] border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {done ? <FaCheckCircle size={14} /> : num}
                </div>
                <span className={`text-[11px] font-medium ${active ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-12 sm:w-20 h-[2px] mx-2 -mt-5 transition-colors duration-300 ${
                    done ? "bg-[var(--brand-blue)]" : "bg-[var(--border)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          // Enter on step 1/2 should advance the step, not attempt to
          // submit a form that has no submit-type button in the DOM yet.
          if (e.key === "Enter" && step < 3) {
            e.preventDefault();
            if ((step === 1 && step1Valid) || (step === 2 && step2Valid)) goNext();
          }
        }}
      >
        {/* Step 1 — Phone */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="text-center mb-2">
              <h2 className="text-xl font-semibold">What's your mobile number?</h2>
              <p className="text-sm text-[var(--muted)] mt-1">We'll use this to confirm your free trial slot.</p>
            </div>
            <div className="flex gap-2">
              <select
                value={form.countryCode}
                onChange={(e) => update("countryCode", e.target.value)}
                className="px-3 py-3 bg-white border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-blue)]/50"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <FaPhoneAlt className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={13} />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="Mobile number"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!step1Valid}
              onClick={goNext}
              className="w-full inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2 — Name, email, program, age group */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="text-center mb-2">
              <h2 className="text-xl font-semibold">Tell us about yourself</h2>
              <p className="text-sm text-[var(--muted)] mt-1">So we can match you with the right mentor.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <FaUser className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={13} />
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  placeholder="First name"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50"
                />
              </div>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                placeholder="Last name"
                className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50"
              />
            </div>
            <div className="relative">
              <FaRegEnvelope className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={13} />
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="Email address"
                className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50"
              />
            </div>
            <div className="relative">
              <FaGraduationCap className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={14} />
              <select
                value={form.instrument}
                onChange={(e) => update("instrument", e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--muted)] text-sm focus:outline-none focus:border-[var(--brand-blue)]/50 appearance-none"
              >
                <option value="" disabled>What do you want to learn?</option>
                {PROGRAMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <select
              value={form.ageGroup}
              onChange={(e) => update("ageGroup", e.target.value)}
              className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--muted)] text-sm focus:outline-none focus:border-[var(--brand-blue)]/50 appearance-none"
            >
              <option value="" disabled>Age group</option>
              {AGE_GROUPS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-2 px-5 py-3.5 border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--foreground)] hover:border-[var(--brand-blue)]/40 transition-colors"
              >
                <FaArrowLeft size={12} /> Back
              </button>
              <button
                type="button"
                disabled={!step2Valid}
                onClick={goNext}
                className="flex-1 inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Date & time */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div className="text-center mb-2">
              <h2 className="text-xl font-semibold">Pick a date & time</h2>
              <p className="text-sm text-[var(--muted)] mt-1">Open 24/7 — choose whatever works for you.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <FaRegCalendarAlt className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] z-10" size={13} />
                <input
                  type="date"
                  value={form.demoDate}
                  onChange={(e) => update("demoDate", e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-blue)]/50"
                />
              </div>
              <div className="relative">
                <FaRegClock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] z-10" size={13} />
                <input
                  type="time"
                  value={form.demoTime}
                  onChange={(e) => update("demoTime", e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-blue)]/50"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-2 px-5 py-3.5 border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--foreground)] hover:border-[var(--brand-blue)]/40 transition-colors"
              >
                <FaArrowLeft size={12} /> Back
              </button>
              <button
                type="submit"
                disabled={loading || requiresPayment === null || !form.demoDate || !form.demoTime}
                className="flex-1 inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  "Booking..."
                ) : (
                  <>
                    <FaPaperPlane size={12} />
                    {requiresPayment ? `Select Date & Time — ₹${DEMO_FEE_INR}` : "Select Date & Time"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {status && (
          <p className={`text-sm mt-5 text-center ${status.type === "success" ? "text-green-600" : "text-red-500"}`}>
            {status.message}
          </p>
        )}
      </form>

      <p className="text-center text-xs text-[var(--muted)] mt-8">
        By booking, you agree to our{" "}
        <a href="/terms" className="underline hover:text-[var(--brand-blue)]">Terms &amp; Conditions</a> and{" "}
        <a href="/privacy" className="underline hover:text-[var(--brand-blue)]">Privacy Policy</a>.
      </p>
    </div>
  );
}
