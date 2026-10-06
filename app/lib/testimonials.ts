// Reviews shown in the scrolling "Hear from our students" section
// (components/Testimonials.tsx). Only add genuine feedback from real
// learners or parents, e.g. copied from Google reviews or WhatsApp messages
// (with their permission). Keep names partial ("Parent, Rohini") if they'd
// rather not be named.
//
// To add one, copy a block below and fill it in. `initials` is the letter
// shown in the avatar circle. `program` puts the review on that program's
// page too (/programs/...). The section splits the list across two rows
// automatically, so any number of reviews works.
import type { ProgramName } from "./programs";

export interface Testimonial {
  name: string;
  program?: ProgramName;
  role: string;
  quote: string;
  initials: string;
  // Placeholder for layout previews only (see sampleReviews.ts)
  sample?: boolean;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Parent, Rohini",
    program: "Guitar",
    role: "Guitar learner",
    quote:
      "Our daughter started with guitar and now she waits for every class. The trainers are patient, encouraging, and genuinely focused on progress.",
    initials: "R",
  },
  {
    name: "Working Professional, Noida",
    program: "Vocals",
    role: "Vocal student",
    quote:
      "I was looking for a beginner-friendly way to learn singing without pressure. The 1:1 format made all the difference and kept me consistent.",
    initials: "N",
  },
  {
    name: "Student, Gurugram",
    program: "Public Speaking",
    role: "Public speaking learner",
    quote:
      "The public speaking classes helped me become calmer, clearer, and much more confident in school presentations and conversations.",
    initials: "G",
  },
  {
    name: "Parent, South Delhi",
    program: "Chess",
    role: "Chess learner",
    quote:
      "Our son picked up chess as a hobby and it's sharpened so much more than his game — his patience and focus at school have genuinely improved too.",
    initials: "S",
  },
];
