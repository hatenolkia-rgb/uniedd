"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import Image from "next/image";

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    gsap.fromTo(
      navRef.current,
      { y: -100, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.5 }
    );

    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        scrolled
          ? "bg-white/90 backdrop-blur-md shadow-sm border-[var(--border)]"
          : "bg-white/60 backdrop-blur-sm border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Image src="/logo.png" className="w-32 h-12 object-contain" alt="UniEDD logo" width={2332} height={908} priority />

        {/* Desktop nav */}
        <div className="hidden xl:flex items-center gap-5">
          <a href="#about" className="relative text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors after:absolute after:left-0 after:-bottom-1 after:h-[1.5px] after:w-0 after:bg-gradient-to-r after:from-[var(--brand-blue)] after:to-[var(--brand-orange)] hover:after:w-full after:transition-all after:duration-300">
            About
          </a>
          <a href="#courses" className="relative text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors after:absolute after:left-0 after:-bottom-1 after:h-[1.5px] after:w-0 after:bg-gradient-to-r after:from-[var(--brand-blue)] after:to-[var(--brand-orange)] hover:after:w-full after:transition-all after:duration-300">
            Programs
          </a>
          <a href="/pricing" className="relative text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors after:absolute after:left-0 after:-bottom-1 after:h-[1.5px] after:w-0 after:bg-gradient-to-r after:from-[var(--brand-blue)] after:to-[var(--brand-orange)] hover:after:w-full after:transition-all after:duration-300">
            Pricing
          </a>
          <a href="#testimonials" className="relative text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors after:absolute after:left-0 after:-bottom-1 after:h-[1.5px] after:w-0 after:bg-gradient-to-r after:from-[var(--brand-blue)] after:to-[var(--brand-orange)] hover:after:w-full after:transition-all after:duration-300">
            Reviews
          </a>

          <div className="w-px h-5 bg-[var(--border)]" />

          <a
            href="https://lms.uniedd.com"
            target="_blank"
            rel="noreferrer"
            className="text-sm px-3.5 py-2 rounded-full border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--brand-blue)]/50 hover:text-[var(--brand-blue)] transition-colors whitespace-nowrap"
          >
            Teacher Login
          </a>
          <a
            href="https://lms.uniedd.com"
            target="_blank"
            rel="noreferrer"
            className="text-sm px-3.5 py-2 rounded-full border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--brand-blue)]/50 hover:text-[var(--brand-blue)] transition-colors whitespace-nowrap"
          >
            Student Login
          </a>

          <a
            href="#contact"
            className="text-sm px-5 py-2.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-full hover:opacity-90 hover:-translate-y-px transition-all duration-300 shadow-md shadow-[var(--brand-blue)]/20 whitespace-nowrap"
          >
            Book a Demo
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          className="xl:hidden flex flex-col gap-1.5"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`w-6 h-0.5 bg-[var(--foreground)] transition-transform ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`w-6 h-0.5 bg-[var(--foreground)] transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`w-6 h-0.5 bg-[var(--foreground)] transition-transform ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="xl:hidden bg-white/95 backdrop-blur-md border-t border-[var(--border)] px-6 py-6 flex flex-col gap-4">
          <a href="#about" className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setMenuOpen(false)}>
            About
          </a>
          <a href="#courses" className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setMenuOpen(false)}>
            Programs
          </a>
          <a href="/pricing" className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setMenuOpen(false)}>
            Pricing
          </a>
          <a href="#testimonials" className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setMenuOpen(false)}>
            Reviews
          </a>

          <div className="h-px bg-[var(--border)] my-1" />

          <a
            href="https://lms.uniedd.com"
            target="_blank"
            rel="noreferrer"
            className="text-sm px-5 py-2.5 rounded-full border border-[var(--border)] text-[var(--foreground)] text-center"
            onClick={() => setMenuOpen(false)}
          >
            Teacher Login
          </a>
          <a
            href="https://lms.uniedd.com"
            target="_blank"
            rel="noreferrer"
            className="text-sm px-5 py-2.5 rounded-full border border-[var(--border)] text-[var(--foreground)] text-center"
            onClick={() => setMenuOpen(false)}
          >
            Student Login
          </a>

          <a
            href="#contact"
            className="text-sm px-5 py-2.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-full text-center"
            onClick={() => setMenuOpen(false)}
          >
            Book a Demo
          </a>
        </div>
      )}
    </nav>
  );
}
