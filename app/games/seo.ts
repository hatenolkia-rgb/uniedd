// Search-friendly titles, descriptions and on-page text for the music games.
// Keep every sentence true to what the game actually does.
import { CATEGORIES, type CategoryId, type GameDef } from "./catalog";

const GENERIC_HOWTO = [
  "Press Start to begin a round.",
  "Answer or play each challenge — quick, correct answers build your score.",
  "When the round ends, see your score and, if you like, post it to the leaderboard with a nickname (no email needed).",
];

type CategorySeo = {
  /** Phrase used in titles, e.g. "Guitar game". */
  noun: string;
  genre: string[];
  intro: string;
  howTo: string[];
  goodFor: string;
};

export const CATEGORY_SEO: Record<CategoryId, CategorySeo> = {
  guitar: {
    noun: "Guitar Game",
    genre: ["Educational", "Music", "Quiz"],
    intro:
      "A free online guitar practice game from UniEDD. It runs in your web browser on a phone, tablet or computer, with nothing to download.",
    howTo: GENERIC_HOWTO,
    goodFor: "Beginner and intermediate guitar students who want quick fretboard, chord, tab and strumming practice.",
  },
  piano: {
    noun: "Piano Game",
    genre: ["Educational", "Music", "Quiz"],
    intro:
      "A free online piano and keyboard practice game from UniEDD. It runs in your web browser on a phone, tablet or computer, with nothing to download.",
    howTo: GENERIC_HOWTO,
    goodFor: "Piano and keyboard learners practising key names, staff reading and chords.",
  },
  vocals: {
    noun: "Singing Game",
    genre: ["Educational", "Music"],
    intro:
      "A free online singing and ear practice game from UniEDD. It runs in your web browser, with nothing to download.",
    howTo: [
      "Press Start and follow the prompt for each round.",
      "Some rounds listen through your microphone when you allow it in the browser.",
      "When the round ends, see your score and, if you like, post it to the leaderboard with a nickname (no email needed).",
    ],
    goodFor: "Young singers and vocal students working on pitch, solfege and breath control.",
  },
  theory: {
    noun: "Music Theory Game",
    genre: ["Educational", "Music", "Quiz"],
    intro:
      "A free online music theory and ear training game from UniEDD. It runs in your web browser on a phone, tablet or computer, with nothing to download.",
    howTo: GENERIC_HOWTO,
    goodFor: "Music students of any instrument building theory knowledge and ear training.",
  },
  rhythm: {
    noun: "Rhythm Game",
    genre: ["Rhythm", "Music", "Educational"],
    intro:
      "A free online rhythm game from UniEDD. It runs in your web browser on a phone, tablet or computer, with nothing to download.",
    howTo: [
      "Pick a song and press Start.",
      "Clap when a marker reaches the glowing ring.",
      "Each clap is scored Perfect, Good or Miss.",
    ],
    goodFor: "Kids and beginners learning to keep a steady beat and clap rhythms in time with music.",
  },
  other: {
    noun: "Quiz Game",
    genre: ["Educational", "Quiz"],
    intro:
      "A free online quiz game from UniEDD. It runs in your web browser on a phone, tablet or computer, with nothing to download.",
    howTo: GENERIC_HOWTO,
    goodFor: "Curious kids and learners who like quick, timed quizzes.",
  },
};

type GameSeo = {
  title: string;
  description: string;
  h1: string;
  intro: string;
  howTo: string[];
  goodFor: string;
  extra?: { heading: string; body: string[] }[];
  genre: string[];
};

const OVERRIDES: Record<string, Partial<GameSeo>> = {
  "clap-rhythm": {
    title: "Clap Rhythm Game – Free Online Rhythm Trainer for Kids | UniEDD",
    description:
      "Clap along to songs and nursery rhymes in a free online rhythm game. Your microphone hears each clap and scores it Perfect, Good or Miss. Works in the browser — keyboard or tap also work.",
    h1: "Clap Rhythm – online rhythm trainer game",
    intro:
      "Clap Rhythm is a free rhythm training game in the style of note-highway music games. Clap markers slide down a glowing stage in time with the song, and you clap when each marker reaches the ring. It runs in your web browser, with nothing to download.",
    howTo: [
      "Pick a song. Each song shows 1 to 5 difficulty stars.",
      "Allow the microphone when the browser asks. The optional clap calibration fits the timing to your device.",
      "Clap when a marker reaches the glowing ring. Each clap is scored Perfect, Good or Miss.",
      "No microphone? Press Space, Enter, J or F on a keyboard, or tap the stage on a phone.",
      "Use Practice mode, a slower speed or the guide clap while you learn a song.",
    ],
    goodFor:
      "Kids learning to keep a beat, music students building rhythm and timing, and teachers who want a fun rhythm warm-up for class.",
    extra: [
      {
        heading: "Songs and nursery rhymes",
        body: [
          "Songs include Jingle Bells and Happy Birthday, plus a Kids & Nursery Rhymes row with Twinkle Twinkle Little Star, Mary Had a Little Lamb, If You're Happy and You Know It, Hot Cross Buns, Baa Baa Black Sheep, Old MacDonald Had a Farm, London Bridge, The Wheels on the Bus, Frère Jacques and Row, Row, Row Your Boat.",
          "A Drum & Rhythm Patterns row has claps that follow a percussion pattern instead of the words: Basic Rock Beat (clap on 2 and 4), Clap-Along March, Stomp Stomp Clap Groove, Pat-a-Cake, a Ta Ti-Ti rhythm drill with Kodály rhythm names, Head Shoulders Knees and Toes, Bingo (claps replace the letters), a clave syncopation challenge over a samba groove, and Teentaal, the 16-beat Hindustani taal (clap on 1, 5 and 13, wave on 9). Their backing tracks are synthesized for UniEDD.",
          "On some songs the words light up karaoke-style as you go.",
        ],
      },
      {
        heading: "Tips for accurate clap detection",
        body: [
          "Wear headphones so the microphone hears your claps rather than the music.",
          "If markers feel early or late, use the Audio sync slider in Options.",
        ],
      },
    ],
  },
  "rhythm-tap": {
    title: "Rhythm Tap – Free Online Rhythm & Ear Training Game | UniEDD",
  },
  "interval-ear": {
    title: "Interval Ear Training Game – Free Online | UniEDD",
  },
  "fretboard-notes": {
    title: "Guitar Fretboard Note Finder – Free Online Guitar Game | UniEDD",
  },
  "piano-keys": {
    title: "Piano Keys Game – Learn Piano Note Names Free Online | UniEDD",
  },
};

export function categoryLabel(id: CategoryId) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Music";
}

export function gameSeo(game: GameDef): GameSeo {
  const cat = CATEGORY_SEO[game.category];
  const o = OVERRIDES[game.slug] ?? {};
  const base: GameSeo = {
    title: `${game.title} – Free Online ${cat.noun} | UniEDD`,
    description: `${game.blurb} A free ${cat.noun.toLowerCase()} that plays in your browser — about ${game.minutes} a round.`,
    h1: game.title,
    intro: cat.intro,
    howTo: cat.howTo,
    goodFor: cat.goodFor,
    genre: cat.genre,
  };
  return { ...base, ...o };
}

export const GAMES_HUB_SEO = {
  title: "Free Online Music Games for Kids – Rhythm, Ear Training, Guitar & Piano | UniEDD",
  description:
    "Play free online music games in your browser: a clap rhythm game with songs and nursery rhymes, music theory and ear training games, guitar and piano quizzes, and singing games. Weekly leaderboards, no downloads.",
};
