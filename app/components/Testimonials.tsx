"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const testimonials = [
  {
    name: "Parent, Rohini",
    role: "Guitar learner",
    quote:
      "Our daughter started with guitar and now she waits for every class. The trainers are patient, encouraging, and genuinely focused on progress.",
    initials: "R",
  },
  {
    name: "Working Professional, Noida",
    role: "Vocal student",
    quote:
      "I was looking for a beginner-friendly way to learn singing without pressure. The 1:1 format made all the difference and kept me consistent.",
    initials: "N",
  },
  {
    name: "Student, Gurugram",
    role: "Public speaking learner",
    quote:
      "The public speaking classes helped me become calmer, clearer, and much more confident in school presentations and conversations.",
    initials: "G",
  },
  {
    name: "Parent, South Delhi",
    role: "Chess learner",
    quote:
      "Our son picked up chess as a hobby and it's sharpened so much more than his game — his patience and focus at school have genuinely improved too.",
    initials: "S",
  },
];

export default function Testimonials() {
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
          { y: 50, opacity: 0, rotateX: 10 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            duration: 0.7,
            stagger: 0.2,
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
    <section ref={sectionRef} id="testimonials" className="py-32 px-6 bg-[#f8f8f8]">
      <div className="max-w-7xl mx-auto">
        <div ref={headingRef} className="text-center mb-20">
          <p className="text-sm tracking-widest uppercase text-[var(--muted)] mb-4">
            Community
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Hear from our <span className="italic text-[var(--brand-blue)]">students</span>
          </h2>
        </div>

        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="p-8 rounded-2xl bg-white border border-[var(--border)] hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand-blue)]/20 to-[var(--brand-orange)]/20 flex items-center justify-center text-sm font-medium text-[var(--foreground)]">
                  {testimonial.initials}
                </div>
                <div>
                  <p className="text-sm font-medium">{testimonial.name}</p>
                  <p className="text-xs text-[var(--muted)]">{testimonial.role}</p>
                </div>
              </div>
              <p className="text-[var(--muted)] text-sm leading-relaxed italic">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="mt-4 flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="var(--brand-orange)"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
