const BLOCKED = [
  "ass", "asshole", "bastard", "bitch", "bollocks", "cock", "crap", "cunt",
  "damn", "dick", "dyke", "fag", "faggot", "fuck", "fucker", "fucking",
  "hell", "homo", "idiot", "jerk", "kill", "nazi", "nigga", "nigger",
  "piss", "porn", "pussy", "rape", "sex", "shit", "slut", "stupid",
  "tit", "twat", "wank", "whore",
];

export function normalizeNickname(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

export function nicknameError(raw: string): string | null {
  const name = normalizeNickname(raw);
  if (name.length < 3 || name.length > 16) return "Pick a nickname between 3 and 16 characters.";
  if (!/^[A-Za-z0-9 _.-]+$/.test(name)) return "Use letters, numbers, spaces, _ or - only.";
  const compact = name.toLowerCase().replace(/[\s._-]/g, "");
  for (const word of BLOCKED) {
    if (compact.includes(word)) return "That nickname isn’t allowed. Try a friendlier one!";
  }
  return null;
}
