import Link from "next/link";
import Image from "next/image";
import type { IconType } from "react-icons";
import { FaWhatsapp, FaPhoneAlt, FaYoutube, FaFacebookF, FaInstagram, FaLinkedinIn, FaMedium } from "react-icons/fa";
import { PROGRAMS, programPath } from "../lib/programs";
import { SOCIAL_LINKS } from "../lib/site";

// Brand colour each icon turns on hover
const SOCIAL_STYLE: Record<(typeof SOCIAL_LINKS)[number]["name"], { Icon: IconType; hover: string }> = {
  YouTube: { Icon: FaYoutube, hover: "hover:bg-[#FF0000]" },
  Facebook: { Icon: FaFacebookF, hover: "hover:bg-[#1877F2]" },
  Instagram: { Icon: FaInstagram, hover: "hover:bg-gradient-to-br hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF]" },
  LinkedIn: { Icon: FaLinkedinIn, hover: "hover:bg-[#0A66C2]" },
  Medium: { Icon: FaMedium, hover: "hover:bg-black" },
};

export default function Footer() {
  return (
    <footer className="relative pt-16 pb-10 px-6 bg-white overflow-hidden">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)]" />
      <div className="absolute top-0 left-0 right-0 border-t border-[var(--border)]" />

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Image src="/logo.png" className="w-32 h-12 object-contain" alt="UniEDD logo" width={2332} height={908} />

            <p className="mt-4 text-sm text-[var(--muted)] leading-relaxed">
              UniEDD is a New Delhi-based academy offering personalised online music, dance, public speaking, and chess coaching to kids and adults.
            </p>

            <p className="mt-6 mb-3 text-sm font-medium">Follow us</p>
            <ul className="flex flex-wrap gap-2.5">
              {SOCIAL_LINKS.map(({ name, url }) => {
                const { Icon, hover } = SOCIAL_STYLE[name];
                return (
                  <li key={name}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`UniEDD on ${name}`}
                      title={name}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] hover:border-transparent hover:text-white hover:-translate-y-0.5 transition-all duration-300 ${hover}`}
                    >
                      <Icon size={15} aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Links */}
          <div>
            <p className="text-sm font-medium mb-4">Programs</p>
            <ul className="space-y-3">
              {PROGRAMS.map((program) => (
                <li key={program.slug}>
                  <Link href={programPath(program)} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                    {program.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium mb-4">Company</p>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  About us
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/programs" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  All programs
                </Link>
              </li>
              <li>
                <Link href="/reviews" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Reviews
                </Link>
              </li>
              <li>
                <Link href="/#contact" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium mb-4">Connect</p>
            <ul className="space-y-3">
              <li>
                <a href="https://wa.me/918383857710" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--brand-blue)] transition-colors">
                  <FaWhatsapp size={14} /> WhatsApp
                </a>
              </li>
              <li>
                <a href="tel:+918383857710" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--brand-blue)] transition-colors">
                  <FaPhoneAlt size={12} /> Call us
                </a>
              </li>
              <li>
                <Link href="/#contact" className="text-sm text-[var(--muted)] hover:text-[var(--brand-blue)] transition-colors">
                  Enquire now
                </Link>
              </li>
              <li>
                <a href="https://wa.me/918383857710" target="_blank" rel="noreferrer" className="text-sm text-[var(--muted)] hover:text-[var(--brand-blue)] transition-colors">
                  Book a demo
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--muted)]">
            © 2026 UniEDD. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/about" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              About
            </Link>
            <Link href="/#contact" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Contact
            </Link>
            <a href="https://lms.uniedd.com" target="_blank" rel="noreferrer" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              LMS Login
            </a>
            <Link href="/privacy" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
