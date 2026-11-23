export type CategoryId = "adventure" | "karaoke" | "tanpura" | "guitar" | "piano" | "vocals" | "theory" | "rhythm" | "chess" | "other";

export type GameLevel = "beginner" | "intermediate" | "advanced";

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
  | "piano-fall"
  | "lumenfall"
  | "pick-coach"
  | "karaoke-maker"
  | "tanpura-tabla"
  | "chess-puzzles"
  | "chess-play"
  | "chess-online";

export type GameDef = {
  slug: string;
  title: string;
  blurb: string;
  category: CategoryId;
  kind: GameKind;
  minutes: string;
  accent: string;
  /** Shown as a badge and used for the Beginner games section. */
  level?: GameLevel;
  quizBank?: string;
  /** Separate leaderboards inside one game (e.g. the piano game's clef modes). */
  boards?: { id: string; label: string }[];
  /** Optional per-game ceiling used by validateScore (defaults to SCORE_CAP). */
  scoreCap?: number;
};

export const CATEGORIES: { id: CategoryId | "all"; label: string; hint: string; emoji: string }[] = [
  { id: "all", label: "All games", hint: "Everything in one colorful arcade", emoji: "🎮" },
  {
    id: "adventure",
    label: "Adventure",
    hint: "Beginner-friendly story adventures you can play in the browser",
    emoji: "🌲",
  },
  {
    id: "karaoke",
    label: "Karaoke Maker",
    hint: "Upload any song, remove the vocals and change the key — all on your device",
    emoji: "🎤",
  },
  {
    id: "tanpura",
    label: "Tanpura & Tabla",
    hint: "An electronic tanpura in any key with tabla in 11 taals — for singing and riyaz",
    emoji: "🪕",
  },
  { id: "guitar", label: "Guitar", hint: "Picking and strumming coach, fretboard, chords and tabs", emoji: "🎸" },
  { id: "piano", label: "Piano", hint: "Falling-notes songs, keys, staff reading and chords", emoji: "🎹" },
  { id: "vocals", label: "Vocals", hint: "Pitch, solfege and breath challenges", emoji: "🎤" },
  {
    id: "theory",
    label: "Music Theory & Ear Training",
    hint: "Intervals, rhythms, keys and symbols",
    emoji: "🎼",
  },
  { id: "rhythm", label: "Rhythm", hint: "Clap along to songs — the mic scores every clap", emoji: "👏" },
  { id: "chess", label: "Chess", hint: "Chess puzzles by difficulty, games against the computer and live games online", emoji: "♟️" },
  { id: "other", label: "Other", hint: "Art, public speaking, AI and music quizzes", emoji: "🌟" },
];

