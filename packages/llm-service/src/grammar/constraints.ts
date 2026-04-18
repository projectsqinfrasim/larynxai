import type { TrainingLevel } from "@larynxai/shared";

/**
 * Grammar constraints define what linguistic structures are allowed
 * at each training level. At lower levels the output space is narrow
 * and clinically safe; it expands as the user gains control.
 */
export interface GrammarConstraint {
  level: TrainingLevel;
  /** Maximum number of words per phrase */
  maxWords: number;
  /** Whether multi-clause sentences are allowed */
  allowComplexSentences: boolean;
  /** Whether voiceless consonants are introduced */
  allowVoiceless: boolean;
  /** Whether rising/falling intonation contrasts are drilled */
  allowProsodyContrasts: boolean;
  /** Brief description shown to the LLM as system guidance */
  systemHint: string;
}

export const GRAMMAR_CONSTRAINTS: Record<TrainingLevel, GrammarConstraint> = {
  1: {
    level: 1,
    maxWords: 1,
    allowComplexSentences: false,
    allowVoiceless: false,
    allowProsodyContrasts: false,
    systemHint:
      "Focus only on sustained voiced sounds and single vowels. No words with voiceless consonants. Simple, safe, grounded phonation.",
  },
  2: {
    level: 2,
    maxWords: 2,
    allowComplexSentences: false,
    allowVoiceless: false,
    allowProsodyContrasts: false,
    systemHint:
      "Introduce single voiced words. All consonants should be voiced. Avoid clusters or blends.",
  },
  3: {
    level: 3,
    maxWords: 4,
    allowComplexSentences: false,
    allowVoiceless: true,
    allowProsodyContrasts: false,
    systemHint:
      "Short phrases of 2–4 words. May include some voiceless consonants. Natural stress but no complex intonation patterns.",
  },
  4: {
    level: 4,
    maxWords: 10,
    allowComplexSentences: false,
    allowVoiceless: true,
    allowProsodyContrasts: true,
    systemHint:
      "Full simple sentences up to 10 words. May include questions, statements, and requests. Include prosody guidance.",
  },
  5: {
    level: 5,
    maxWords: 30,
    allowComplexSentences: true,
    allowVoiceless: true,
    allowProsodyContrasts: true,
    systemHint:
      "Natural conversational speech. No restrictions. Encourage expressive, varied prosody.",
  },
};

export function getConstraint(level: TrainingLevel): GrammarConstraint {
  return GRAMMAR_CONSTRAINTS[level];
}
