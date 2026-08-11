import Image from "next/image";

export default function Footer() {
  return (
    <footer className="py-16 px-6 border-t border-[var(--border)] bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Image src="/logo.png" className="w-32 h-12" alt="logo" width={1000} height={1000} />

            <p className="mt-4 text-sm text-[var(--muted)] leading-relaxed">
              UniEDD is a New Delhi-based academy offering personalised music, dance, and public speaking coaching to kids and adults.
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
                <a href="#pricing" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
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
                <a href="https://wa.me/918383857710" target="_blank" rel="noreferrer" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  WhatsApp
                </a>
              </li>
              <li>
                <a href="tel:+918383857710" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Call us
                </a>
              </li>
              <li>
                <a href="#contact" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  Enquire now
                </a>
              </li>
              <li>
                <a href="https://wa.me/918383857710" target="_blank" rel="noreferrer" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
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
          </div>
        </div>
      </div>
    </footer>
  );
}
