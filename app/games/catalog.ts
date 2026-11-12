export type CategoryId = "guitar" | "piano" | "vocals" | "theory" | "rhythm" | "chess" | "other";

export type GameKind =
  | "quiz"
  | "fretboard"
  | "chord-shape"
  | "strum"
  | "tab"
  | "piano-keys"
  | "staff"
  | "piano-chord"
  | "melody"
  | "pitch-match"
  | "interval-sing"
  | "solfege"
  | "sustain"
  | "interval-ear"
  | "chord-quality"
  | "rhythm"
  | "name-note"
  | "scale-builder"
  | "tempo"
  | "circle"
  | "symbols"
  | "clap-trainer"
  | "chess-puzzles"
  | "chess-play";

export type GameDef = {
  slug: string;
  title: string;
  blurb: string;
  category: CategoryId;
  kind: GameKind;
  minutes: string;
  accent: string;
  quizBank?: string;
};

export const CATEGORIES: { id: CategoryId | "all"; label: string; hint: string; emoji: string }[] = [
  { id: "all", label: "All games", hint: "Everything in one colorful arcade", emoji: "🎮" },
  { id: "guitar", label: "Guitar", hint: "Fretboard, chords, tabs and strumming", emoji: "🎸" },
  { id: "piano", label: "Piano", hint: "Keys, staff reading and keyboard chords", emoji: "🎹" },
  { id: "vocals", label: "Vocals", hint: "Pitch, solfege and breath challenges", emoji: "🎤" },
  {
    id: "theory",
    label: "Music Theory & Ear Training",
    hint: "Intervals, rhythms, keys and symbols",
    emoji: "🎼",
  },
  { id: "rhythm", label: "Rhythm", hint: "Clap along to songs — the mic scores every clap", emoji: "👏" },
  { id: "chess", label: "Chess", hint: "Chess puzzles by difficulty and games against the computer", emoji: "♟️" },
  { id: "other", label: "Other", hint: "Art, public speaking, AI and music quizzes", emoji: "🌟" },
];

