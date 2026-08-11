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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Image src="/logo.png" className="w-32 h-12" alt="logo" width={1000} height={1000} />

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#about" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            About
          </a>
          <a href="#courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            Programs
          </a>
          <a href="#pricing" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            Pricing
          </a>
          <a href="#testimonials" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            Reviews
          </a>
          <a
            href="#contact"
            className="text-sm px-5 py-2.5 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white rounded-full hover:opacity-90 transition-opacity"
          >
            Book a Demo
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden flex flex-col gap-1.5"
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
        <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-[var(--border)] px-6 py-6 flex flex-col gap-4">
          <a href="#about" className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setMenuOpen(false)}>
            About
          </a>
          <a href="#courses" className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setMenuOpen(false)}>
            Programs
          </a>
          <a href="#pricing" className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setMenuOpen(false)}>
            Pricing
          </a>
          <a href="#testimonials" className="text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setMenuOpen(false)}>
            Reviews
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
