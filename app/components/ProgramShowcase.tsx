"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { IconType } from "react-icons";
import { FaGuitar, FaMicrophoneAlt, FaChessKnight, FaBullhorn } from "react-icons/fa";
import { GiPianoKeys, GiBallerinaShoes, GiDrum } from "react-icons/gi";

interface ProgramClip {
  program: string;
  tagline: string;
  // Always shown; the same program photos as the Programs section (Courses.tsx).
  photo: string;
  // Optional muted clip in public/videos/ that fades in over the photo.
  // Royalty-free stock footage (Mixkit Stock Video Free License: commercial
  // use allowed, no credit needed). Illustrative only, NOT UniEDD learners --
  // never caption these as students. A missing file just leaves the photo.
  video?: string;
  Icon: IconType;
}

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=70&auto=format&fit=crop`;

const CLIPS: ProgramClip[] = [
  { program: "Guitar", tagline: "Chords, strumming & your first songs", photo: unsplash("1510915361894-db8b60106cb1"), video: "/videos/guitar.mp4", Icon: FaGuitar },
  { program: "Keyboard", tagline: "Scales, technique & sight-reading", photo: "/piano-hero.jpg", video: "/videos/keyboard.mp4", Icon: GiPianoKeys },
  { program: "Vocals", tagline: "Breath, pitch & stage presence", photo: unsplash("1516280440614-37939bbacd81"), video: "/videos/vocals.mp4", Icon: FaMicrophoneAlt },
  { program: "Tabla", tagline: "Taal, rhythm & tabla bols", photo: unsplash("1568219656418-15c329312bf1"), Icon: GiDrum },
  { program: "Dance", tagline: "Rhythm, choreography & expression", photo: unsplash("1547153760-18fc86324498"), video: "/videos/dance.mp4", Icon: GiBallerinaShoes },
  { program: "Public Speaking", tagline: "Clarity, confidence & delivery", photo: unsplash("1475721027785-f74eccf877e2"), video: "/videos/public-speaking.mp4", Icon: FaBullhorn },
  { program: "Chess", tagline: "Openings, tactics & focus", photo: unsplash("1528819622765-d6bcf132f793"), video: "/videos/chess.mp4", Icon: FaChessKnight },
];

function ClipCard({ clip }: { clip: ProgramClip }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  // The source is set here rather than in the JSX so the listeners are
  // attached first -- a missing file can otherwise fail before the page is
  // interactive. "#t=0.1" makes mobile Safari load the first frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip.video) return;
    const onReady = () => setVideoReady(true);
    video.addEventListener("loadeddata", onReady);
    video.src = `${clip.video}#t=0.1`;

    // Play only while the card is on screen (saves data on phones), and not
    // at all for visitors who've asked their device to reduce motion.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !reduceMotion) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.4 }
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.removeEventListener("loadeddata", onReady);
    };
  }, [clip.video]);

  const { Icon } = clip;

  return (
    <div className="group relative aspect-video w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)] overflow-hidden rounded-2xl border border-[var(--border)] shadow-sm hover:shadow-xl transition-shadow duration-300">
      <Image
        src={clip.photo}
        alt=""
        fill
        sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 25vw"
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />
      {clip.video && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-105 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--foreground)]">
        <Icon size={12} className="text-[var(--brand-blue)]" aria-hidden="true" />
        {clip.program}
      </span>

      <p className="absolute bottom-3 left-4 right-4 text-sm font-semibold text-white">{clip.tagline}</p>
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

        <div className="mobile-swipe flex gap-6 sm:flex-wrap sm:justify-center">
          {CLIPS.map((clip) => (
            <ClipCard key={clip.program} clip={clip} />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Illustrative photos and clips. Learner performance videos coming soon.
        </p>
      </div>
    </section>
  );
}
