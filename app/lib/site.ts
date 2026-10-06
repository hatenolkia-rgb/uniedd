// Site-wide facts shared by the pages, metadata and structured data.
export const SITE_URL = "https://uniedd.com";
export const SITE_NAME = "UniEDD";

export const PHONE_DISPLAY = "+91 83838 57710";
export const PHONE_TEL = "+918383857710";
export const WHATSAPP_URL = "https://wa.me/918383857710";

// Shown in the homepage hero and on /about -- keep them in sync by editing here.
export const STATS = [
  { value: "1,298+", label: "Students trained" },
  { value: "54+", label: "Teachers" },
  { value: "8+", label: "Years of experience" },
];

// Official social profiles: shown in the footer on every page and listed in
// the site-wide structured data (layout.tsx) so search engines link them.
export const SOCIAL_LINKS = [
  { name: "YouTube", url: "https://www.youtube.com/@UniEdd" },
  { name: "Facebook", url: "https://www.facebook.com/profile.php?id=61586535061276" },
  { name: "Instagram", url: "https://www.instagram.com/uniedd_universaleducation/" },
  { name: "LinkedIn", url: "https://www.linkedin.com/company/uniedd" },
  { name: "Medium", url: "https://medium.com/@social_94758" },
] as const;
