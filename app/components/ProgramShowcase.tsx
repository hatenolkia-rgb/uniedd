"use client";

import { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { FaGuitar, FaMicrophoneAlt, FaChessKnight, FaBullhorn } from "react-icons/fa";
import { GiPianoKeys, GiBallerinaShoes } from "react-icons/gi";

interface ProgramClip {
  program: string;
  tagline: string;
  // File in public/videos/. Royalty-free stock footage (Mixkit Stock Video
  // Free License: commercial use allowed, no credit needed). These are
  // illustrative clips, NOT UniEDD learners -- never caption them as students.
  src: string;
  Icon: IconType;
}

const CLIPS: ProgramClip[] = [
  { program: "Guitar", tagline: "Chords, strumming & your first songs", src: "/videos/guitar.mp4", Icon: FaGuitar },
  { program: "Keyboard", tagline: "Scales, technique & sight-reading", src: "/videos/keyboard.mp4", Icon: GiPianoKeys },
  { program: "Vocals", tagline: "Breath, pitch & stage presence", src: "/videos/vocals.mp4", Icon: FaMicrophoneAlt },
  { program: "Dance", tagline: "Rhythm, choreography & expression", src: "/videos/dance.mp4", Icon: GiBallerinaShoes },
  { program: "Public Speaking", tagline: "Clarity, confidence & delivery", src: "/videos/public-speaking.mp4", Icon: FaBullhorn },
  { program: "Chess", tagline: "Openings, tactics & focus", src: "/videos/chess.mp4", Icon: FaChessKnight },
];

function ClipCard({ clip }: { clip: ProgramClip }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  // The source is set here rather than in the JSX so the error listener is
  // attached first -- otherwise a missing file can fail before the page is
  // interactive and the fallback never shows. "#t=0.1" makes mobile Safari
  // show the first frame before playing.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed) return;
    const onError = () => setFailed(true);
    video.addEventListener("error", onError);
    video.src = `${clip.src}#t=0.1`;

    // Play only while the card is on screen (saves data on phones), and not
    // at all for visitors who've asked their device to reduce motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return () => video.removeEventListener("error", onError);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.4 }
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.removeEventListener("error", onError);
    };
  }, [clip.src, failed]);

  const { Icon } = clip;

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border)] shadow-sm hover:shadow-xl transition-shadow duration-300">
      {failed ? (
        // Clip file not added yet -- branded fallback instead of a broken player
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-blue)]/15 via-white to-[var(--brand-orange)]/15">
          <Icon className="absolute -right-4 -bottom-4 text-[var(--brand-blue)]/10" size={150} aria-hidden="true" />
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        </>
      )}

      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--foreground)]">
        <Icon size={12} className="text-[var(--brand-blue)]" aria-hidden="true" />
        {clip.program}
      </span>

      <p
        className={`absolute bottom-3 left-4 right-4 text-sm font-semibold ${
          failed ? "text-[var(--foreground)]" : "text-white"
        }`}
      >
        {clip.tagline}
      </p>
    </div>
  );
}

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

        <div className="mobile-swipe grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CLIPS.map((clip) => (
            <ClipCard key={clip.program} clip={clip} />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Illustrative clips. Learner performance videos coming soon.
        </p>
      </div>
    </section>
  );
}
