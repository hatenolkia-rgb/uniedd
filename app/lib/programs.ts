// Single source of truth for every program: the homepage cards (Courses.tsx,
// ProgramShowcase.tsx), the /programs pages, the footer, the header menu, the
// sitemap and the structured data all read from here. Edit a program once
// and it updates everywhere.
//
// Keep the content factual. Don't add claims (certifications, exam boards,
// prices, teacher names, results) unless they're true and current.

export type ProgramCategory = "Music" | "Dance" | "Public Speaking" | "Chess";

// Must match the instrument options the booking form and /api/contact accept.
export type ProgramName = "Guitar" | "Keyboard" | "Vocals" | "Tabla" | "Dance" | "Public Speaking" | "Chess";

export interface Program {
  slug: string;
  name: ProgramName;
  category: ProgramCategory;
  // Card heading on the homepage and the <h1> on the program page
  title: string;
  tagline: string;
  // Homepage card badge
  tag: string | null;
  image: string;
  imageAlt: string;
  // Muted stock clip in public/videos (Mixkit Free License), if one exists
  video?: string;
  // Short skills line on the Showcase cards
  showcaseLine: string;
  ageGroup: string;
  duration: string;
  format: string;
  // One-paragraph summary, used on cards and in the page intro
  description: string;
  // SEO: <title> and meta description (aim for ~60 and ~155 characters)
  seoTitle: string;
  seoDescription: string;
  // Program page content
  overview: string[];
  learn: { title: string; detail: string }[];
  forWho: string[];
  journey: { stage: string; detail: string }[];
  faqs: { q: string; a: string }[];
}

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=70&auto=format&fit=crop`;

// Shared facts (same for every program today)
const AGE_GROUP = "5-45 Years";
const DURATION = "48 sessions in 6 months for beginner level";
const FORMAT = "Group or Individual Classes";

// FAQs that apply to every program, appended after each program's own
const commonFaqs = (name: string): Program["faqs"] => [
  {
    q: `Are the ${name.toLowerCase()} classes live or recorded?`,
    a: "Every class is live and online with your mentor, so you get real-time feedback and corrections rather than pre-recorded videos.",
  },
  {
    q: "Can I try a class before enrolling?",
    a: "Yes. Book a free 30-minute demo session to meet your mentor and see how classes work before you commit.",
  },
  {
    q: "What time are classes held?",
    a: "Classes are scheduled around you, in your own time zone. Pick a time that suits you when you book your demo.",
  },
  {
    q: "Who can join?",
    a: `Our ${name.toLowerCase()} program is designed for learners aged 5 to 45, from complete beginners to those who already have some experience.`,
  },
];

export const PROGRAMS: Program[] = [
  {
    slug: "guitar",
    name: "Guitar",
    category: "Music",
    title: "Online Guitar Classes for Kids & Adults",
    tagline: "Strum, create & shine — on stage & in life",
    tag: "Popular",
    image: unsplash("1510915361894-db8b60106cb1"),
    imageAlt: "Close-up of hands playing an acoustic guitar",
    video: "/videos/guitar.mp4",
    showcaseLine: "Chords, strumming & your first songs",
    ageGroup: AGE_GROUP,
    duration: DURATION,
    format: FORMAT,
    description:
      "Learn chords, rhythm, melody, fingerstyle, and confidence-building practice in structured weekly sessions with a dedicated coach.",
    seoTitle: "Online Guitar Classes for Kids & Adults | Live 1:1 | UniEDD",
    seoDescription:
      "Learn guitar online with live classes for kids and adults. Chords, strumming, fingerstyle and songs with a dedicated mentor. Book a free demo with UniEDD.",
    overview: [
      "Our online guitar classes take you from your very first chord to playing full songs with confidence. Every session is live with a dedicated mentor who listens, corrects your technique in real time, and adjusts the pace to you.",
      "Whether you want to strum along to your favourite songs, explore fingerstyle, or build a strong foundation for performing, the course is structured around clear weekly goals and a practice plan you can follow between classes.",
    ],
    learn: [
      { title: "Chords & transitions", detail: "Open chords, barre chords and smooth changes between them." },
      { title: "Strumming & rhythm", detail: "Strumming patterns, timing and playing in time with a song." },
      { title: "Fingerstyle", detail: "Picking patterns and finger independence for richer sound." },
      { title: "Melody & scales", detail: "Single-note melodies and the scales behind them." },
      { title: "Playing songs", detail: "Putting it together to play complete songs you enjoy." },
      { title: "Practice habits", detail: "A weekly practice routine that keeps you improving." },
    ],
    forWho: [
      "Complete beginners picking up a guitar for the first time",
      "Kids who want a fun, structured start in music",
      "Adults returning to guitar after a break",
      "Self-taught players who want to fix gaps in technique",
    ],
    journey: [
      { stage: "Beginner", detail: "Posture, basic chords, simple strumming and your first songs." },
      { stage: "Intermediate", detail: "Barre chords, fingerstyle patterns and more complex rhythms." },
      { stage: "Advanced", detail: "Solos, improvisation, arrangements and performance preparation." },
    ],
    faqs: [
      {
        q: "Do I need my own guitar?",
        a: "Yes, you'll need a guitar at home to practise between classes. An acoustic guitar is a good choice for most beginners.",
      },
      ...commonFaqs("Guitar"),
    ],
  },
  {
    slug: "keyboard",
    name: "Keyboard",
    category: "Music",
    title: "Online Keyboard & Piano Classes for Kids & Adults",
    tagline: "Every key unlocks a little more confidence",
    tag: "New",
    image: "/piano-hero.jpg",
    imageAlt: "Hands playing a piano keyboard",
    video: "/videos/keyboard.mp4",
    showcaseLine: "Scales, technique & sight-reading",
    ageGroup: AGE_GROUP,
    duration: DURATION,
    format: FORMAT,
    description:
      "Develop timing, hand coordination, and musical expression with personalised keyboard coaching designed around your pace.",
    seoTitle: "Online Keyboard & Piano Classes for Kids & Adults | UniEDD",
    seoDescription:
      "Live online keyboard and piano classes for kids and adults. Learn technique, scales, chords and reading music with a dedicated mentor. Book a free demo.",
    overview: [
      "Our online keyboard and piano classes build real musical skill one step at a time. You'll develop hand coordination, timing and expression in live sessions with a mentor who guides your technique as you play.",
      "Lessons balance technique with music you enjoy, so practice stays motivating. You'll learn to read music, play with both hands and build up a repertoire of pieces.",
    ],
    learn: [
      { title: "Hand position & technique", detail: "Correct posture, finger numbering and relaxed playing." },
      { title: "Scales & chords", detail: "Major and minor scales, chords and their inversions." },
      { title: "Reading music", detail: "Notes on the staff, rhythm values and sight-reading." },
      { title: "Hand coordination", detail: "Playing different parts with each hand at the same time." },
      { title: "Expression", detail: "Dynamics, phrasing and playing with feeling." },
      { title: "Repertoire", detail: "Building a set of pieces you can play confidently." },
    ],
    forWho: [
      "Beginners who have never played a keyboard or piano",
      "Kids starting their first instrument",
      "Adults who always wanted to learn piano",
      "Learners who want to read music properly",
    ],
    journey: [
      { stage: "Beginner", detail: "Hand position, simple melodies and reading basic notation." },
      { stage: "Intermediate", detail: "Both-hands playing, scales, chords and longer pieces." },
      { stage: "Advanced", detail: "Complex repertoire, expression and performance preparation." },
    ],
    faqs: [
      {
        q: "Do I need a piano, or is a keyboard enough?",
        a: "A keyboard is enough to start. You'll need one at home to practise between classes.",
      },
      ...commonFaqs("Keyboard"),
    ],
  },
  {
    slug: "vocals",
    name: "Vocals",
    category: "Music",
    title: "Online Vocals & Singing Classes for Kids & Adults",
    tagline: "Find your voice, then find your stage",
    tag: null,
    image: unsplash("1516280440614-37939bbacd81"),
    imageAlt: "Singer performing into a microphone",
    video: "/videos/vocals.mp4",
    showcaseLine: "Breath, pitch & stage presence",
    ageGroup: AGE_GROUP,
    duration: DURATION,
    format: FORMAT,
    description:
      "Improve pitch, voice control, breathing, and performance confidence through guided vocal practice with regular performance opportunities.",
    seoTitle: "Online Singing & Vocal Classes for Kids & Adults | UniEDD",
    seoDescription:
      "Live online singing lessons for kids and adults. Improve pitch, breath control, voice range and stage confidence with a dedicated vocal mentor. Free demo.",
    overview: [
      "Our online vocal classes help you sing with control, accuracy and confidence. In live sessions, your mentor listens closely and guides your breathing, pitch and tone as you sing.",
      "You'll work on healthy vocal technique alongside songs you love, and build the confidence to sing in front of others.",
    ],
    learn: [
      { title: "Breath control", detail: "Breathing technique that supports longer, steadier notes." },
      { title: "Pitch accuracy", detail: "Ear training and exercises to sing in tune." },
      { title: "Voice range", detail: "Safely extending and strengthening your range." },
      { title: "Tone & diction", detail: "A clear, pleasant tone and words that are easy to understand." },
      { title: "Song interpretation", detail: "Bringing emotion and style to the songs you sing." },
      { title: "Stage presence", detail: "Confidence and composure when singing for an audience." },
    ],
    forWho: [
      "Beginners who want to sing in tune",
      "Kids who love singing and want proper guidance",
      "Adults who want to sing with more confidence",
      "Singers preparing for performances or competitions",
    ],
    journey: [
      { stage: "Beginner", detail: "Breathing, warm-ups, pitch matching and simple songs." },
      { stage: "Intermediate", detail: "Range, tone control and more challenging songs." },
      { stage: "Advanced", detail: "Style, interpretation and performance preparation." },
    ],
    faqs: [
      {
        q: "I can't sing in tune yet. Can I still join?",
        a: "Yes. Pitch accuracy is a skill that can be trained, and the beginner level starts with exactly that.",
      },
      ...commonFaqs("Vocals"),
    ],
  },
  {
    slug: "tabla",
    name: "Tabla",
    category: "Music",
    title: "Online Tabla Classes for Kids & Adults",
    tagline: "Build rhythm, build discipline",
    tag: "Classic",
    image: unsplash("1568219656418-15c329312bf1"),
    imageAlt: "Close-up of hands playing the tabla",
    showcaseLine: "Taal, rhythm & tabla bols",
    ageGroup: AGE_GROUP,
    duration: DURATION,
    format: FORMAT,
    description:
      "Build taal, rhythm patterns, and deep musical sensitivity through traditional learning methods passed down through generations.",
    seoTitle: "Online Tabla Classes for Kids & Adults | Live 1:1 | UniEDD",
    seoDescription:
      "Learn tabla online with live classes for kids and adults. Bols, taal, rhythm patterns and traditional compositions with a dedicated mentor. Book a free demo.",
    overview: [
      "Our online tabla classes teach this classical Indian instrument the traditional way, adapted for live online learning. Your mentor guides your hand technique and rhythm in real time as you play.",
      "You'll learn the bols (syllables) of tabla, the common taals, and compositions that build a deep sense of rhythm and discipline.",
    ],
    learn: [
      { title: "Hand technique", detail: "Correct hand position and strokes on the dayan and bayan." },
      { title: "Bols", detail: "The syllables of tabla and how each one is played." },
      { title: "Taal", detail: "Rhythmic cycles such as Teentaal and Keherwa." },
      { title: "Theka", detail: "The basic pattern that defines each taal." },
      { title: "Compositions", detail: "Kaida, tukda and other traditional compositions." },
      { title: "Laya", detail: "Keeping steady tempo and changing speed with control." },
    ],
    forWho: [
      "Beginners curious about Indian classical rhythm",
      "Kids who enjoy drumming and rhythm",
      "Adults who want to learn a traditional instrument",
      "Musicians who want a stronger sense of rhythm",
    ],
    journey: [
      { stage: "Beginner", detail: "Hand position, basic bols and your first taals." },
      { stage: "Intermediate", detail: "Thekas, kaidas and playing at different speeds." },
      { stage: "Advanced", detail: "Complex compositions, solo playing and accompaniment." },
    ],
    faqs: [
      {
        q: "Do I need my own tabla?",
        a: "Yes, you'll need a tabla set at home to practise between classes.",
      },
      ...commonFaqs("Tabla"),
    ],
  },
  {
    slug: "dance",
    name: "Dance",
    category: "Dance",
    title: "Online Dance Classes for Kids & Adults",
    tagline: "Move, express & perform with joy",
    tag: null,
    image: unsplash("1547153760-18fc86324498"),
    imageAlt: "Dancer mid-performance",
    video: "/videos/dance.mp4",
    showcaseLine: "Rhythm, choreography & expression",
    ageGroup: AGE_GROUP,
    duration: DURATION,
    format: FORMAT,
    description:
      "Learn movement, rhythm, posture, and performance quality in a fun and encouraging format that builds discipline and self-expression.",
    seoTitle: "Online Dance Classes for Kids & Adults | Live Classes | UniEDD",
    seoDescription:
      "Live online dance classes for kids and adults. Build rhythm, coordination, choreography and stage confidence with a dedicated dance mentor. Free demo.",
    overview: [
      "Our online dance classes make learning to move fun, structured and confidence-building. In live sessions, your mentor demonstrates, watches you dance and gives feedback on your form and timing.",
      "You'll build rhythm, coordination and flexibility, learn complete routines, and grow comfortable performing in front of others.",
    ],
    learn: [
      { title: "Rhythm & musicality", detail: "Moving in time with the music and its accents." },
      { title: "Posture & form", detail: "Body alignment and clean, controlled movement." },
      { title: "Coordination", detail: "Combining arm, leg and body movements smoothly." },
      { title: "Choreography", detail: "Learning and remembering full routines." },
      { title: "Expression", detail: "Bringing emotion and personality to your dancing." },
      { title: "Performance", detail: "Confidence and stage presence in front of an audience." },
    ],
    forWho: [
      "Kids with lots of energy who love to move",
      "Beginners with no dance experience",
      "Adults looking for a fun, active hobby",
      "Dancers preparing for a performance",
    ],
    journey: [
      { stage: "Beginner", detail: "Basic steps, rhythm and short routines." },
      { stage: "Intermediate", detail: "Longer choreography, technique and expression." },
      { stage: "Advanced", detail: "Complex routines, style and performance preparation." },
    ],
    faqs: [
      {
        q: "How much space do I need for online dance classes?",
        a: "A clear area where you can move freely and your camera can see your whole body is enough.",
      },
      ...commonFaqs("Dance"),
    ],
  },
  {
    slug: "public-speaking",
    name: "Public Speaking",
    category: "Public Speaking",
    title: "Online Public Speaking Classes for Kids & Adults",
    tagline: "Build sharper communication for school, work & life",
    tag: "In demand",
    image: unsplash("1475721027785-f74eccf877e2"),
    imageAlt: "Speaker presenting to an audience",
    video: "/videos/public-speaking.mp4",
    showcaseLine: "Clarity, confidence & delivery",
    ageGroup: AGE_GROUP,
    duration: DURATION,
    format: FORMAT,
    description:
      "Strengthen voice, storytelling, presence, and speaking confidence for school, work, and leadership through live guided practice.",
    seoTitle: "Online Public Speaking Classes for Kids & Adults | UniEDD",
    seoDescription:
      "Live online public speaking classes for kids and adults. Build confidence, voice, storytelling and presentation skills for school and work. Free demo.",
    overview: [
      "Our online public speaking classes help you speak clearly and confidently in any setting, from school presentations to job interviews and meetings. Every session is live, with plenty of speaking practice and direct feedback.",
      "You'll learn to structure your ideas, use your voice and body language well, and stay calm when all eyes are on you.",
    ],
    learn: [
      { title: "Confidence", detail: "Managing nerves and speaking with composure." },
      { title: "Voice & clarity", detail: "Pace, volume, pronunciation and pauses." },
      { title: "Structure", detail: "Organising a talk with a clear beginning, middle and end." },
      { title: "Storytelling", detail: "Using stories to make your message memorable." },
      { title: "Body language", detail: "Eye contact, gestures and posture that support your words." },
      { title: "Impromptu speaking", detail: "Thinking on your feet and answering questions well." },
    ],
    forWho: [
      "Students preparing for presentations, debates or elocution",
      "Kids who are shy about speaking up",
      "Professionals presenting at work or in interviews",
      "Anyone who wants to communicate with more impact",
    ],
    journey: [
      { stage: "Beginner", detail: "Confidence, voice basics and short structured talks." },
      { stage: "Intermediate", detail: "Storytelling, persuasion and longer presentations." },
      { stage: "Advanced", detail: "Debate, impromptu speaking and leading discussions." },
    ],
    faqs: [
      {
        q: "My child is very shy. Will this help?",
        a: "The classes start with small, low-pressure speaking exercises and build up gradually, so shy learners can grow their confidence step by step.",
      },
      ...commonFaqs("Public Speaking"),
    ],
  },
  {
    slug: "chess",
    name: "Chess",
    category: "Chess",
    title: "Online Chess Classes for Kids & Adults",
    tagline: "Master the board, sharpen the mind",
    tag: "New",
    image: unsplash("1528819622765-d6bcf132f793"),
    imageAlt: "Chess pieces on a board during a game",
    video: "/videos/chess.mp4",
    showcaseLine: "Openings, tactics & focus",
    ageGroup: AGE_GROUP,
    duration: DURATION,
    format: FORMAT,
    description:
      "Learn piece moves, tactics, openings, and strategy-building practice in structured weekly sessions with a dedicated coach.",
    seoTitle: "Online Chess Classes for Kids & Adults | Live Coaching | UniEDD",
    seoDescription:
      "Live online chess classes for kids and adults. Learn openings, tactics, strategy and endgames with a dedicated chess coach. Book a free demo with UniEDD.",
    overview: [
      "Our online chess classes teach you to think ahead, spot opportunities and play with a plan. Your coach works through positions with you live, explaining the ideas behind every move.",
      "Along with better chess, learners build focus, patience and problem-solving skills that carry over to school and work.",
    ],
    learn: [
      { title: "Rules & piece movement", detail: "How every piece moves, plus castling, en passant and promotion." },
      { title: "Tactics", detail: "Forks, pins, skewers and other winning patterns." },
      { title: "Openings", detail: "Sound opening principles and common openings." },
      { title: "Strategy", detail: "Planning, pawn structure and piece activity." },
      { title: "Endgames", detail: "Essential endgames and converting an advantage." },
      { title: "Game analysis", detail: "Reviewing your own games to learn from mistakes." },
    ],
    forWho: [
      "Kids learning chess for the first time",
      "Casual players who want to win more games",
      "Learners preparing for tournaments",
      "Adults who want a mentally stimulating hobby",
    ],
    journey: [
      { stage: "Beginner", detail: "Rules, piece values, basic checkmates and simple tactics." },
      { stage: "Intermediate", detail: "Opening principles, tactical patterns and planning." },
      { stage: "Advanced", detail: "Deep strategy, endgame technique and tournament preparation." },
    ],
    faqs: [
      {
        q: "Do I need a chess board?",
        a: "A physical board helps but isn't required. A free online chess board works fine for practice.",
      },
      ...commonFaqs("Chess"),
    ],
  },
];

export const PROGRAM_CATEGORIES = ["All", "Music", "Dance", "Public Speaking", "Chess"] as const;

export function getProgram(slug: string): Program | undefined {
  return PROGRAMS.find((program) => program.slug === slug);
}

export const programPath = (program: Pick<Program, "slug">) => `/programs/${program.slug}`;
