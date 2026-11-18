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
  karaoke: {
    noun: "Karaoke Maker",
    genre: ["Music", "Educational", "Karaoke"],
    intro:
      "A free online karaoke maker from UniEDD. It runs in your web browser on a phone, tablet or computer, and your song never leaves your device.",
    howTo: [
      "Choose a song file from your device.",
      "Remove the vocals with AI mode or Quick mode.",
      "Change the key in half steps or whole steps, listen, and download your karaoke track.",
    ],
    goodFor: "Singers and music students who want a backing track in a key that suits their voice.",
  },
  tanpura: {
    noun: "Tanpura & Tabla App",
    genre: ["Music", "Educational"],
    intro:
      "A free online tanpura and tabla player from UNIEDD for singing and instrument practice. It runs in your web browser on a phone, tablet or computer, with nothing to install.",
    howTo: [
      "Choose your key (Sa), male or female tanpura and the first-string tuning.",
      "Pick a taal and tempo for the tabla.",
      "Press Play both and practise along.",
    ],
    goodFor: "Indian classical, semi-classical and devotional singers and instrumentalists doing daily riyaz.",
  },
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
  "tanpura-tabla": {
    title: "Online Tanpura & Tabla – Free Electronic Tanpura with Taal Player | UNIEDD",
    description:
      "Free online tanpura and tabla for riyaz: a tanpura drone in all 12 keys with Pa, Ma, Ni or Sa tuning, male or female, 4, 5 or 6 strings, fine tuning in cents and A4 432–445 Hz, jawari and reverb — plus tabla thekas in Teentaal, Keherwa, Dadra, Rupak, Jhaptaal, Ektaal, Deepchandi, Tilwada, Jhoomra, Dhamar and Chautaal from 30 to 300 BPM with sam and khali shown. Runs in your browser.",
    h1: "Tanpura & Tabla – Online Tanpura Drone with Taal Player",
    intro:
      "Tanpura & Tabla is a free electronic tanpura and tabla machine for singing and instrument practice (riyaz). The tanpura is created live in your browser, so every key and tuning is exactly in tune, and the tabla plays real recorded strokes arranged into the traditional theka of each taal. Set your Sa, choose a taal and tempo, and practise along on a phone, tablet or computer.",
    howTo: [
      "Choose your key — the note that is your Sa — and pick Male or Female tanpura. Use Lower or Higher to move a whole octave, Fine tune to adjust in cents, and A4 reference (432–445 Hz) to match another instrument.",
      "Pick the first string: Pa for most ragas, Ma for ragas without Pa, Ni (or komal Ni) for ragas without Pa and Ma, or Sa. Choose 4, 5 or 6 strings, and open the String mixer to change any string's note, volume or fine tuning.",
      "Set the speed of the plucking, the jawari (the buzzing shimmer of the strings), reverb and volume. Turn on Swarmandal shimmer for a sparkling harp-like sweep in the notes of a raga.",
      "Choose a taal and a tempo from 30 BPM (very slow vilambit) to 300 BPM (ati-drut) — or tap the tempo. The matra grid lights up each beat and shows the sam (X), the claps (tali) and the wave (khali).",
      "Press Play both (or start the tanpura and tabla separately). The tabla is tuned to your Sa automatically, or to Pa if you prefer. Save your favourite set-ups as presets and use the timer to stop after your practice time.",
    ],
    goodFor: "Hindustani classical and light-music singers, harmonium, flute, sitar and violin students, and anyone who wants a steady drone and taal for daily riyaz.",
    extra: [
      {
        heading: "Taals included",
        body: [
          "Teentaal (16 matras), Keherwa (8), Dadra (6), Rupak (7), Jhaptaal (10), Ektaal (12), Deepchandi (14), Tilwada (16), Jhoomra (14), Dhamar (14) and Chautaal (12). Each plays its traditional theka, with the bayan (bass drum) dropping out in the khali section just like a real tabla player.",
          "You can also pick a real recorded tabla groove (8 or 16 beats) played by a tabla player at 60 to 100 BPM.",
        ],
      },
      {
        heading: "Good to know",
        body: [
          "Natural tuning uses the pure intervals of a real tanpura; Keyboard tuning matches a harmonium or keyboard. On iPhone and iPad the sound stops if you leave the page, so keep it open while you practise. Nothing is recorded — all the sound is made on your device.",
        ],
      },
    ],
    genre: ["Music", "Educational"],
  },
  "karaoke-maker": {
    title: "Karaoke Maker – Free Online Vocal Remover & Key Changer | UniEDD",
    description:
      "Free online karaoke maker: upload any song, remove the vocals with an AI vocal remover, and change the key up or down by half steps or whole steps (−12 to +12) without changing the speed. Compare original vs karaoke, keep a quiet guide vocal, and download MP3 or WAV. Runs in your browser — your song is never uploaded.",
    h1: "Karaoke Maker – Remove Vocals & Change the Key",
    intro:
      "Karaoke Maker turns a song into a sing-along backing track right in your web browser. Pick a song file, let the AI vocal remover lift out the singer's voice, then move the music up or down to a key that suits your voice — a +2 shift is one whole step up, −1 is a half step down — while the tempo stays exactly the same. Your song stays on your device; nothing is uploaded or saved.",
    howTo: [
      "Tap the song box and pick an MP3, WAV, M4A, AAC, OGG or FLAC file from your phone or computer. Please only use songs you own or have permission to use.",
      "Choose AI mode (best quality; a one-time download of about 166 MB that stays in your browser for next time) or Quick mode (instant, best for studio songs with the singer in the middle), then press Remove vocals.",
      "Change the key with the − and + buttons, the slider, or the half-step and whole-step buttons. The label tells you how far you moved, for example \u201c+2 = 1 whole step up\u201d, and the new key is shown when it can be detected.",
      "Press Play and switch between A (original) and B (karaoke) to compare. Use the voice volume slider to keep a quiet guide vocal if you like.",
      "Choose MP3 or WAV and press Make my file, then download your karaoke track.",
    ],
    goodFor:
      "Singers and vocal students practising songs in a comfortable key, guitar and keyboard players who want a backing track to play along with, and teachers preparing karaoke tracks for class.",
    extra: [
      {
        heading: "Private by design",
        body: [
          "Everything happens inside your browser. Your song is never uploaded to a server and nothing is saved — when you close the page it's gone. The only thing downloaded is the AI helper itself (an open-source music separation model), which your browser keeps so the next song starts faster.",
        ],
      },
      {
        heading: "How good is the vocal removal?",
        body: [
          "AI mode uses a music source separation model trained to find the singing voice, so it removes lead and backing vocals while keeping drums, bass and instruments. Some songs leave a faint voice or reverb behind, and heavily effected vocals are harder. Quick mode cancels whatever is mixed in the centre of a stereo song, so it is instant but also softens centre instruments, and it can't work on mono recordings.",
          "Changing the key uses a time-preserving pitch shifter, so the speed and length of the song stay the same. Small shifts of one or two whole steps sound most natural; very large shifts (close to an octave) sound more processed.",
        ],
      },
    ],
    genre: ["Music", "Educational", "Karaoke"],
  },
  "alternate-picking": {
    title: "Guitar Chord & Alternate Picking Game for Kids – Free Online Practice | UniEDD",
    description:
      "Free guitar practice game with no metronome: a friendly coach calls out a chord or a down-up picking pattern, and the microphone listens and recognises the chord you strum — G, C, D, Em, Am up to barre chords like F and Bm. Play at your own pace; Beginner, Expert and Pro.",
    h1: "Alternate Picking & Strumming Coach – Guitar Chord & Picking Practice Game",
    intro:
      "The Alternate Picking & Strumming Coach is a free guitar practice game for children and beginners. Picky, a cheerful guitar pick, says what to play out loud — a chord such as \u201cG major\u201d, or a picking pattern such as \u201cdown, up, down, up\u201d — and shows a big chord diagram or blue down and pink up arrows. There is no metronome: you play at your own pace, the microphone listens, and as soon as Picky hears the right chord ring out it turns green and you move on to the next one, with stars and confetti along the way. It runs in your web browser, with nothing to download.",
    howTo: [
      "Choose Alternate Picking (single notes) or Chords, then Beginner, Expert or Pro.",
      "Choose Real guitar so the microphone can listen, or play without a mic (tap the \u2193 and \u2191 buttons or the F and J keys for picking, or tap \u2713 after each chord). The microphone is never recorded, saved or uploaded \u2014 it is checked live on your device.",
      "Chords: make the shape from the diagram and strum. Picky shows what it is hearing (for example \u201cHearing: G major\u201d) and, when the right chord rings for about half a second, moves to the next chord. Stuck? Press Skip.",
      "Picking: play the arrows in order at any speed. Every stroke Picky hears lights up the next arrow; dashed arrows are air strokes. Press Hear it to listen to how it should sound.",
      "After each exercise you get up to three stars and a tip. Try again or go on; six exercises make a round, and you can save your score to the leaderboard.",
    ],
    goodFor:
      "Children and beginners learning their first chords and chord changes, students building clean alternate picking, and teachers who want a fun, pressure-free warm-up for class.",
    extra: [
      {
        heading: "Levels",
        body: [
          "Chords \u2014 Beginner: open G, C, D, E minor and A minor, one or two chords at a time. Expert: adds A, E, D minor and the seventh chords A7, D7, E7 and G7, in four-chord changes. Pro: barre chords F, B minor, F sharp minor, B flat, C minor and G minor with quick changes. A suggested strum pattern is shown for each exercise, but any strum counts.",
          "Alternate Picking \u2014 Beginner: down strokes and down-up 8th notes on one open string, with air strokes, string hops and accents. Expert: triplets, moving accents, string crossing and 16th-note bursts. Pro: long 16th runs, gallops, sextuplets and string skipping.",
        ],
      },
      {
        heading: "How the listening works",
        body: [
          "For chords, the game looks at which notes are ringing (a pitch-class profile of the sound) and compares it with every major, minor and seventh chord, so normal guitar voicings and a bit of room noise are fine. A seventh chord also passes as its plain major chord.",
          "For chords, a chord only counts after the game hears a real strum (a sharp attack that then rings and fades), so singing or humming the chord notes does not count.",
          "For picking, a stroke only counts when the game hears the string it asked for ring at the right pitch (within half a semitone, in the right octave) — talking, singing (even the right note), claps and taps are ignored, and nothing is judged while the coach itself is speaking. It cannot tell a down stroke from an up stroke by ear, so follow the arrows yourself (tap mode and Camera Coach do check the direction).",
        ],
      },
      {
        heading: "Camera Coach (optional)",
        body: [
          "Turn on Camera Coach and the game watches your strumming hand through the webcam or the phone's front camera. It spots strokes that go the wrong way, missed and extra strokes and uneven strokes, and in Chords mode it takes a rough, approximate look at your chord hand.",
          "We are not recording anything. Your camera and microphone are never recorded, saved, or uploaded; everything is checked live on your device. Camera Coach works best with both hands in the picture and good light.",
        ],
      },
    ],
    genre: ["Music", "Educational"],
  },
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
  title: "Free Online Music Games, Karaoke Maker & Chess Puzzles for Kids – Piano, Guitar, Rhythm | UniEDD",
  description:
    "Play free online games in your browser: a karaoke maker that removes vocals and changes the key of any song, an online tanpura and tabla player for riyaz in any key and taal, a guitar picking and strumming coach that speaks each pattern, a falling-notes piano game for MIDI keyboards or a real piano, a clap rhythm game with songs and nursery rhymes, music theory and ear training games, guitar and piano quizzes, singing games, and thousands of chess puzzles by difficulty plus chess vs the computer or online against other players. No downloads.",
};
