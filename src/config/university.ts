export type FacultyNames = { uz: string | null; ru: string | null; en: string | null };

// English names are the three schools in the rendered "Schools & Departments" section.
// Uzbek and Russian names were not in the page or the static HTML.
// FILL: verify at millatumidi.uz
export const FACULTIES: FacultyNames[] = [
  { uz: null, ru: null, en: "School of Business" },
  { uz: null, ru: null, en: "School of Foreign Languages" },
  { uz: null, ru: null, en: "School of IT" },
];

// telegram and instagram are the JSON-LD sameAs links in the static homepage HTML.
// website is the canonical URL in that same HTML.
export const SOCIALS: { telegram: string | null; instagram: string | null; website: string | null } = {
  telegram: "https://t.me/millatumidi",
  instagram: "https://www.instagram.com/millatumidi.uz",
  website: "https://millatumidi.uz",
};

// Visible contact block on the rendered homepage.
// The JSON-LD block lists a different phone (+998712000000) and only "Tashkent".
export const CONTACTS: { address: string | null; phone: string | null; email: string | null } = {
  address: "37 Bunyodkor Street, Chilanzar District, Tashkent 100043, Uzbekistan",
  phone: "+998 71 200 03 06",
  email: "info@millatumidi.uz",
};
