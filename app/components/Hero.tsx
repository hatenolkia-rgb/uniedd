"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import Image from "next/image";

const HERO_SLIDES = [
  {
    src: "/piano-hero.jpg",
    alt: "Close-up of piano keys, representing UniEDD's live piano coaching",
    label: "Piano",
  },
  {
    src: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=70&auto=format&fit=crop",
    alt: "Close-up of hands playing an acoustic guitar, representing UniEDD's live guitar coaching",
    label: "Guitar",
  },
  {
    src: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=70&auto=format&fit=crop",
    alt: "Stage microphone, representing UniEDD's live vocals coaching",
    label: "Vocals",
  },
  {
    src: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=800&q=70&auto=format&fit=crop",
    alt: "Dancer mid-performance, representing UniEDD's live dance coaching",
    label: "Dance",
  },
];

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const lottieWrapRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  // Auto-rotate the hero photo through each program
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((i) => (i + 1) % HERO_SLIDES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.3 });

      tl.fromTo(titleRef.current, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power4.out" })
        .fromTo(subtitleRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, "-=0.4")
        .fromTo(ctaRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, "-=0.3")
        .fromTo(lottieWrapRef.current, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: "back.out(1.2)" }, "-=0.6");

      // Gentle floating on the lottie
      gsap.to(lottieWrapRef.current, {
        y: -10,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // Mouse parallax
      const handleMove = (e: MouseEvent) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        gsap.to(lottieWrapRef.current, {
          x: x * 15,
          y: y * 10,
          rotateY: x * 5,
          rotateX: -y * 3,
          duration: 1.2,
          ease: "power2.out",
        });
      };

      window.addEventListener("mousemove", handleMove);
      return () => window.removeEventListener("mousemove", handleMove);
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={heroRef} className="relative overflow-hidden px-6 lg:min-h-screen lg:flex lg:items-center" style={{ perspective: "1000px" }}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#fdfcfb] via-white to-[#f7f4ef]" />
      <div className="absolute top-0 right-0 w-[60%] h-full bg-gradient-to-l from-[var(--brand-orange)]/[0.03] to-transparent" />
      <div className="absolute bottom-0 left-0 w-[40%] h-[60%] bg-gradient-to-tr from-[var(--brand-blue)]/[0.03] to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-10 items-center pt-24 pb-12 lg:pt-28 lg:pb-20">
        {/* Left — Text */}
        <div className="flex flex-col gap-6 max-w-xl">
          <div className="inline-flex items-center gap-2 border border-[var(--border)] rounded-full px-4 py-1.5 w-fit bg-white shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-[var(--muted)]">Live 1:1 online classes • New Delhi • 15+ years experience</span>
          </div>

          <h1
            ref={titleRef}
            className="text-[2.75rem] sm:text-6xl lg:text-[4.2rem] font-bold leading-[1.1] tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Music, dance &
            <br />
            <span className="bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] bg-clip-text text-transparent">
              confidence for every age
            </span>
          </h1>

          <p ref={subtitleRef} className="text-base sm:text-lg text-[var(--muted)] leading-relaxed">
            UniEDD helps kids and adults learn Guitar, Keyboard, Vocals, Tabla, Dance, and Public Speaking through live online coaching, expert mentors, and personalised practice plans.
          </p>

          <div ref={ctaRef} className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="#contact"
              className="px-7 py-3.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-full text-sm font-semibold shadow-lg shadow-[var(--brand-blue)]/10 hover:shadow-xl hover:-translate-y-px transition-all duration-300"
            >
              Book a Demo
            </a>
            <a href="#courses" className="flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              <span className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center bg-white shadow-sm">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 1.5L10 6L3 10.5V1.5Z" fill="var(--brand-blue)" />
                </svg>
              </span>
              Explore programs
            </a>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 pt-5 mt-2 border-t border-[var(--border)]">
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">1,000+</p>
              <p className="text-[11px] text-[var(--muted)]">Students trained</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">120+</p>
              <p className="text-[11px] text-[var(--muted)]">Educators</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">15+</p>
              <p className="text-[11px] text-[var(--muted)]">Years of experience</p>
            </div>
          </div>
        </div>

        {/* Right — Hero photo */}
        <div className="relative flex items-center justify-center min-h-[400px] lg:min-h-[550px]">
          {/* Soft glow behind */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-20 blur-[80px]" style={{ background: "radial-gradient(circle, var(--brand-blue), var(--brand-orange), transparent)" }} />

          <div
            ref={lottieWrapRef}
            className="relative w-full max-w-md lg:max-w-lg aspect-[800/533] rounded-3xl overflow-hidden border border-[var(--border)] shadow-2xl shadow-black/10"
            style={{ transformStyle: "preserve-3d" }}
          >
            {HERO_SLIDES.map((slide, i) => (
              <Image
                key={slide.src}
                src={slide.src}
                alt={slide.alt}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 90vw, 40vw"
                className={`object-cover transition-opacity duration-1000 ${
                  i === activeSlide ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
            {/* Brand gradient wash to tie the photo into the palette */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-blue)]/15 via-transparent to-[var(--brand-orange)]/10 mix-blend-multiply pointer-events-none" />

            {/* Slide indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {HERO_SLIDES.map((slide, i) => (
                <button
                  key={slide.label}
                  onClick={() => setActiveSlide(i)}
                  aria-label={`Show ${slide.label} photo`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeSlide ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 opacity-60">
        <div className="w-5 h-8 rounded-full border-[1.5px] border-[var(--muted)]/30 flex justify-center pt-2">
          <div className="w-1 h-2 rounded-full bg-[var(--brand-blue)] animate-bounce" />
        </div>
      </div>
    </section>
  );
}
