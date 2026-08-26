import Image from "next/image";
import { FaWhatsapp, FaPhoneAlt } from "react-icons/fa";

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
          </div>

          {/* Links */}
          <div>
            <p className="text-sm font-medium mb-4">Programs</p>
            <ul className="space-y-3">
              <li>
                <a href="#courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Guitar
                </a>
              </li>
              <li>
                <a href="#courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Keyboard
                </a>
              </li>
              <li>
                <a href="#courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Vocals
                </a>
              </li>
              <li>
                <a href="#courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Tabla
                </a>
              </li>
              <li>
                <a href="#courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Dance
                </a>
              </li>
              <li>
                <a href="#courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Public Speaking
                </a>
              </li>
              <li>
                <a href="#courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Chess
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium mb-4">Company</p>
            <ul className="space-y-3">
              <li>
                <a href="#about" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="/pricing" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#courses" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Programs
                </a>
              </li>
              <li>
                <a href="#contact" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Contact
                </a>
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
                <a href="#contact" className="text-sm text-[var(--muted)] hover:text-[var(--brand-blue)] transition-colors">
                  Enquire now
                </a>
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
            <a href="#about" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              About
            </a>
            <a href="#contact" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Contact
            </a>
            <a href="https://lms.uniedd.com" target="_blank" rel="noreferrer" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              LMS Login
            </a>
            <a href="/privacy" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Terms &amp; Conditions
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
