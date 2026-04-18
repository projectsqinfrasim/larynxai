import type { TrainingPhrase, TrainingLevel } from "@larynxai/shared";

/**
 * Curated phrase bank organized by training level.
 * Level 1: Sustained vowels and simple voiced sounds (safest for early rehab)
 * Level 2: Monosyllabic words with clear voiced consonants
 * Level 3: Short 2–3 word phrases targeting resonance and rhythm
 * Level 4: Full sentences with varied prosody
 * Level 5: Natural conversational sentences
 */
export const PHRASE_BANK: TrainingPhrase[] = [
  // ── Level 1 ──────────────────────────────────────────────────────────────
  {
    id: "l1-001",
    text: "Mmm",
    level: 1,
    tags: ["voiced", "nasal", "hum"],
    hint: "Sustain a gentle hum with lips together. Feel vibration at the front of the face.",
  },
  {
    id: "l1-002",
    text: "Ahh",
    level: 1,
    tags: ["vowel", "open", "voiced"],
    hint: "Open throat vowel. Aim for a relaxed, grounded tone.",
  },
  {
    id: "l1-003",
    text: "Oh",
    level: 1,
    tags: ["vowel", "rounded", "voiced"],
    hint: "Rounded lips, feel chest resonance.",
  },
  {
    id: "l1-004",
    text: "Eee",
    level: 1,
    tags: ["vowel", "front", "voiced"],
    hint: "High front vowel, feel facial resonance.",
  },

  // ── Level 2 ──────────────────────────────────────────────────────────────
  {
    id: "l2-001",
    text: "Hello",
    level: 2,
    tags: ["voiced", "lateral", "bilabial"],
    hint: "Voiced /h/ into open vowel. Keep the voice grounded.",
  },
  {
    id: "l2-002",
    text: "Home",
    level: 2,
    tags: ["voiced", "nasal"],
    hint: "End on a resonant nasal. Feel the /m/ buzz.",
  },
  {
    id: "l2-003",
    text: "More",
    level: 2,
    tags: ["voiced", "nasal", "rhotic"],
    hint: "Nasal onset then open resonance.",
  },
  {
    id: "l2-004",
    text: "Love",
    level: 2,
    tags: ["voiced", "lateral", "fricative"],
    hint: "Notice the voiced /v/ at the end.",
  },

  // ── Level 3 ──────────────────────────────────────────────────────────────
  {
    id: "l3-001",
    text: "Good morning",
    level: 3,
    tags: ["voiced", "plosive", "nasal"],
    hint: "Two-word phrase with a voiced nasal ending. Natural stress on first syllable.",
  },
  {
    id: "l3-002",
    text: "How are you",
    level: 3,
    tags: ["voiced", "fricative", "question"],
    hint: "Rising intonation on 'you'. Keep voicing continuous.",
  },
  {
    id: "l3-003",
    text: "Thank you",
    level: 3,
    tags: ["voiced", "nasal"],
    hint: "Soft and warm. End with a resonant nasal.",
  },
  {
    id: "l3-004",
    text: "I am here",
    level: 3,
    tags: ["vowel", "voiced", "declarative"],
    hint: "All voiced. Consistent resonance throughout.",
  },

  // ── Level 4 ──────────────────────────────────────────────────────────────
  {
    id: "l4-001",
    text: "I would like a glass of water",
    level: 4,
    tags: ["voiced", "functional", "request"],
    hint: "Functional sentence. Aim for smooth voicing with natural stress on 'water'.",
  },
  {
    id: "l4-002",
    text: "My name is important to me",
    level: 4,
    tags: ["voiced", "identity", "emphatic"],
    hint: "Slight emphasis on 'important'. Maintain grounded tone.",
  },
  {
    id: "l4-003",
    text: "The morning light feels warm today",
    level: 4,
    tags: ["voiced", "descriptive", "resonant"],
    hint: "Rich in voiced consonants. Let resonance guide the melody.",
  },

  // ── Level 5 ──────────────────────────────────────────────────────────────
  {
    id: "l5-001",
    text: "I have been working on finding my voice and it has been a meaningful journey",
    level: 5,
    tags: ["voiced", "narrative", "personal"],
    hint: "Personal narrative. Natural pacing and intonation.",
  },
  {
    id: "l5-002",
    text: "Every day I practice and every day my voice becomes more my own",
    level: 5,
    tags: ["voiced", "motivational", "progressive"],
    hint: "Rhythmic structure. Let the prosody build naturally.",
  },
];

/** Return all phrases for a given training level */
export function getPhrasesByLevel(level: TrainingLevel): TrainingPhrase[] {
  return PHRASE_BANK.filter((p) => p.level === level);
}

/** Return a random phrase for a given level */
export function getRandomPhrase(level: TrainingLevel): TrainingPhrase {
  const phrases = getPhrasesByLevel(level);
  if (phrases.length === 0) {
    // Fall back to level 1 if none available
    return PHRASE_BANK[0];
  }
  return phrases[Math.floor(Math.random() * phrases.length)];
}