export const GAMES: GameDef[] = [
  {
    slug: "fretboard-notes",
    title: "Fretboard Note Finder",
    blurb: "A glowing fret lights up — name the note before the timer winks out.",
    category: "guitar",
    kind: "fretboard",
    minutes: "2 min",
    accent: "#e8962e",
  },
  {
    slug: "chord-shapes",
    title: "Chord Shape Quiz",
    blurb: "Look at a chord diagram and pick its name. Open chords first, then spicier ones.",
    category: "guitar",
    kind: "chord-shape",
    minutes: "2 min",
    accent: "#e07a1a",
  },
  {
    slug: "strum-rhythm",
    title: "Strum Rhythm Tap",
    blurb: "Hear a down-up strum pattern and tap it back in time.",
    category: "guitar",
    kind: "strum",
    minutes: "2 min",
    accent: "#d46a12",
  },
  {
    slug: "guitar-parts",
    title: "Guitar Parts Quiz",
    blurb: "Headstock, fretboard, sound hole — how well do you know the instrument?",
    category: "guitar",
    kind: "quiz",
    quizBank: "guitar-parts",
    minutes: "2 min",
    accent: "#c45d10",
  },
  {
    slug: "tab-reading",
    title: "Tab Reading",
    blurb: "Read a short guitar tab and say which string, fret or note it is asking for.",
    category: "guitar",
    kind: "tab",
    minutes: "2 min",
    accent: "#b45309",
  },
  {
    slug: "piano-keys",
    title: "Piano Key Finder",
    blurb: "A key lights up on the keyboard. Name it — whites, then sharps and flats.",
    category: "piano",
    kind: "piano-keys",
    minutes: "2 min",
    accent: "#1a9fd4",
  },
  {
    slug: "staff-reading",
    title: "Staff Note Reader",
    blurb: "Flash cards on a real staff: treble and bass clef note names.",
    category: "piano",
    kind: "staff",
    minutes: "2 min",
    accent: "#1480b0",
  },
  {
    slug: "piano-chords",
    title: "Keyboard Chord Builder",
    blurb: "Build major and minor chords by tapping the right keys.",
    category: "piano",
    kind: "piano-chord",
    minutes: "3 min",
    accent: "#0e6a96",
  },
  {
    slug: "sharps-flats",
    title: "Sharps & Flats",
    blurb: "Which key is F#? What is the flat of B? A quick accidentals workout.",
    category: "piano",
    kind: "quiz",
    quizBank: "sharps-flats",
    minutes: "2 min",
    accent: "#155e89",
  },
  {
    slug: "melody-memory",
    title: "Melody Memory",
    blurb: "Simon-style: listen to a growing tune and replay it on the keys.",
    category: "piano",
    kind: "melody",
    minutes: "3 min",
    accent: "#1d4e89",
  },
  {
    slug: "pitch-match",
    title: "Pitch Match",
    blurb: "Hear a note, then sing it back. The meter shows how close you are.",
    category: "vocals",
    kind: "pitch-match",
    minutes: "3 min",
    accent: "#c026d3",
  },
  {
    slug: "interval-singing",
    title: "Interval Singing",
    blurb: "We play a home note — you sing the interval (a third, a fifth…). ",
    category: "vocals",
    kind: "interval-sing",
    minutes: "3 min",
    accent: "#a21caf",
  },
  {
    slug: "vocal-warmup",
    title: "Vocal Warm-up Quiz",
    blurb: "Breath, posture, sirens and care tips every singer should know.",
    category: "vocals",
    kind: "quiz",
    quizBank: "vocal-warmup",
    minutes: "2 min",
    accent: "#86198f",
  },
  {
    slug: "solfege",
    title: "Solfege Do-Re-Mi",
    blurb: "Hear a scale step and name it: Do, Re, Mi, Fa, Sol, La or Ti.",
    category: "vocals",
    kind: "solfege",
    minutes: "2 min",
    accent: "#701a75",
  },
  {
    slug: "sustain-challenge",
    title: "Breath & Sustain",
    blurb: "Hold a steady sung note (or hum) and see how long you can keep it even.",
    category: "vocals",
    kind: "sustain",
    minutes: "2 min",
    accent: "#581c87",
  },
  {
    slug: "interval-ear",
    title: "Interval Ear Training",
    blurb: "Two notes play — is it a minor third, a fifth, an octave?",
    category: "theory",
    kind: "interval-ear",
    minutes: "3 min",
    accent: "#0d9488",
  },
  {
    slug: "chord-quality",
    title: "Chord Quality",
    blurb: "Listen: major, minor, diminished or augmented? Trust your ear.",
    category: "theory",
    kind: "chord-quality",
    minutes: "2 min",
    accent: "#0f766e",
  },
  {
    slug: "rhythm-tap",
    title: "Rhythm Tap",
    blurb: "Tap along with the beat and nail the timing for a high accuracy score.",
    category: "theory",
    kind: "rhythm",
    minutes: "2 min",
    accent: "#115e59",
  },
  {
    slug: "name-that-note",
    title: "Name That Note",
    blurb: "A single pitch plays. Pick its letter name — perfect-pitch practice.",
    category: "theory",
    kind: "name-note",
    minutes: "2 min",
    accent: "#134e4a",
  },
  {
    slug: "key-signatures",
    title: "Key Signature Quiz",
    blurb: "How many sharps in D major? Which minor key has three flats?",
    category: "theory",
    kind: "quiz",
    quizBank: "key-signatures",
    minutes: "2 min",
    accent: "#042f2e",
  },
  {
    slug: "scale-builder",
    title: "Scale Builder",
    blurb: "Tap notes into place to build major, minor, modal, pentatonic and blues scales.",
    category: "theory",
    kind: "scale-builder",
    minutes: "3 min",
    accent: "#14b8a6",
  },
  {
    slug: "tempo-guess",
    title: "Tempo Guess",
    blurb: "Listen to a click track and guess the BPM as closely as you can.",
    category: "theory",
    kind: "tempo",
    minutes: "2 min",
    accent: "#2dd4bf",
  },
  {
    slug: "circle-of-fifths",
    title: "Circle of Fifths",
    blurb: "Spin around the circle: what key sits a fifth above this one?",
    category: "theory",
    kind: "circle",
    minutes: "2 min",
    accent: "#5eead4",
  },
  {
    slug: "symbols-match",
    title: "Music Symbols Match",
    blurb: "Memory cards with clefs, rests, sharps and more. Find every pair.",
    category: "theory",
    kind: "symbols",
    minutes: "2 min",
    accent: "#99f6e4",
  },
  {
    slug: "clap-rhythm",
    title: "Clap Rhythm",
    blurb: "Clap markers slide down a glowing stage in time with the song. Clap on the ring — the mic scores every clap Perfect, Good or Miss.",
    category: "rhythm",
    kind: "clap-trainer",
    minutes: "3 min",
    accent: "#7c3aed",
  },
  {
    slug: "chess-puzzles",
    title: "Chess Puzzles",
    blurb: "400,000 chess puzzles in five difficulty levels — mate in 1, 2 and 3, forks, pins and endgames. Rated mode, daily puzzle and a 3-minute Puzzle Rush.",
    category: "chess",
    kind: "chess-puzzles",
    minutes: "1–3 min",
    accent: "#2563eb",
  },
  {
    slug: "chess",
    title: "Play Chess vs Computer",
    blurb: "Play a full game of chess against the computer, from a friendly Beginner to a tough Expert level.",
    category: "chess",
    kind: "chess-play",
    minutes: "10+ min",
    accent: "#475569",
  },
  {
    slug: "music-quiz",
    title: "Music Super Quiz",
    blurb: "Timed questions about songs, instruments and famous firsts — streak bonuses!",
    category: "other",
    kind: "quiz",
    quizBank: "music",
    minutes: "3 min",
    accent: "#f59e0b",
  },
  {
    slug: "art-quiz",
    title: "Art Color Quiz",
    blurb: "Primary colors, warm vs cool, and composition — a splashy art warmup.",
    category: "other",
    kind: "quiz",
    quizBank: "art",
    minutes: "2 min",
    accent: "#f97316",
  },
  {
    slug: "speaking-quiz",
    title: "Public Speaking Quiz",
    blurb: "Eye contact, pace, posture and filler words — speak with confidence.",
    category: "other",
    kind: "quiz",
    quizBank: "speaking",
    minutes: "2 min",
    accent: "#ef4444",
  },
  {
    slug: "ai-quiz",
    title: "AI Basics Quiz",
    blurb: "What AI is (and isn’t), prompts, and staying kind and truthful with tools.",
    category: "other",
    kind: "quiz",
    quizBank: "ai",
    minutes: "2 min",
    accent: "#8b5cf6",
  },
];

export const SCORE_CAP = 5000;
export const MIN_DURATION_MS = 8000;

export function getGame(slug: string) {
  return GAMES.find((game) => game.slug === slug);
}

export function gamesByCategory(id: CategoryId | "all") {
  return id === "all" ? GAMES : GAMES.filter((game) => game.category === id);
}
