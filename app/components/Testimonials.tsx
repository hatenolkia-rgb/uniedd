"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TESTIMONIALS, type Testimonial } from "../lib/testimonials";

gsap.registerPlugin(ScrollTrigger);

// Each half of a marquee track needs to be wider than the screen, or a gap
// shows before the loop restarts. Repeat short lists until they're long enough.
const MIN_CARDS_PER_HALF = 8;

function fillRow(items: Testimonial[]): Testimonial[] {
  if (items.length === 0) return [];
  const row = [...items];
  while (row.length < MIN_CARDS_PER_HALF) row.push(...items);
  return row;
}

// Two rows scrolling in opposite directions. With few reviews, both rows
// show all of them (offset so the same card isn't stacked); with more, they
// split the list between them.
function splitRows(items: Testimonial[]): [Testimonial[], Testimonial[]] {
  if (items.length < 8) {
    const offset = Math.ceil(items.length / 2);
    return [fillRow(items), fillRow([...items.slice(offset), ...items.slice(0, offset)])];
  }
  return [
    fillRow(items.filter((_, i) => i % 2 === 0)),
    fillRow(items.filter((_, i) => i % 2 === 1)),
  ];
}

function Stars() {
  return (
    <div className="flex gap-0.5" aria-label="5 out of 5 stars">
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="var(--brand-orange)" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="w-[300px] sm:w-[360px] shrink-0 p-7 rounded-2xl bg-white border border-[var(--border)] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <Stars />
      <blockquote className="mt-4 text-[var(--muted)] text-sm leading-relaxed">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-orange)] flex items-center justify-center text-sm font-semibold text-white">
          {testimonial.initials}
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">{testimonial.name}</p>
          <p className="text-xs text-[var(--muted)]">{testimonial.role}</p>
        </div>
      </figcaption>
    </figure>
  );
}

function MarqueeRow({ items, reverse, duration }: { items: Testimonial[]; reverse?: boolean; duration: number }) {
  return (
    <div className="marquee-row marquee-mask overflow-hidden py-3">
      <div
        className={`flex w-max gap-6 ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        {/* The track is the row twice; the copy is only there for the loop. */}
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-6 pr-6" aria-hidden={copy === 1 || undefined}>
            {items.map((testimonial, i) => (
              <ReviewCard key={`${copy}-${i}`} testimonial={testimonial} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const [topRow, bottomRow] = splitRows(TESTIMONIALS);

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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  if (TESTIMONIALS.length === 0) return null;

  return (
    <section ref={sectionRef} id="testimonials" className="py-32 bg-[#f8f8f8] overflow-hidden">
      <div ref={headingRef} className="text-center mb-16 px-6">
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

      <div className="flex flex-col gap-3">
        <MarqueeRow items={topRow} duration={topRow.length * 7} />
        <MarqueeRow items={bottomRow} duration={bottomRow.length * 8} reverse />
      </div>
    </section>
  );
}
