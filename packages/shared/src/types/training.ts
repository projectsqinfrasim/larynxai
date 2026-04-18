import type { TrainingLevel } from "./session.js";

/** A single training phrase with metadata */
export interface TrainingPhrase {
  id: string;
  text: string;
  level: TrainingLevel;
  /** Phonetic category tags e.g. ["voiced", "fricative"] */
  tags: string[];
  /** Clinical focus hint */
  hint?: string;
}

/** LLM-generated training prompt for the current session step */
export interface TrainingPrompt {
  phrase: TrainingPhrase;
  instruction: string;    // What the user should do
  targetVoiceQuality: string;
}

/** Feedback from scoring a user's attempt */
export interface AttemptFeedback {
  score: number;          // 0–1
  similarity: number;     // word-level similarity
  comment: string;        // LLM-generated coaching comment
  advanceLevel: boolean;  // should the user move to next level?
}

/** Vibrotactile transducer zone on the neck */
export type TransducerZone = "central" | "left" | "right";

/** Control signal for a single vibrotactile transducer */
export interface TransducerSignal {
  zone: TransducerZone;
  intensity: number;      // 0–1
  frequencyHz: number;    // Vibration frequency
}

/** Full feedback packet sent back to the client after each attempt */
export interface FeedbackPacket {
  sessionId: string;
  attempt: number;
  /** Binaural TTS audio (base64-encoded WAV bytes) */
  binauralAudioB64?: string;
  /** Vibrotactile signals for each transducer zone */
  transducers: TransducerSignal[];
  feedback: AttemptFeedback;
}
