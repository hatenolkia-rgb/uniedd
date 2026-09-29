"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { IconType } from "react-icons";
import { FaGuitar, FaMicrophoneAlt, FaChessKnight, FaBullhorn, FaPlay, FaTimes } from "react-icons/fa";
import { GiPianoKeys, GiDrum, GiBallerinaShoes } from "react-icons/gi";

type Program = "Guitar" | "Keyboard" | "Vocals" | "Tabla" | "Dance" | "Public Speaking" | "Chess";

interface LearnerVideo {
  title: string;
  program: Program;
  // The part after "v=" in a YouTube link, e.g. "dQw4w9WgXcQ" from
  // https://www.youtube.com/watch?v=dQw4w9WgXcQ (Shorts: after "/shorts/").
  // Leave it out and the card shows as "Video coming soon".
  youtubeId?: string;
}

// Real learner performances only. Upload them to YouTube (Unlisted is fine),
// then paste each video's ID here.
const LEARNER_VIDEOS: LearnerVideo[] = [
  { title: "First song on guitar", program: "Guitar" },
  { title: "Keyboard recital", program: "Keyboard" },
  { title: "Vocal performance", program: "Vocals" },
  { title: "Tabla solo", program: "Tabla" },
  { title: "Dance showcase", program: "Dance" },
  { title: "Speech at school", program: "Public Speaking" },
];

const PROGRAM_ICONS: Record<Program, IconType> = {
  Guitar: FaGuitar,
  Keyboard: GiPianoKeys,
  Vocals: FaMicrophoneAlt,
  Tabla: GiDrum,
  Dance: GiBallerinaShoes,
  "Public Speaking": FaBullhorn,
  Chess: FaChessKnight,
};

function VideoCard({ video, onPlay }: { video: LearnerVideo; onPlay: () => void }) {
  const Icon = PROGRAM_ICONS[video.program];
  const ready = Boolean(video.youtubeId);

  const inner = (
    <>
      {ready ? (
        <Image
          src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
          alt=""
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-blue)]/15 via-white to-[var(--brand-orange)]/15">
          <Icon className="absolute -right-4 -bottom-4 text-[var(--brand-blue)]/10" size={150} aria-hidden="true" />
        </div>
      )}

      {/* Darken the bottom of real thumbnails so the white title stays readable */}
      {ready && <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />}

      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform duration-300 ${
            ready ? "bg-white text-[var(--brand-blue)] group-hover:scale-110" : "bg-white/70 text-[var(--muted)]"
          }`}
        >
          <FaPlay className="ml-1" size={18} aria-hidden="true" />
        </span>
      </div>

      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--foreground)]">
        <Icon size={12} className="text-[var(--brand-blue)]" aria-hidden="true" />
        {video.program}
      </span>
      {!ready && (
        <span className="absolute top-3 right-3 rounded-full bg-[var(--brand-orange)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          Coming soon
        </span>
      )}

      <p
        className={`absolute bottom-3 left-4 right-4 text-left text-sm font-semibold ${
          ready ? "text-white" : "text-[var(--foreground)]"
        }`}
      >
        {video.title}
      </p>
    </>
  );

  const className = "group relative block aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border)] shadow-sm";

  return ready ? (
    <button type="button" onClick={onPlay} className={`${className} hover:shadow-xl transition-shadow duration-300`} aria-label={`Play video: ${video.title}`}>
      {inner}
    </button>
  ) : (
    <div className={className}>{inner}</div>
  );
}

export default function MeetOurLearners() {
  const [playing, setPlaying] = useState<LearnerVideo | null>(null);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlaying(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  return (
    <section id="learners" className="py-28 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm tracking-widest uppercase text-[var(--muted)] mb-4">Showcase</p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Meet our <span className="italic text-[var(--brand-orange)]">learners</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--muted)]">
            Real performances and milestones from UniEDD students.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LEARNER_VIDEOS.map((video) => (
            <VideoCard key={`${video.program}-${video.title}`} video={video} onPlay={() => setPlaying(video)} />
          ))}
        </div>
      </div>

      {playing?.youtubeId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={playing.title}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPlaying(null)}
        >
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPlaying(null)}
              aria-label="Close video"
              className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <FaTimes size={16} />
            </button>
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${playing.youtubeId}?autoplay=1&rel=0`}
                title={playing.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
