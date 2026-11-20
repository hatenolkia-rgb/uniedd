// Pure timing logic for the Jam metronome. No audio here, so it is unit-tested
// (tests/metronome.test.ts). The engine asks this module "what happens on this
// tick?" separately for the CLICK layer and the VOICE layer, so the two never
// depend on each other: muting a beat's click, or turning clicks off entirely,
// does not stop the voice from counting, and vice versa.

export type BeatState = "accent" | "normal" | "mute";
export type Subdivision = 1 | 2 | 3 | 4;
export type ClickKind = "accent" | "beat" | "sub";
export type VoiceWord = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "and" | "e" | "a" | "trip" | "let";

export const VOICE_WORDS: VoiceWord[] = ["1", "2", "3", "4", "5", "6", "7", "and", "e", "a", "trip", "let"];
export const MIN_BPM = 20;
export const MAX_BPM = 300;
/** Below this gap the spoken "and / e / a / trip-let" would run into each other, so only beat numbers are spoken. */
export const MIN_SPOKEN_SUB_GAP = 0.13;

export interface TimelineSettings {
  bpm: number;
  beats: BeatState[]; // one entry per beat in the bar (length = time-signature beats)
  subdivision: Subdivision;
  accent: boolean; // accent on/off (off = accented beats play the normal beat sound)
  voiceSubdivisions: boolean; // speak "and", "e-and-a", "trip-let"
}

export interface Tick {
  time: number; // AudioContext time of this tick
  beat: number; // 0-based beat in the bar
  sub: number; // 0 = on the beat, 1.. = subdivision
}

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 100;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function secondsPerTick(s: Pick<TimelineSettings, "bpm" | "subdivision">): number {
  return 60 / clampBpm(s.bpm) / s.subdivision;
}

/** The click (if any) for this tick. Independent of the voice layer. */
export function clickFor(tick: Tick, s: TimelineSettings): ClickKind | null {
  const state = s.beats[tick.beat] ?? "normal";
  if (state === "mute") return null; // a muted beat silences its click and its subdivisions
  if (tick.sub > 0) return "sub";
  return state === "accent" && s.accent ? "accent" : "beat";
}

const SUB_WORDS: Record<Subdivision, (VoiceWord | null)[]> = {
  1: [null],
  2: [null, "and"],
  3: [null, "trip", "let"],
  4: [null, "e", "and", "a"],
};

/** The spoken word (if any) for this tick. Independent of the click layer and of muted beats. */
export function voiceFor(tick: Tick, s: TimelineSettings): VoiceWord | null {
  if (tick.sub === 0) return String(Math.min(7, tick.beat + 1)) as VoiceWord;
  if (!s.voiceSubdivisions) return null;
  if (secondsPerTick(s) < MIN_SPOKEN_SUB_GAP) return null;
  return SUB_WORDS[s.subdivision][tick.sub] ?? null;
}

/** Advance to the next tick. Tempo / bar length / subdivision changes take effect from the next tick. */
export function nextTick(tick: Tick, s: TimelineSettings): Tick {
  const time = tick.time + secondsPerTick(s);
  let sub = tick.sub + 1;
  let beat = tick.beat;
  if (sub >= s.subdivision) {
    sub = 0;
    beat = beat + 1;
  }
  if (beat >= Math.max(1, s.beats.length)) beat = 0;
  return { time, beat, sub };
}

export interface PlannedEvent {
  tick: Tick;
  click: ClickKind | null;
  voice: VoiceWord | null;
}

/** Everything due before `until`, starting at `from`. Returns the events and the next tick still to schedule. */
export function planWindow(from: Tick, s: TimelineSettings, until: number): { events: PlannedEvent[]; next: Tick } {
  const events: PlannedEvent[] = [];
  let t = from;
  // safety cap so a bad setting can never spin forever
  for (let i = 0; i < 4096 && t.time < until; i++) {
    events.push({ tick: t, click: clickFor(t, s), voice: voiceFor(t, s) });
    t = nextTick(t, s);
  }
  return { events, next: t };
}

/** Tap tempo: average of recent intervals, ignoring taps older than 2.5 s and outliers. */
export function tapTempo(taps: number[]): number | null {
  if (taps.length < 2) return null;
  const iv: number[] = [];
  for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
  const recent = iv.slice(-6).sort((a, b) => a - b);
  const median = recent[Math.floor(recent.length / 2)];
  const good = recent.filter((x) => Math.abs(x - median) < median * 0.25);
  const avg = good.reduce((a, b) => a + b, 0) / good.length;
  return clampBpm(60000 / avg);
}
