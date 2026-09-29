"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  { icon: "🎵", label: "Pick your instrument", note: "Guitar or Piano" },
  { icon: "🎶", label: "Follow the rhythm", note: "Structured lessons" },
  { icon: "🎸", label: "Practice daily", note: "15 min a day" },
  { icon: "🎤", label: "Perform & share", note: "Join the community" },
];

export default function MusicJourney() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<SVGSVGElement>(null);
  const eqRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading
      gsap.fromTo(
        headingRef.current,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: headingRef.current, start: "top 85%" },
        }
      );

      // Timeline steps stagger in
      if (timelineRef.current) {
        const cards = timelineRef.current.querySelectorAll(".step-card");
        gsap.fromTo(
          cards,
          { y: 60, opacity: 0, scale: 0.9 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.6,
            stagger: 0.2,
            ease: "back.out(1.2)",
            scrollTrigger: { trigger: timelineRef.current, start: "top 80%" },
          }
        );

        // Connecting line draws in
        const line = timelineRef.current.querySelector(".connect-line");
        if (line) {
          gsap.fromTo(
            line,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 1.2,
              ease: "power2.out",
              scrollTrigger: { trigger: timelineRef.current, start: "top 80%" },
            }
          );
        }
      }

      // Sound wave animation
      if (waveRef.current) {
        const paths = waveRef.current.querySelectorAll(".wave-path");
        paths.forEach((path, i) => {
          gsap.to(path, {
            attr: { d: generateWavePath(i, true) },
            duration: 2 + i * 0.5,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: i * 0.3,
          });
        });
      }

      // Equalizer bars
      if (eqRef.current) {
        const bars = eqRef.current.children;
        Array.from(bars).forEach((bar, i) => {
          gsap.to(bar, {
            scaleY: `random(0.3, 1)`,
            duration: 0.4 + (i % 3) * 0.1,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: i * 0.05,
          });
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-28 px-6 bg-[#fafafa] relative overflow-hidden">
      {/* Animated background sound wave */}
      <svg
        ref={waveRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 1200 400"
      >
        <path
          className="wave-path"
          d={generateWavePath(0, false)}
          fill="none"
          stroke="var(--brand-blue)"
          strokeWidth="1"
          opacity="0.06"
        />
        <path
          className="wave-path"
          d={generateWavePath(1, false)}
          fill="none"
          stroke="var(--brand-orange)"
          strokeWidth="1"
          opacity="0.05"
        />
        <path
          className="wave-path"
          d={generateWavePath(2, false)}
          fill="none"
          stroke="var(--brand-blue)"
          strokeWidth="0.8"
          opacity="0.04"
        />
      </svg>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Heading */}
        <div ref={headingRef} className="text-center mb-16">
          <p className="text-sm tracking-widest uppercase text-[var(--muted)] mb-4">
            How It Works
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Your path from{" "}
            <span className="bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] bg-clip-text text-transparent">
              beginner to performer
            </span>
          </h2>
        </div>

        {/* Timeline */}
        <div ref={timelineRef} className="relative">
          {/* Connecting line */}
          <div className="connect-line hidden md:block absolute top-1/2 left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-[var(--brand-blue)] via-[var(--brand-orange)] to-[var(--brand-blue)] opacity-20 origin-left" />

          {/* Steps */}
          <div className="mobile-swipe grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div
                key={i}
                className="step-card relative flex flex-col items-center text-center p-6 rounded-2xl bg-white border border-[var(--border)] shadow-sm hover:shadow-md hover:border-[var(--brand-blue)]/20 transition-all duration-300 group"
              >
                {/* Step number */}
                <div className="absolute -top-3 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-orange)] flex items-center justify-center text-white text-xs font-bold shadow-md">
                  {i + 1}
                </div>

                {/* Icon with pulse ring */}
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--brand-blue)]/5 to-[var(--brand-orange)]/5 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-300">
                    {step.icon}
                  </div>
                  <div className="absolute inset-0 rounded-full border border-[var(--brand-blue)]/10 animate-ping opacity-30" style={{ animationDuration: `${3 + i}s` }} />
                </div>

                <h3 className="font-semibold text-sm mb-1">{step.label}</h3>
                <p className="text-xs text-[var(--muted)]">{step.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Animated equalizer */}
        <div className="flex justify-center mt-16">
          <div ref={eqRef} className="flex items-end gap-[3px] h-12">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full origin-bottom"
                style={{
                  height: "100%",
                  transform: "scaleY(0.3)",
                  background: i % 2 === 0
                    ? "var(--brand-blue)"
                    : "var(--brand-orange)",
                  opacity: 0.4,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function generateWavePath(index: number, alt: boolean): string {
  const y = 150 + index * 60;
  const amp = alt ? 30 + index * 10 : 20 + index * 8;
  let d = `M0,${y}`;
  for (let x = 0; x <= 1200; x += 50) {
    const offset = alt ? Math.PI * 0.5 : 0;
    const wave = Math.sin((x / 150) + index + offset) * amp;
    d += ` Q${x + 25},${y + wave} ${x + 50},${y}`;
  }
  return d;
}
