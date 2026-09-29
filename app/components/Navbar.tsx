"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import Image from "next/image";
import { FaChevronDown, FaArrowRight, FaUserGraduate, FaChalkboardTeacher } from "react-icons/fa";

const LMS_URL = "https://lms.uniedd.com";

// `section` = the homepage section id this link highlights while it's on screen.
const NAV_LINKS = [
  { href: "/#about", label: "About", section: "about" },
  { href: "/#courses", label: "Programs", section: "courses" },
  { href: "/#learners", label: "Learners", section: "learners" },
  { href: "/#testimonials", label: "Reviews", section: "testimonials" },
  { href: "/pricing", label: "Pricing" },
];

const LOGINS = [
  { label: "Student Login", hint: "Classes, practice & progress", Icon: FaUserGraduate },
  { label: "Teacher Login", hint: "Schedule & student notes", Icon: FaChalkboardTeacher },
];

export default function Navbar() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Entrance animation, shrink-on-scroll, and the scroll progress line
  useEffect(() => {
    gsap.fromTo(headerRef.current, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" });

    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      }
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Highlight the link for whichever homepage section is in the middle of the screen
  useEffect(() => {
    const sections = NAV_LINKS.flatMap((link) => {
      const el = link.section ? document.getElementById(link.section) : null;
      return el ? [el] : [];
    });
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  // Close the login menu on outside click or Escape
  useEffect(() => {
    if (!loginOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!loginRef.current?.contains(e.target as Node)) setLoginOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLoginOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [loginOpen]);

  const isActive = (link: (typeof NAV_LINKS)[number]) =>
    link.section ? pathname === "/" && activeSection === link.section : pathname === link.href;

  return (
    <header ref={headerRef} className="fixed top-0 inset-x-0 z-50">
      {/* Announcement strip (desktop and tablet only; hidden on phones):
          shown at the top of the page, collapses once the visitor scrolls. */}
      <div
        className={`hidden sm:block overflow-hidden bg-gradient-to-r from-[#0a1622] via-[#13335a] to-[#0a1622] text-white transition-[max-height,opacity] duration-300 ${
          scrolled ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
        }`}
      >
        <div className="flex h-9 items-center justify-center gap-3 px-4 text-[13px] whitespace-nowrap">
          <span className="inline-flex items-center gap-2 font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live 1:1 classes
          </span>
          <span className="hidden sm:inline opacity-40">·</span>
          <span className="hidden sm:inline text-white/80">Learners worldwide, any timezone</span>
          <span className="opacity-40">·</span>
          <Link href="/#contact" className="font-bold text-[var(--brand-orange)] hover:underline">
            Book a free 30-min demo →
          </Link>
        </div>
      </div>

      <div className="relative px-3 sm:px-5 pt-3">
      {/* Gradient border: a 1px padded wrapper behind the glass bar */}
      <div
        className={`relative mx-auto max-w-6xl rounded-full p-px bg-gradient-to-r from-[var(--brand-blue)]/50 via-[var(--brand-orange)]/50 to-[var(--brand-blue)]/50 animate-gradient-x transition-shadow duration-300 ${
          scrolled ? "shadow-xl shadow-[var(--brand-blue)]/10" : "shadow-md shadow-black/5"
        }`}
      >
        <nav
          aria-label="Main"
          className={`relative flex items-center justify-between gap-4 rounded-full pl-4 sm:pl-5 pr-2 backdrop-blur-xl transition-all duration-300 ${
            scrolled ? "bg-white/90 py-1.5" : "bg-white/75 py-2.5"
          }`}
        >
          <Link href="/" aria-label="UniEDD home" className="shrink-0">
            <Image
              src="/logo.png"
              className={`object-contain transition-all duration-300 ${scrolled ? "w-24 h-9" : "w-28 h-10"}`}
              alt="UniEDD logo"
              width={2332}
              height={908}
              priority
            />
          </Link>

          {/* Desktop links */}
          <ul className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link) ? "location" : undefined}
                  className={`relative block rounded-full px-4 py-2 text-sm transition-all duration-300 ${
                    isActive(link)
                      ? "bg-gradient-to-r from-[var(--brand-blue)]/10 to-[var(--brand-orange)]/10 text-[var(--foreground)] font-medium"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/[0.04]"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden lg:flex items-center gap-2">
            {/* Login menu */}
            <div ref={loginRef} className="relative">
              <button
                type="button"
                onClick={() => setLoginOpen((open) => !open)}
                aria-expanded={loginOpen}
                aria-haspopup="true"
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-[var(--foreground)] hover:bg-black/[0.04] transition-colors"
              >
                Login
                <FaChevronDown size={10} className={`transition-transform duration-200 ${loginOpen ? "rotate-180" : ""}`} />
              </button>
              {loginOpen && (
                <div className="absolute right-0 top-full mt-3 w-64 rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-xl">
                  {LOGINS.map(({ label, hint, Icon }) => (
                    <a
                      key={label}
                      href={LMS_URL}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setLoginOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--background)] transition-colors"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-blue)]/15 to-[var(--brand-orange)]/15 text-[var(--brand-blue)]">
                        <Icon size={15} />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-[var(--foreground)]">{label}</span>
                        <span className="block text-xs text-[var(--muted)]">{hint}</span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/#contact"
              className="group relative overflow-hidden inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[var(--brand-blue)]/25 hover:shadow-lg hover:shadow-[var(--brand-orange)]/30 transition-shadow duration-300 whitespace-nowrap"
            >
              <span className="absolute inset-y-0 left-0 w-1/3 bg-white/30 blur-sm animate-shine" aria-hidden="true" />
              <span className="relative">Book a Demo</span>
              <FaArrowRight size={11} className="relative transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-full hover:bg-black/[0.04]"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span className={`h-0.5 w-5 bg-[var(--foreground)] transition-transform duration-300 ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`h-0.5 w-5 bg-[var(--foreground)] transition-opacity duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`h-0.5 w-5 bg-[var(--foreground)] transition-transform duration-300 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>

          {/* Scroll progress line */}
          <div
            ref={progressRef}
            className="absolute bottom-0 left-6 right-6 h-[2px] origin-left rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)]"
            style={{ transform: "scaleX(0)" }}
            aria-hidden="true"
          />
        </nav>

      </div>

      {/* Mobile menu. Positioned over the page (not in the header's flow):
          while closed it's invisible, and if it took up space it would
          stretch the fixed header down the screen and swallow taps on
          everything underneath it. */}
      <div
        className={`lg:hidden absolute inset-x-3 sm:inset-x-5 top-full mx-auto mt-2 max-w-6xl origin-top rounded-3xl border border-[var(--border)] bg-white/95 backdrop-blur-xl p-4 shadow-xl transition-all duration-300 ${
          menuOpen ? "opacity-100 translate-y-0 scale-100 visible" : "opacity-0 -translate-y-2 scale-95 invisible pointer-events-none"
        }`}
      >
        <ul className="flex flex-col">
          {NAV_LINKS.map((link, i) => (
            <li
              key={link.href}
              className={`transition-all duration-300 ${menuOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3"}`}
              style={{ transitionDelay: menuOpen ? `${80 + i * 40}ms` : "0ms" }}
            >
              <Link
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center justify-between rounded-2xl px-4 py-3 text-base ${
                  isActive(link) ? "bg-gradient-to-r from-[var(--brand-blue)]/10 to-[var(--brand-orange)]/10 font-medium" : "text-[var(--muted)]"
                }`}
              >
                {link.label}
                <FaArrowRight size={11} className="text-[var(--muted)]/60" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="my-3 h-px bg-[var(--border)]" />

        <div className="grid grid-cols-2 gap-2">
          {LOGINS.map(({ label, Icon }) => (
            <a
              key={label}
              href={LMS_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-2 rounded-full border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--foreground)]"
            >
              <Icon size={13} className="text-[var(--brand-blue)]" />
              {label}
            </a>
          ))}
        </div>

        <Link
          href="/#contact"
          onClick={() => setMenuOpen(false)}
          className="mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-5 py-3 text-sm font-semibold text-white"
        >
          Book a Demo <FaArrowRight size={11} />
        </Link>
      </div>
    </div>
    </header>
  );
}
