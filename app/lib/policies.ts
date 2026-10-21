// UniEDD class policies (owner's wording, Oct 2026). The same text is printed
// on LMS invoices and agreed to on the LMS checkout page
// (uniedd-lms/src/policies.js): change both together.
export const POLICY_SECTIONS = [
  {
    id: "cancellation",
    title: "Class cancellation",
    text: "Group (1:5) and buddy (1:2) classes must be cancelled at least 1 hour before the class starts. Individual classes must be cancelled at least 20 minutes before. A class cancelled later than this, or missed without notice, counts as taken, because the teacher has kept that slot for you.",
  },
  {
    id: "rescheduling",
    title: "Rescheduling",
    text: "A class can be rescheduled with the same notice as a cancellation: at least 1 hour before for group (1:5) and buddy (1:2) classes, and at least 20 minutes before for individual classes. Each student can reschedule 1 class per month, and the new time depends on the teacher having a free slot. Requests made later than this, or beyond 1 per month, count as a class taken.",
  },
  {
    id: "refunds",
    title: "Refunds",
    text: "Refunds are given only for unused classes, and must be requested within 3 months of the missed classes. If a student is absent for 3 months or more without telling us, those months are not refundable, as the teacher has kept the slot and the dashboard ready throughout. The month in which a refund is requested is also not refundable. Example: on a 12-month package, a student is absent for months 1 to 3 and asks for a refund in month 4. Months 1 to 4 are not refunded; the remaining 8 months (months 5 to 12) are refunded.",
  },
  {
    id: "data",
    title: "Your data and class recordings",
    text: "Parents and guardians can ask us at any time to delete the student's profile, data and class recordings. Class recordings are used only for the student's learning and for quality and safety within UniEDD. We never use them for personal use or in advertising. If we ever want to use a video, we will ask the parent or guardian for separate written permission first. Full details: uniedd.com/privacy",
  },
] as const;

// One-line versions for the site footer.
export const POLICY_SUMMARY = [
  { title: "Cancel or reschedule", text: "Group & buddy classes: at least 1 hour before. Individual classes: at least 20 minutes before. 1 reschedule per month." },
  { title: "Refunds", text: "For unused classes only, requested within 3 months. Long absences and the current month are not refunded." },
  { title: "Your data", text: "Ask us any time to delete your child's data and recordings. We never use class videos in ads." },
] as const;
