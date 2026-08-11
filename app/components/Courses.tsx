"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const courses = [
  {
    level: "Beginner to Advanced",
    title: "Guitar Class",
    description: "Learn chords, rhythm, melody, fingerstyle, and confidence-building practice in structured weekly sessions.",
    lessons: 1,
    duration: "Live 1:1",
    tag: "Popular",
  },
  {
    level: "All Levels",
    title: "Keyboard / Piano",
    description: "Develop timing, hand coordination, and musical expression with personalised keyboard coaching.",
    lessons: 1,
    duration: "Live 1:1",
    tag: "New",
  },
  {
    level: "Kids & Adults",
    title: "Vocals & Singing",
    description: "Improve pitch, voice control, breathing, and performance confidence through guided vocal practice.",
    lessons: 1,
    duration: "Live 1:1",
    tag: null,
  },
  {
    level: "Traditional Rhythm",
    title: "Tabla",
    description: "Build taal, rhythm patterns, and deep musical sensitivity through traditional learning methods.",
    lessons: 1,
    duration: "Live 1:1",
    tag: "Classic",
  },
  {
    level: "Performance",
    title: "Dance",
    description: "Learn movement, rhythm, posture, and performance quality in a fun and encouraging format.",
    lessons: 1,
    duration: "Live 1:1",
    tag: null,
  },
  {
    level: "Confidence",
    title: "Public Speaking",
    description: "Strengthen voice, storytelling, presence, and speaking confidence for school, work, and leadership.",
    lessons: 1,
    duration: "Live 1:1",
    tag: "In demand",
  },
];

export default function Courses() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headingRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headingRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );

      const cards = cardsRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { y: 80, opacity: 0, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.7,
            stagger: 0.15,
            ease: "power3.out",
            scrollTrigger: {
              trigger: cardsRef.current,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="courses" className="py-32 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div ref={headingRef} className="text-center mb-20">
          <p className="text-sm tracking-widest uppercase text-[var(--muted)] mb-4">
            Programs
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Learn what you love,
            <span className="italic text-[var(--brand-orange)]"> one-to-one</span>
          </h2>
          <p className="mt-4 text-[var(--muted)] max-w-lg mx-auto">
            UniEDD offers live online coaching in the creative disciplines that shape confidence, performance, and expression.
          </p>
        </div>

        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map((course, index) => (
            <div
              key={index}
              className="group relative p-8 rounded-2xl border border-[var(--border)] hover:border-[var(--brand-blue)]/30 hover:shadow-xl transition-all duration-500 cursor-pointer overflow-hidden"
            >
              {/* Hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium tracking-wider uppercase text-[var(--brand-blue)] bg-[var(--brand-blue)]/10 px-3 py-1 rounded-full">
                    {course.level}
                  </span>
                  {course.tag && (
                    <span className="text-xs font-medium text-[var(--brand-orange)] bg-[var(--brand-orange)]/10 px-3 py-1 rounded-full">
                      {course.tag}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-semibold mb-2 group-hover:translate-x-1 transition-transform">
                  {course.title}
                </h3>
                <p className="text-[var(--muted)] text-sm leading-relaxed mb-6">
                  {course.description}
                </p>

                <div className="flex items-center gap-6 text-sm text-[var(--muted)]">
                  <span className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 6v6l4 2" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    {course.duration}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 01-2.5-2.5z" />
                      <path d="M8 7h8M8 11h6" strokeLinecap="round" />
                    </svg>
                    Personalised coaching
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