export const GAMES: GameDef[] = [
  {
    slug: "lumenfall",
    title: "Lumenfall: Notes of the Spirit Forest",
    blurb: "Tetris-style note blocks fall through a glowing spirit forest. Play them on a piano, guitar or MIDI keyboard, or sing them — the microphone hears every note. Nine story levels with public-domain and original tunes, plus a Sargam track for Indian classical practice.",
    category: "adventure",
    kind: "lumenfall",
    level: "beginner",
    minutes: "2–5 min",
    accent: "#0ea5e9",
    scoreCap: 300000,
    boards: [
      { id: "1-guitar", label: "Level 1 · Guitar" },
      { id: "1-piano", label: "Level 1 · Piano" },
      { id: "1-vocal", label: "Level 1 · Vocal" },
      { id: "1-sargam", label: "Level 1 · Sargam" },
      { id: "2-guitar", label: "Level 2 · Guitar" },
      { id: "2-piano", label: "Level 2 · Piano" },
      { id: "2-vocal", label: "Level 2 · Vocal" },
      { id: "2-sargam", label: "Level 2 · Sargam" },
      { id: "3-guitar", label: "Level 3 · Guitar" },
      { id: "3-piano", label: "Level 3 · Piano" },
      { id: "3-vocal", label: "Level 3 · Vocal" },
      { id: "3-sargam", label: "Level 3 · Sargam" },
      { id: "4-guitar", label: "Level 4 · Guitar" },
      { id: "4-piano", label: "Level 4 · Piano" },
      { id: "4-vocal", label: "Level 4 · Vocal" },
      { id: "4-sargam", label: "Level 4 · Sargam" },
      { id: "5-guitar", label: "Level 5 · Guitar" },
      { id: "5-piano", label: "Level 5 · Piano" },
      { id: "5-vocal", label: "Level 5 · Vocal" },
      { id: "5-sargam", label: "Level 5 · Sargam" },
      { id: "6-guitar", label: "Level 6 · Guitar" },
      { id: "6-piano", label: "Level 6 · Piano" },
      { id: "6-vocal", label: "Level 6 · Vocal" },
      { id: "6-sargam", label: "Level 6 · Sargam" },
      { id: "7-guitar", label: "Level 7 · Guitar" },
      { id: "7-piano", label: "Level 7 · Piano" },
      { id: "7-vocal", label: "Level 7 · Vocal" },
      { id: "7-sargam", label: "Level 7 · Sargam" },
      { id: "8-guitar", label: "Level 8 · Guitar" },
      { id: "8-piano", label: "Level 8 · Piano" },
      { id: "8-vocal", label: "Level 8 · Vocal" },
      { id: "8-sargam", label: "Level 8 · Sargam" },
      { id: "9-guitar", label: "Level 9 · Guitar" },
      { id: "9-piano", label: "Level 9 · Piano" },
      { id: "9-vocal", label: "Level 9 · Vocal" },
      { id: "9-sargam", label: "Level 9 · Sargam" },
    ],
  },
  {
    slug: "karaoke-maker",
    title: "Karaoke Maker",
    blurb: "Upload any song, remove the singer's voice and move it up or down by half steps or whole steps to suit your voice — the speed stays the same. Preview original vs karaoke and download an MP3 or WAV. Your song stays on your device.",
    category: "karaoke",
    kind: "karaoke-maker",
    minutes: "Any song",
    accent: "#7c5cff",
  },
  {
    slug: "tanpura-tabla",
    title: "Tanpura & Tabla",
    blurb: "A tanpura drone in any key (Pa, Ma, Ni or Sa tuning, male or female, 4–6 strings) with tabla in Teentaal, Keherwa, Dadra, Rupak, Jhaptaal, Ektaal and more — any tempo from 30 to 300 BPM, sam and khali shown on every matra. Perfect for singing and instrument riyaz.",
    category: "tanpura",
    kind: "tanpura-tabla",
    minutes: "Riyaz",
    accent: "#c026d3",
  },
  {
    slug: "alternate-picking",
    title: "Alternate Picking & Strumming Coach",
    blurb: "Picky the guitar pick calls out a chord or a down-up picking pattern — play it at your own pace (no metronome) and the microphone listens and recognises your chord. Beginner, Expert and Pro, open chords to barre chords; tap mode if you have no mic.",
    category: "guitar",
    kind: "pick-coach",
    minutes: "3–5 min",
    accent: "#8b5cf6",
    boards: [
      { id: "picking", label: "Alternate Picking" },
      { id: "chords", label: "Chords" },
    ],
  },
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
    slug: "piano-falling-notes",
    title: "Piano Falling Notes",
    blurb: "Notes fall onto a piano keyboard — play each key as it reaches the line. Treble Clef, Bass Clef or Beast Mode (both hands), on a MIDI keyboard or a real piano through the mic. 16 songs, Beginner to Advanced.",
    category: "piano",
    kind: "piano-fall",
    minutes: "1–3 min",
    accent: "#0ea5e9",
    boards: [
      { id: "treble", label: "Treble Clef" },
      { id: "bass", label: "Bass Clef" },
      { id: "beast", label: "Beast Mode" },
    ],
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
    slug: "chess-online",
    title: "Play Chess Online",
    blurb: "Play a live game of chess against another player. Enter a name, join the waiting room and get matched with the next player — no sign-up.",
    category: "chess",
    kind: "chess-online",
    minutes: "10+ min",
    accent: "#0f766e",
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

/** Storage key for a game's leaderboard (`slug` or `slug:board`); null if the board is unknown. */
export function boardKey(slug: string, board?: string | null) {
  const game = getGame(slug);
  if (!game) return null;
  if (!board) return game.boards?.length ? null : game.slug;
  return game.boards?.some((b) => b.id === board) ? `${game.slug}:${board}` : null;
}

export function gamesByCategory(id: CategoryId | "all") {
  return id === "all" ? GAMES : GAMES.filter((game) => game.category === id);
}

export const LEVEL_LABEL: Record<GameLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const TOPIC_CATEGORIES = CATEGORIES.filter((c): c is typeof c & { id: CategoryId } => c.id !== "all");

export function categoryPath(id: CategoryId) {
  return `/games/category/${id}`;
}

export function gamesByLevel(level: GameLevel) {
  return GAMES.filter((game) => game.level === level);
}

/** Same-category games first, then other music or skill games, skipping the current one. */
export function relatedGames(game: GameDef, limit = 6) {
  const seen = new Set<string>([game.slug]);
  const out: GameDef[] = [];
  const take = (list: GameDef[]) => {
    for (const item of list) {
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      out.push(item);
      if (out.length >= limit) return;
    }
  };
  take(GAMES.filter((item) => item.category === game.category));
  const kindFamily: Record<string, string[]> = {
    lumenfall: ["piano-fall", "clap-trainer", "pick-coach", "piano-keys", "staff"],
    "piano-fall": ["lumenfall", "piano-keys", "staff", "piano-chord", "clap-trainer"],
    "clap-trainer": ["lumenfall", "piano-fall", "rhythm", "tempo"],
  };
  const cousins = kindFamily[game.kind];
  if (cousins) take(GAMES.filter((item) => cousins.includes(item.kind)));
  take(GAMES);
  return out;
}
