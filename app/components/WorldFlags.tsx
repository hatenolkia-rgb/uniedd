import Image from "next/image";
import { COUNTRIES } from "../lib/countryCodes";

// Three rows of flags drifting in alternating directions. Classes are online
// and open worldwide, so this says "available in", not "students in" --
// keep the wording that way unless there are learners in every country.
const ROWS = [0, 1, 2].map((row) => COUNTRIES.filter((_, i) => i % 3 === row));

function FlagRow({ countries, reverse, duration }: { countries: typeof COUNTRIES; reverse?: boolean; duration: number }) {
  return (
    <div className="marquee-row marquee-mask overflow-hidden py-2">
      <div
        className={`flex w-max gap-3 ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        {/* The track is the row twice; the copy is only there for the loop. */}
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex gap-3 pr-3" aria-hidden={copy === 1 || undefined}>
            {countries.map(({ iso, name }) => (
              <li
                key={iso}
                className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-white py-1.5 pl-1.5 pr-4 text-sm text-[var(--foreground)] shadow-sm"
              >
                <Image
                  src={`https://flagcdn.com/w80/${iso}.png`}
                  alt=""
                  width={28}
                  height={20}
                  unoptimized
                  loading="lazy"
                  className="h-5 w-7 rounded-[3px] object-cover"
                />
                {name}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export default function WorldFlags() {
  return (
    <section aria-labelledby="worldwide-heading" className="py-24 bg-gradient-to-b from-white via-[#f4f9fd] to-white overflow-hidden">
      <div className="mx-auto max-w-3xl px-6 text-center mb-12">
        <p className="text-sm tracking-widest uppercase text-[var(--muted)] mb-4">Worldwide</p>
        <h2
          id="worldwide-heading"
          className="text-4xl sm:text-5xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-playfair), serif" }}
        >
          Learn live from <span className="italic text-[var(--brand-blue)]">anywhere</span>
        </h2>
        <p className="mt-4 text-[var(--muted)]">
          Our online classes are open to learners in {Math.floor(COUNTRIES.length / 100) * 100}+ countries, scheduled in your own time zone.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {ROWS.map((countries, i) => (
          <FlagRow key={i} countries={countries} reverse={i % 2 === 1} duration={countries.length * 2.2} />
        ))}
      </div>
    </section>
  );
}
