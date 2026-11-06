"use client";

import { useState } from "react";
import { FaGuitar, FaMicrophoneAlt, FaMusic, FaSlidersH } from "react-icons/fa";
import MetronomePanel from "./MetronomePanel";
import TunerPanel from "./TunerPanel";
import BackingPanel from "./BackingPanel";
import VoiceTypePanel from "./VoiceTypePanel";

const TABS = [
  { id: "metronome", label: "Metronome", Icon: FaMusic },
  { id: "tuner", label: "Tuner", Icon: FaGuitar },
  { id: "backing", label: "Backing tracks", Icon: FaSlidersH },
  { id: "voice", label: "Voice type", Icon: FaMicrophoneAlt },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function JamStudio() {
  const [tab, setTab] = useState<TabId>("metronome");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Jam tools"
        className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-2"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition min-w-[8rem] ${
                active
                  ? "bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-orange)] text-white shadow-md"
                  : "bg-white text-[var(--muted)] hover:text-[var(--foreground)] border border-transparent hover:border-[var(--border)]"
              }`}
            >
              <Icon size={14} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-6" role="tabpanel">
        {tab === "metronome" && <MetronomePanel />}
        {tab === "tuner" && <TunerPanel />}
        {tab === "backing" && <BackingPanel />}
        {tab === "voice" && <VoiceTypePanel />}
      </div>
    </div>
  );
}
