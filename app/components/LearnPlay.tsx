"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const stats = [
  { value: "1:1", label: "Live coaching", icon: "🎯" },
  { value: "8+", label: "Years of teaching", icon: "🎶" },
  { value: "Weekly", label: "Progress reviews", icon: "📈" },
];

const methods = [
  {
    title: "Start with a free assessment",
    description: "We understand your level, goals, and learning style before creating your personal roadmap.",
    visual: "video",
  },
  {
    title: "Learn in structured live sessions",
    description: "Each lesson is guided by expert faculty, with correction, clarity, and confidence-building built in.",
    visual: "theory",
  },
  {
    title: "Practice with accountability",
    description: "We help students stay consistent, improve performance, and build skills that translate into real confidence.",
    visual: "practice",
  },
];

export default function LearnPlay() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Heading
      gsap.fromTo(
        headingRef.current,
        { y: 50, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: headingRef.current, start: "top 85%" },
        }
      );

      // Method cards
      if (cardsRef.current) {
        const cards = cardsRef.current.children;
        gsap.fromTo(
          cards,
          { x: -40, opacity: 0 },
          {
            x: 0, opacity: 1, duration: 0.6, stagger: 0.15, ease: "power3.out",
            scrollTrigger: { trigger: cardsRef.current, start: "top 80%" },
          }
        );
      }

      // Stats counter animation
      if (statsRef.current) {
        const items = statsRef.current.children;
        gsap.fromTo(
          items,
          { y: 30, opacity: 0, scale: 0.9 },
          {
            y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.12, ease: "back.out(1.4)",
            scrollTrigger: { trigger: statsRef.current, start: "top 85%" },
          }
        );
      }

      // Animated visualization
      if (vizRef.current) {
        // Staff lines draw in
        const lines = vizRef.current.querySelectorAll(".staff-line");
        gsap.fromTo(lines, { scaleX: 0 }, {
          scaleX: 1, duration: 0.8, stagger: 0.08, ease: "power2.out",
          scrollTrigger: { trigger: vizRef.current, start: "top 80%" },
        });

        // Notes bounce in
        const notes = vizRef.current.querySelectorAll(".music-dot");
        gsap.fromTo(notes, { scale: 0, opacity: 0 }, {
          scale: 1, opacity: 1, duration: 0.4, stagger: 0.08, ease: "back.out(2)",
          scrollTrigger: { trigger: vizRef.current, start: "top 75%" },
        });

        // Continuous note pulse
        notes.forEach((note, i) => {
          gsap.to(note, {
            y: -4 + (i % 2 === 0 ? 4 : -4),
            duration: 1.5 + i * 0.2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: i * 0.15,
          });
        });

        // Progress bar animation
        const progressBar = vizRef.current.querySelector(".progress-fill");
        if (progressBar) {
          gsap.fromTo(progressBar, { scaleX: 0 }, {
            scaleX: 1, duration: 2, ease: "power2.out",
            scrollTrigger: { trigger: vizRef.current, start: "top 75%" },
          });
        }

        // Waveform bars
        const waveBars = vizRef.current.querySelectorAll(".wave-bar");
        waveBars.forEach((bar, i) => {
          gsap.to(bar, {
            scaleY: `random(0.3, 1)`,
            duration: 0.3 + (i % 4) * 0.1,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: i * 0.04,
          });
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-28 px-6 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div ref={headingRef} className="text-center mb-16">
          <p className="text-sm tracking-widest uppercase text-[var(--muted)] mb-4">
            How We Teach
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Real coaching.
            <span className="text-[var(--brand-blue)]"> Real progress.</span>
          </h2>
          <p className="mt-4 text-[var(--muted)] max-w-lg mx-auto">
            UniEDD blends live mentoring, detailed correction, and performance-focused guidance so students learn with clarity and confidence.
          </p>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Left — Method cards */}
          <div ref={cardsRef} className="flex flex-col gap-5">
            {methods.map((method, i) => (
              <div
                key={i}
                className="group flex gap-5 items-start p-5 rounded-2xl border border-[var(--border)] hover:border-[var(--brand-blue)]/20 hover:shadow-md transition-all duration-300"
              >
                {/* Visual icon */}
                <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--brand-blue)]/10 to-[var(--brand-orange)]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  {method.visual === "video" && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-blue)" strokeWidth="2" strokeLinecap="round">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  )}
                  {method.visual === "theory" && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 01-2.5-2.5z" />
                      <path d="M8 7h8M8 11h6" />
                    </svg>
                  )}
                  {method.visual === "practice" && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-blue)" strokeWidth="2" strokeLinecap="round">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-1">{method.title}</h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">{method.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right — Animated music + education visualization */}
          <div ref={vizRef} className="relative bg-[#fafafa] rounded-3xl border border-[var(--border)] p-8 min-h-[380px] overflow-hidden">
            {/* Sheet music / staff lines */}
            <div className="mb-6">
              <p className="text-[10px] tracking-widest uppercase text-[var(--muted)] mb-3 font-medium">Live Lesson Preview</p>
              <div className="relative h-28">
                {/* Five staff lines */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="staff-line absolute left-0 right-0 h-px bg-[var(--brand-blue)]/15 origin-left"
                    style={{ top: `${i * 25}%` }}
                  />
                ))}
                {/* Music notes on the staff */}
                {[
                  { x: "8%", y: "10%" },
                  { x: "18%", y: "35%" },
                  { x: "28%", y: "60%" },
                  { x: "38%", y: "35%" },
                  { x: "48%", y: "10%" },
                  { x: "58%", y: "60%" },
                  { x: "68%", y: "85%" },
                  { x: "78%", y: "35%" },
                  { x: "88%", y: "60%" },
                ].map((pos, i) => (
                  <div
                    key={i}
                    className="music-dot absolute w-3.5 h-3 rounded-full"
                    style={{
                      left: pos.x,
                      top: pos.y,
                      background: i % 3 === 0 ? "var(--brand-orange)" : "var(--brand-blue)",
                      opacity: 0.8,
                    }}
                  />
                ))}
                {/* Treble clef hint */}
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl text-[var(--brand-blue)]/20 select-none">𝄞</span>
              </div>
            </div>

            {/* Progress section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Lesson Progress</span>
                <span className="text-xs text-[var(--brand-blue)] font-semibold">78%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="progress-fill h-full rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] origin-left"
                  style={{ width: "78%" }}
                />
              </div>
            </div>

            {/* Audio waveform */}
            <div className="mb-5">
              <p className="text-[10px] tracking-widest uppercase text-[var(--muted)] mb-2 font-medium">Audio Feedback</p>
              <div className="flex items-center gap-[2px] h-8">
                {[...Array(40)].map((_, i) => (
                  <div
                    key={i}
                    className="wave-bar w-[2.5px] rounded-full origin-bottom"
                    style={{
                      height: "100%",
                      transform: "scaleY(0.3)",
                      background: i < 20 ? "var(--brand-blue)" : "var(--brand-orange)",
                      opacity: 0.5,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Chord indicator */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {["Am", "G", "C", "F"].map((chord, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2.5 py-1 rounded-md border font-mono ${
                      i === 0
                        ? "bg-[var(--brand-blue)]/10 border-[var(--brand-blue)]/30 text-[var(--brand-blue)] font-semibold"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    {chord}
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-[var(--muted)]">Next chord in 2 beats</span>
            </div>

            {/* Decorative corner accents */}
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[var(--brand-blue)]/10 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[var(--brand-orange)]/10 rounded-bl-lg" />
          </div>
        </div>

        {/* Stats */}
        <div ref={statsRef} className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-white"
            >
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className="text-xl font-bold bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-xs text-[var(--muted)]">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
