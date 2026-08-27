"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const plans = [
  {
    name: "Foundation",
    price: "₹1,499",
    cadence: "/month",
    description: "For beginners starting their creative journey with guided structure.",
    features: [
      "2 live sessions per week",
      "Personalised beginner roadmap",
      "Practice tracker and feedback",
      "Parent progress updates",
    ],
    popular: false,
  },
  {
    name: "Performance",
    price: "₹2,499",
    cadence: "/month",
    description: "Built for steady progress, confidence, and performance skills.",
    features: [
      "3 live sessions per week",
      "Custom goal planning",
      "Performance and recital prep",
      "Priority mentor support",
    ],
    popular: true,
  },
  {
    name: "Elite",
    price: "₹3,999",
    cadence: "/month",
    description: "For serious learners and ambitious performers aiming to excel fast.",
    features: [
      "4 live sessions per week",
      "Advanced coaching & mentorship",
      "Stage-ready performance guidance",
      "Dedicated support for growth",
    ],
    popular: false,
  },
];

export default function Pricing() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headingRef.current,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headingRef.current,
            start: "top 85%",
          },
        }
      );

      const cards = cardsRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.15,
            ease: "power3.out",
            scrollTrigger: {
              trigger: cardsRef.current,
              start: "top 80%",
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="pricing" className="py-32 px-6 bg-[#f7f7f7]">
      <div className="max-w-7xl mx-auto">
        <div ref={headingRef} className="text-center mb-16">
          <p className="text-sm tracking-widest uppercase text-[var(--muted)] mb-4">
            Pricing
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Choose a plan that
            <span className="italic text-[var(--brand-orange)]"> fits your growth</span>
          </h2>
          <p className="mt-4 text-[var(--muted)] max-w-xl mx-auto">
            Flexible monthly plans designed for kids, teens, adults, and performers at every stage.
          </p>
        </div>

        <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl border p-8 transition-all duration-300 ${
                plan.popular
                  ? "border-[var(--brand-blue)] bg-white shadow-xl shadow-[var(--brand-blue)]/10"
                  : "border-[var(--border)] bg-white"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">{plan.name}</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-[var(--muted)] pb-1">{plan.cadence}</span>
                </div>
                <p className="mt-4 text-sm text-[var(--muted)] leading-relaxed">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-[var(--foreground)]">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-xs font-bold">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-all ${
                  plan.popular
                    ? "bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white shadow-lg shadow-[var(--brand-blue)]/20"
                    : "bg-[var(--foreground)] text-white hover:opacity-90"
                }`}
              >
                Book a Demo
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
