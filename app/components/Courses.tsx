"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const categories = ["All", "Music", "Dance", "Public Speaking"] as const;
type Category = (typeof categories)[number];

const courses: {
  category: Category;
  image: string;
  title: string;
  tagline: string;
  ageGroup: string;
  duration: string;
  format: string;
  description: string;
  tag: string | null;
}[] = [
  {
    category: "Music",
    image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=70&auto=format&fit=crop",
    title: "Online Guitar Classes for Kids",
    tagline: "Strum, create & shine — on stage & in life",
    ageGroup: "5-45 Years",
    duration: "48 sessions in 6 months for beginner level",
    format: "Group or Individual Classes",
    description:
      "Learn chords, rhythm, melody, fingerstyle, and confidence-building practice in structured weekly sessions with a dedicated coach.",
    tag: "Popular",
  },
  {
    category: "Music",
    image: "/piano-hero.jpg",
    title: "Online Keyboard & Piano Classes for Kids",
    tagline: "Every key unlocks a little more confidence",
    ageGroup: "5-45 Years",
    duration: "48 sessions in 6 months for beginner level",
    format: "Group or Individual Classes",
    description:
      "Develop timing, hand coordination, and musical expression with personalised keyboard coaching designed around your child's pace.",
    tag: "New",
  },
  {
    category: "Music",
    image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=70&auto=format&fit=crop",
    title: "Online Vocals & Singing Classes for Kids",
    tagline: "Find your voice, then find your stage",
    ageGroup: "5-45 Years",
    duration: "48 sessions in 6 months for beginner level",
    format: "Group or Individual Classes",
    description:
      "Improve pitch, voice control, breathing, and performance confidence through guided vocal practice with regular performance opportunities.",
    tag: null,
  },
  {
    category: "Music",
    image: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800&q=70&auto=format&fit=crop",
    title: "Online Tabla Classes for Kids",
    tagline: "Build rhythm, build discipline",
    ageGroup: "5-45 Years",
    duration: "48 sessions in 6 months for beginner level",
    format: "Group or Individual Classes",
    description:
      "Build taal, rhythm patterns, and deep musical sensitivity through traditional learning methods passed down through generations.",
    tag: "Classic",
  },
  {
    category: "Dance",
    image: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=800&q=70&auto=format&fit=crop",
    title: "Online Dance Classes for Kids",
    tagline: "Move, express & perform with joy",
    ageGroup: "5-45 Years",
    duration: "48 sessions in 6 months for beginner level",
    format: "Group or Individual Classes",
    description:
      "Learn movement, rhythm, posture, and performance quality in a fun and encouraging format that builds discipline and self-expression.",
    tag: null,
  },
  {
    category: "Public Speaking",
    image: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=70&auto=format&fit=crop",
    title: "Online Public Speaking Classes for Kids",
    tagline: "Build sharper communication for school and life",
    ageGroup: "5-45 Years",
    duration: "48 sessions in 6 months for beginner level",
    format: "Group or Individual Classes",
    description:
      "Strengthen voice, storytelling, presence, and speaking confidence for school, work, and leadership through live guided practice.",
    tag: "In demand",
  },
];

export default function Courses() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered =
    activeCategory === "All"
      ? courses
      : courses.filter((c) => c.category === activeCategory);

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
                setExpanded(null);
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

        <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course, index) => {
            const isOpen = expanded === index;
            return (
              <div
                key={course.title}
                className="group relative rounded-3xl border border-[var(--border)] hover:border-[var(--brand-blue)]/30 hover:shadow-xl transition-all duration-500 overflow-hidden bg-white flex flex-col"
              >
                {/* Visual header */}
                <div className="relative h-44 overflow-hidden">
                  <Image
                    src={course.image}
                    alt={course.title}
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
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-lg font-semibold text-[var(--brand-blue)] mb-1.5 leading-snug">
                    {course.title}
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

                  {isOpen && (
                    <p className="text-sm text-[var(--muted)] leading-relaxed mb-6 border-t border-[var(--border)] pt-4">
                      {course.description}
                    </p>
                  )}

                  <div className="mt-auto flex flex-col items-center gap-3">
                    <a
                      href="#contact"
                      className="w-full text-center px-6 py-3 bg-[var(--brand-blue)]/80 text-white rounded-full text-sm font-semibold hover:opacity-90 hover:-translate-y-px transition-all duration-300"
                    >
                      Book A Free Demo
                    </a>
                    <button
                      onClick={() => setExpanded(isOpen ? null : index)}
                      className="text-sm text-[var(--foreground)] underline underline-offset-2 hover:text-[var(--brand-blue)] transition-colors"
                    >
                      {isOpen ? "Hide details" : "View details"}
                    </button>
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
