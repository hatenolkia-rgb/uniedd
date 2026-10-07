// Site-wide facts shared by the pages, metadata and structured data.
export const SITE_URL = "https://uniedd.com";
export const SITE_NAME = "UniEDD";

export const PHONE_DISPLAY = "+91 83838 57710";
export const PHONE_TEL = "+918383857710";
export const WHATSAPP_URL = "https://wa.me/918383857710";

// Phone lines shown wherever we list contact details (footer, /about,
// privacy and terms) and in the site's structured data. `iso` picks the flag.
export const PHONE_NUMBERS = [
  { country: "India", iso: "in", display: "+91 83838 57710", tel: "+918383857710" },
  { country: "United Kingdom", iso: "gb", display: "+44 20 3807 3128", tel: "+442038073128" },
  { country: "United States", iso: "us", display: "+1 646 980 2733", tel: "+16469802733" },
] as const;

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

// Government registrations shown as trust badges on /about. Text badges
// only: the Startup India logo needs separate prior approval from DPIIT
// before it can be used on a website, and the Ministry of MSME emblem
// implies government endorsement -- add a logo only once approved.
// Fill in `number` to show it on the badge (it lets visitors verify).
export const REGISTRATIONS = [
  { title: "Registered MSME", detail: "Udyam registered with the Ministry of MSME, Government of India", numberLabel: "Udyam No.", number: "UDYAM-DL-11-0157877" },
  { title: "DPIIT Recognised Startup", detail: "Recognised under the Startup India initiative, Government of India", numberLabel: "Certificate No.", number: "DIPP279686" },
];
