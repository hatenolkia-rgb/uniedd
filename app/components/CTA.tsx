"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lottie from "lottie-react";
import guitaristAnimation from "@/public/Guitarist.json";

gsap.registerPlugin(ScrollTrigger);

export default function CTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bgElementsRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      instrument: formData.get("instrument") as string,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        setStatus({ type: "success", message: "Message Sent Successfully! Our team will connect within 24 hours." });
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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="cta" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div ref={contentRef} className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center border border-[var(--border)] rounded-3xl p-10 sm:p-14 overflow-hidden relative">
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

          {/* Left — Contact Form */}
          <div className="relative z-10">
            <p className="text-sm tracking-widest uppercase text-[var(--brand-blue)] mb-3 font-medium">
              Get Started
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] tracking-tight mb-3"
              style={{ fontFamily: "var(--font-playfair), serif" }}
            >
              Ready to start your
              <br />
              musical journey?
            </h2>
            <p className="text-[var(--muted)] mb-8 text-sm leading-relaxed">
              Join thousands of students who discovered their passion. Sign up and get your first lesson free.
            </p>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  name="firstName"
                  placeholder="First name"
                  required
                  className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
                />
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last name"
                  className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
                />
                <input
                  type="tel"
                  name="phone"
                  placeholder="Mobile number"
                  required
                  className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
                />
              </div>
              <input
                type="email"
                name="email"
                placeholder="Email address"
                required
                className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors"
              />
              <select
                name="instrument"
                required
                className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-[var(--muted)] text-sm focus:outline-none focus:border-[var(--brand-blue)]/50 transition-colors appearance-none"
                defaultValue=""
              >
                <option value="" disabled>What do you want to learn?</option>
                <option value="Guitar">Guitar</option>
                <option value="Piano">Piano</option>
                <option value="Both">Both</option>
                <option value="Music Theory">Music Theory</option>
              </select>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-xl text-sm font-semibold hover:opacity-90 hover:-translate-y-px transition-all duration-300 shadow-lg shadow-[var(--brand-blue)]/20 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Start Free Trial"}
              </button>
              {status && (
                <p className={`text-sm mt-1 ${status.type === "success" ? "text-green-600" : "text-red-500"}`}>
                  {status.message}
                </p>
              )}
            </form>
          </div>

          {/* Right — Guitarist Lottie */}
          <div className="relative flex items-center justify-center">
            <div className="w-full max-w-sm lg:max-w-md">
              <Lottie
                animationData={guitaristAnimation}
                loop
                autoplay
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
