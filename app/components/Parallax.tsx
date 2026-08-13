"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function Parallax() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax layers moving at different speeds
      gsap.to(layer1Ref.current, {
        yPercent: -30,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });

      gsap.to(layer2Ref.current, {
        yPercent: -50,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.5,
        },
      });

      gsap.to(layer3Ref.current, {
        yPercent: -70,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 2,
        },
      });

      // Text reveal on scroll
      gsap.fromTo(
        textRef.current,
        { y: 100, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: textRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden flex items-center justify-center bg-[#f5f5f5] py-24 sm:py-0 sm:h-[60vh] lg:h-[80vh]"
    >
      {/* Parallax layers */}
      <div
        ref={layer1Ref}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="grid grid-cols-8 gap-8 opacity-[0.04] w-full h-full p-8">
          {[...Array(32)].map((_, i) => (
            <div
              key={i}
              className="text-6xl sm:text-8xl flex items-center justify-center select-none"
            >
              {["♪", "♫", "♩", "♬"][i % 4]}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={layer2Ref}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="w-[600px] h-[600px] rounded-full border border-[var(--brand-blue)]/10" />
        <div className="absolute w-[400px] h-[400px] rounded-full border border-[var(--brand-orange)]/15" />
        <div className="absolute w-[200px] h-[200px] rounded-full border border-[var(--brand-blue)]/20" />
      </div>

      <div
        ref={layer3Ref}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      >
        <div className="absolute top-[10%] left-[5%] w-2 h-2 rounded-full bg-gray-300" />
        <div className="absolute top-[20%] right-[10%] w-3 h-3 rounded-full bg-gray-200" />
        <div className="absolute bottom-[30%] left-[15%] w-2 h-2 rounded-full bg-gray-400" />
        <div className="absolute top-[50%] right-[20%] w-1.5 h-1.5 rounded-full bg-gray-300" />
        <div className="absolute bottom-[15%] right-[30%] w-2.5 h-2.5 rounded-full bg-gray-200" />
        <div className="absolute top-[70%] left-[40%] w-2 h-2 rounded-full bg-gray-300" />
      </div>

      {/* Center text */}
      <div ref={textRef} className="relative z-10 text-center px-6">
        <p className="text-sm tracking-widest uppercase text-[var(--muted)] mb-6">
          The Journey
        </p>
        <h2
          className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight"
          style={{ fontFamily: "var(--font-playfair), serif" }}
        >
          Where education
          <br />
          meets <span className="italic bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] bg-clip-text text-transparent">melody</span>
        </h2>
        <p className="mt-6 text-lg text-[var(--muted)] max-w-lg mx-auto">
          We blend structured learning with the passion of music, creating an
          experience that&apos;s both educational and deeply inspiring.
        </p>
      </div>
    </section>
  );
}
