// PLACEHOLDER reviews for previewing page layouts. They are NOT real
// feedback: each one is badged "Sample" and they're only ever shown on
// preview deployments and local dev, never on the live site (see
// displayedReviews below). Replace them by adding real reviews to
// testimonials.ts, then delete this file.
import { PROGRAMS } from "./programs";
import { TESTIMONIALS, type Testimonial } from "./testimonials";

const PLACES = ["Dubai", "London", "Toronto", "Singapore", "Sydney", "New Jersey", "Bengaluru"];
const WHO = ["Parent", "Adult learner", "Parent", "Student", "Parent", "Working professional", "Parent"];

const TEMPLATES = [
  (p: string, skill: string) => `Sample review: the ${p.toLowerCase()} classes have been great so far, especially the focus on ${skill.toLowerCase()}.`,
  (p: string) => `Sample review: live one-to-one ${p.toLowerCase()} sessions made it easy to stay consistent every week.`,
  (p: string, skill: string) => `Sample review: our mentor is patient and clear, and ${skill.toLowerCase()} has really improved.`,
  (p: string) => `Sample review: scheduling ${p.toLowerCase()} classes in our time zone was simple and flexible.`,
  (p: string, skill: string) => `Sample review: I liked how each class built on the last, starting with ${skill.toLowerCase()}.`,
  (p: string) => `Sample review: the free demo helped us decide, and ${p.toLowerCase()} is now a weekly highlight.`,
];

export const SAMPLE_REVIEWS: Testimonial[] = PROGRAMS.flatMap((program, pi) =>
  TEMPLATES.map((template, i) => {
    const place = PLACES[(pi + i) % PLACES.length];
    const who = WHO[(pi + i) % WHO.length];
    const skill = program.learn[i % program.learn.length].title;
    return {
      name: `${who}, ${place}`,
      program: program.name,
      role: `${program.name} learner`,
      quote: template(program.name, skill),
      initials: place[0],
      sample: true,
    };
  })
);

// Vercel sets VERCEL_ENV to "production" for the live site, "preview" for
// branch previews; it's unset locally. Call this from Server Components only
// (the variable isn't available in the browser).
export function displayedReviews(): Testimonial[] {
  return process.env.VERCEL_ENV === "production" ? TESTIMONIALS : [...TESTIMONIALS, ...SAMPLE_REVIEWS];
}
