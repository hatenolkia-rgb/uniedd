"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// A program's photo, with its muted stock clip (if any) fading in over it
// once loaded. A missing or failed clip just leaves the photo showing.
export default function ProgramMedia({
  photo,
  alt,
  video,
  sizes,
  priority = false,
}: {
  photo: string;
  alt: string;
  video?: string;
  sizes: string;
  priority?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  // The source is set here rather than in the JSX so the listener is attached
  // first -- otherwise the clip can load before the page is interactive and
  // never fade in. "#t=0.1" makes mobile Safari load the first frame.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    const onReady = () => setVideoReady(true);
    el.addEventListener("loadeddata", onReady);
    el.src = `${video}#t=0.1`;

    // Play only while on screen (saves data on phones), and not at all for
    // visitors who've asked their device to reduce motion.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !reduceMotion) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.removeEventListener("loadeddata", onReady);
    };
  }, [video]);

  return (
    <>
      <Image
        src={photo}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />
      {video && (
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
    </>
  );
}
