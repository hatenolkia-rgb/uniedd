import type { Testimonial } from "../lib/testimonials";

function Stars() {
  return (
    <div className="flex gap-0.5" aria-label="5 out of 5 stars">
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="var(--brand-orange)" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewCard({ testimonial, className = "w-[300px] sm:w-[360px] shrink-0" }: { testimonial: Testimonial; className?: string }) {
  return (
    <figure className={`${className} p-7 rounded-2xl bg-white border border-[var(--border)] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}>
      <div className="flex items-center justify-between gap-3">
        <Stars />
        {testimonial.sample && (
          <span className="rounded-full bg-[var(--brand-orange)]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-orange)]">
            Sample
          </span>
        )}
      </div>
      <blockquote className="mt-4 text-[var(--muted)] text-sm leading-relaxed">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-orange)] flex items-center justify-center text-sm font-semibold text-white">
          {testimonial.initials}
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">{testimonial.name}</p>
          <p className="text-xs text-[var(--muted)]">{testimonial.role}</p>
        </div>
      </figcaption>
    </figure>
  );
}
