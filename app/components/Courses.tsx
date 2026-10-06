"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PROGRAMS, PROGRAM_CATEGORIES, programPath } from "../lib/programs";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const categories = PROGRAM_CATEGORIES;
type Category = (typeof categories)[number];

export default function Courses() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filtered =
    activeCategory === "All"
      ? PROGRAMS
      : PROGRAMS.filter((c) => c.category === activeCategory);

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

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = cardsRef.current?.children;
      if (cards) {
        gsap.fromTo(
          cards,
          { y: 40, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.5,
            stagger: 0.08,
            ease: "power3.out",
          }
        );
      }
    }, cardsRef);

    return () => ctx.revert();
  }, [activeCategory]);

  return (
    <section ref={sectionRef} id="courses" className="py-32 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div ref={headingRef} className="text-center mb-12">
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

        {/* Category filters */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
              }}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
                activeCategory === cat
                  ? "bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white border-transparent shadow-md"
                  : "text-[var(--muted)] border-[var(--border)] hover:border-[var(--brand-blue)]/40 hover:text-[var(--foreground)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div ref={cardsRef} className="mobile-swipe grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course) => {
            return (
              <div
                key={course.title}
                className="group relative rounded-3xl border border-[var(--border)] hover:border-[var(--brand-blue)]/30 hover:shadow-xl transition-all duration-500 overflow-hidden bg-white flex flex-col"
              >
                {/* Visual header */}
                <Link href={programPath(course)} tabIndex={-1} aria-hidden="true" className="relative block h-44 overflow-hidden">
                  <Image
                    src={course.image}
                    alt={course.imageAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                  {course.tag && (
                    <span className="absolute top-4 right-4 text-xs font-medium text-[var(--foreground)] bg-white px-3 py-1 rounded-full shadow-sm">
                      {course.tag}
                    </span>
                  )}
                </Link>

                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-lg font-semibold text-[var(--brand-blue)] mb-1.5 leading-snug">
                    <Link href={programPath(course)} className="hover:underline underline-offset-2">
                      {course.title}
                    </Link>
                  </h3>
                  <p className="text-sm text-[var(--muted)] mb-4">{course.tagline}</p>

                  <div className="space-y-2 text-sm mb-6">
                    <div className="flex gap-2">
                      <span className="text-[var(--muted)] shrink-0">Age group:</span>
                      <span className="font-medium">{course.ageGroup}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[var(--muted)] shrink-0">Course duration:</span>
                      <span className="font-medium">{course.duration}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[var(--muted)] shrink-0">Format:</span>
                      <span className="font-medium">{course.format}</span>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-col items-center gap-3">
                    <Link
                      href="/#contact"
                      className="w-full text-center px-6 py-3 bg-[var(--brand-blue)]/80 text-white rounded-full text-sm font-semibold hover:opacity-90 hover:-translate-y-px transition-all duration-300"
                    >
                      Book a Demo
                    </Link>
                    <Link
                      href={programPath(course)}
                      className="text-sm text-[var(--foreground)] underline underline-offset-2 hover:text-[var(--brand-blue)] transition-colors"
                    >
                      View course details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
