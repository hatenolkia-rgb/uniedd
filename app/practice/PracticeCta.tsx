"use client";

import { useEffect, useState } from "react";
import { FaArrowRight } from "react-icons/fa";

const PRACTICE_LOGIN = "https://practice.uniedd.com/login";
const CHECK_TIMEOUT_MS = 6000;

type Status = "checking" | "online" | "offline";

async function isPracticeReachable() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    // no-cors is enough to learn whether the host answers; opaque responses
    // still resolve when the request completes.
    await fetch(PRACTICE_LOGIN, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export default function PracticeCta({ tone = "light" }: { tone?: "light" | "onColor" }) {
  const [status, setStatus] = useState<Status>("checking");
  const onColor = tone === "onColor";

  useEffect(() => {
    let cancelled = false;
    isPracticeReachable().then((ok) => {
      if (!cancelled) setStatus(ok ? "online" : "offline");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return (
      <p className={`mt-8 text-sm ${onColor ? "text-white/85" : "text-[var(--muted)]"}`} role="status">
        Checking if Practice Live is ready…
      </p>
    );
  }

  if (status === "offline") {
    return (
      <div
        className={`mt-8 max-w-xl rounded-2xl border p-6 shadow-sm ${
          onColor ? "border-white/30 bg-white/15" : "border-[var(--border)] bg-white"
        }`}
        role="status"
      >
        <p className={`text-lg font-semibold ${onColor ? "text-white" : "text-[var(--foreground)]"}`}>
          We are upgrading — be back soon
        </p>
        <p className={`mt-2 text-sm leading-relaxed ${onColor ? "text-white/85" : "text-[var(--muted)]"}`}>
          Practice Live is taking a short break. Please try again in a little while.
        </p>
      </div>
    );
  }

  if (onColor) {
    return (
      <a
        href={PRACTICE_LOGIN}
        target="_blank"
        rel="noreferrer"
        className="group mt-8 inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-base font-semibold text-[var(--foreground)] hover:-translate-y-px transition-transform"
      >
        Start practicing for free
        <FaArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
      </a>
    );
  }

  return (
    <a
      href={PRACTICE_LOGIN}
      target="_blank"
      rel="noreferrer"
      className="group relative mt-8 inline-flex items-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[var(--brand-blue)]/25 hover:shadow-xl hover:shadow-[var(--brand-orange)]/30 transition-shadow"
    >
      <span className="absolute inset-y-0 left-0 w-1/3 bg-white/30 blur-sm animate-shine" aria-hidden="true" />
      <span className="relative">Start practicing for free</span>
      <FaArrowRight size={14} className="relative transition-transform duration-300 group-hover:translate-x-0.5" />
    </a>
  );
}
