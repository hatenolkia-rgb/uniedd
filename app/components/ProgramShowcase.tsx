import Link from "next/link";
import { PROGRAMS, programPath } from "../lib/programs";
import { PROGRAM_ICONS } from "../lib/programIcons";
import ProgramMedia from "./ProgramMedia";

// Photos and muted clips are illustrative (Unsplash / Mixkit Free License),
// NOT UniEDD learners -- never caption them as students.
export default function ProgramShowcase() {
  return (
    <section id="showcase" className="py-28 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm tracking-widest uppercase text-[var(--muted)] mb-4">Showcase</p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            A glimpse of every <span className="italic text-[var(--brand-orange)]">program</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--muted)]">
            The skills you&rsquo;ll build, one live 1:1 class at a time.
          </p>
        </div>

        <div className="mobile-swipe flex gap-6 sm:flex-wrap sm:justify-center">
          {PROGRAMS.map((program) => {
            const Icon = PROGRAM_ICONS[program.name];
            return (
              <Link
                key={program.slug}
                href={programPath(program)}
                aria-label={`${program.name}: ${program.showcaseLine}`}
                className="group relative block aspect-video w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)] overflow-hidden rounded-2xl border border-[var(--border)] shadow-sm hover:shadow-xl transition-shadow duration-300"
              >
                <ProgramMedia
                  photo={program.image}
                  alt=""
                  video={program.video}
                  sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                  <Icon size={12} className="text-[var(--brand-blue)]" aria-hidden="true" />
                  {program.name}
                </span>

                <p className="absolute bottom-3 left-4 right-4 text-sm font-semibold text-white">
                  {program.showcaseLine}
                </p>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Illustrative photos and clips. Learner performance videos coming soon.
        </p>
      </div>
    </section>
  );
}
