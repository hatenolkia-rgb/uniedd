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
  chess: {
    noun: "Chess Game",
    genre: ["Board game", "Puzzle", "Educational"],
    intro:
      "A free online chess game from UniEDD. It runs in your web browser on a phone, tablet or computer, with nothing to download or sign up for.",
    howTo: [
      "Drag a piece or tap it and then tap the square you want to move to.",
      "Your progress is saved in this browser on this device.",
    ],
    goodFor: "Kids and adults learning chess, and club players who want quick daily tactics practice.",
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
  "piano-falling-notes": {
    title: "Online Piano Game – Falling Notes Piano Practice with MIDI Keyboard or Microphone | UniEDD",
    description:
      "Free online piano game with falling notes. Play Treble Clef (right hand), Bass Clef (left hand) or Beast Mode (both hands) on a MIDI keyboard or a real piano through your microphone. 16 songs from Beginner to Advanced — Twinkle Twinkle, Ode to Joy, Für Elise, Canon in D and more.",
    h1: "Online Piano Game – Falling Notes Piano Practice with MIDI Keyboard or Microphone",
    intro:
      "Piano Falling Notes is a free piano practice game in the style of falling-notes piano apps. Coloured notes fall towards an on-screen piano keyboard in time with the song, and you play each key as its note reaches the glowing line. Every note is scored Perfect, Good or Miss, with a combo, accuracy and up to five stars. It runs in your web browser, with nothing to download.",
    howTo: [
      "Connect your digital piano or keyboard to the computer, tablet or phone with a USB cable (or a USB-MIDI adapter) and press Connect MIDI keyboard. Keyboards are found automatically, even when you plug one in later.",
      "No cable, or playing an acoustic piano? Choose Use your microphone and put the device near the piano. The game listens for the pitch of each note you play.",
      "No piano at all? Tap the on-screen keys, or use the computer keyboard: A S D F G H J K for the white keys, W E T Y U for the black keys, and Z / X to move an octave down or up.",
      "Choose a game mode: Treble Clef (right hand), Bass Clef (left hand) or Beast Mode (both hands together).",
      "Pick a song by level, then choose Play, Wait mode (the song waits for the right key) or Listen (the song plays itself so you can hear it first). Slow it down to 50% or 75% while you learn.",
      "Play each key as its note touches the line. Run Auto-calibrate once so your keyboard or microphone is judged exactly on time.",
    ],
    goodFor:
      "Piano and keyboard students of any age, children starting with their first songs, and teachers who want a fun note-reading and timing warm-up for class.",
    extra: [
      {
        heading: "Treble Clef, Bass Clef and Beast Mode",
        body: [
          "Every song has a right-hand melody and a left-hand bass part, so it can be played three ways. Treble Clef mode is the right hand reading the treble clef, Bass Clef mode is the left hand reading the bass clef, and Beast Mode is both hands together, with right-hand notes in blue and left-hand notes in orange.",
          "A small grand staff above the falling notes shows the music coming up on the treble and bass clef, with the clef you are playing highlighted, so students learn to read real sheet music while they play. Each mode keeps its own personal bests and its own leaderboard.",
        ],
      },
      {
        heading: "Songs and difficulty levels",
        body: [
          "Beginner: C Major Scale, Sa Re Ga Ma alankar drill (with sargam note names), Five-Finger Warm-up, Mary Had a Little Lamb, Hot Cross Buns and Twinkle Twinkle Little Star.",
          "Easy: Row, Row, Row Your Boat, London Bridge, Jingle Bells, Ode to Joy and Happy Birthday. Intermediate: Twinkle Twinkle with both hands, Minuet in G and a simplified Canon in D. Advanced: the opening of Für Elise and a two-octave C major scale sprint with both hands.",
          "All songs are traditional or classical melodies in the public domain, arranged for the game by UniEDD. Beginner songs have simple bass notes for the left hand; scales and drills have a left-hand part an octave lower. In Treble Clef and Bass Clef mode the game can play the other hand for you.",
        ],
      },
      {
        heading: "MIDI keyboard or microphone?",
        body: [
          "A MIDI keyboard is the most accurate way to play: every key, chord and how hard you press is read exactly. It works in browsers with Web MIDI, such as Chrome and Edge on computers and Android.",
          "The microphone is there for students who can't connect their piano. It hears one note at a time, so it works best in Treble Clef or Bass Clef mode; in Beast Mode it checks the right hand only, so use a MIDI keyboard for Beast Mode. A note heard an octave off still counts. Wear headphones if the game is playing music, so the microphone hears only your piano.",
        ],
      },
    ],
  },
  "chess-puzzles": {
    title: "Free Chess Puzzles Online – Thousands of Puzzles by Difficulty | UniEDD",
    description:
      "Free chess puzzles online: 400,000 tactics puzzles in five difficulty levels from Beginner to Expert. Mate in 1, 2 and 3, forks, pins, skewers and endgames, with hints, a puzzle rating, a daily puzzle and a 3-minute Puzzle Rush.",
    h1: "Free chess puzzles online – thousands of puzzles by difficulty",
    intro:
      "Chess Puzzles is a free chess tactics trainer with 400,000 puzzles taken from real games. Each puzzle starts with your opponent's move; then you find the best reply. Puzzles are grouped into five difficulty levels, so beginners and strong players both get puzzles that fit. It runs in your web browser, with nothing to download.",
    howTo: [
      "Pick a mode: Rated (puzzles near your puzzle rating), By level, Daily puzzle or Puzzle Rush.",
      "Watch the opponent's first move, then find the best move for your side. The board turns so your side is at the bottom.",
      "Drag a piece, or tap it and tap the target square. Pawns that reach the last rank let you choose the piece to promote to.",
      "A right move is answered by the opponent until the puzzle is solved. A wrong move can be retried.",
      "Stuck? Use Hint to see which piece to move, Show move for the full move, or Solution to watch the answer.",
    ],
    goodFor:
      "Children learning chess tactics, adults returning to the game, and club players who want daily tactics training at the right level.",
    extra: [
      {
        heading: "Difficulty levels",
        body: [
          "Beginner ★ (puzzle rating under 1000), Easy ★★ (1000–1399), Medium ★★★ (1400–1799), Hard ★★★★ (1800–2199) and Expert ★★★★★ (2200 and up). Each level has 80,000 puzzles.",
          "The theme filter finds puzzles by idea: mate in 1, mate in 2, mate in 3, back-rank mate, smothered mate, fork, pin, skewer, discovered attack, sacrifice, deflection, promotion, zugzwang, and opening, middlegame or endgame positions.",
        ],
      },
      {
        heading: "Puzzle rating, streaks, daily puzzle and Puzzle Rush",
        body: [
          "Your puzzle rating starts at 1000 and goes up when you solve a puzzle on the first try and down after a wrong move, hint or solution, like a chess rating. Your current and best streak of puzzles solved in a row are kept too.",
          "Everyone gets the same Daily puzzle each day. Puzzle Rush gives you 3 minutes to solve as many puzzles as you can; they get harder as you go, and three mistakes end the run.",
        ],
      },
    ],
  },
  chess: {
    title: "Play Chess vs Computer – Free Online, 5 Levels | UniEDD",
    description:
      "Play chess against the computer for free in your browser. Five levels from Beginner to Expert, take back moves, flip the board and play as White or Black. No sign-up.",
    h1: "Play chess against the computer",
    intro:
      "Play a full game of chess against the computer, free in your web browser. Choose a level from 1 star (Beginner, a friendly opponent that makes mistakes) to 5 stars (Expert, a strong chess engine).",
    howTo: [
      "Choose a computer level and start a new game as White, as Black or a random colour.",
      "Drag a piece, or tap it and then tap the square to move to. Legal moves are shown as dots.",
      "Use Take back to undo your last move and Flip board to look from the other side.",
      "The game ends with checkmate, stalemate or a draw, shown above the move list.",
    ],
    goodFor: "Beginners practising full games, kids learning how the pieces move, and players who want a quick game at their level.",
  },
  "chess-online": {
    title: "Play Chess Online with Other Players – Free, No Sign-Up | UniEDD",
    description:
      "Play live chess online against another player for free. Enter a name, wait in the online waiting room and get matched with the next available player. Works on phones, tablets and computers, no sign-up.",
    h1: "Play chess online against other players",
    intro:
      "Play a live game of chess against a real person, free in your web browser. Type a name, press Find opponent and you are matched with the next player in the waiting room. Colours are picked at random, and every move is checked so only legal moves are allowed.",
    howTo: [
      "Type a display name (3–16 letters or numbers) and press Find opponent.",
      "Wait in the waiting room until another player joins. Press Cancel to leave the queue.",
      "When you are matched you get White or Black at random. White moves first.",
      "Drag a piece, or tap it and tap the target square. The game ends with checkmate, stalemate, a draw or a resignation.",
      "If your opponent disconnects you will see a notice, and after a short wait you can claim the win. Press Play again to go back to the waiting room.",
      "Teachers: choose Private lobby → Create private lobby and share the code or link. You can take moves back, approve a student's take-back request, reset the board, swap colours and demonstrate moves for both sides.",
    ],
    goodFor: "Students who want to practise against real opponents, friends playing each other from different devices, and anyone who wants a quick live game.",
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
  title: "Free Online Music Games & Chess Puzzles for Kids – Piano, Rhythm, Ear Training, Guitar | UniEDD",
  description:
    "Play free online games in your browser: a falling-notes piano game for MIDI keyboards or a real piano, a clap rhythm game with songs and nursery rhymes, music theory and ear training games, guitar and piano quizzes, singing games, and thousands of chess puzzles by difficulty plus chess vs the computer or online against other players. No downloads.",
};
