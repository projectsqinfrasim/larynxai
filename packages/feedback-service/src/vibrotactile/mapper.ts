import type { TransducerSignal } from "@larynxai/shared";
import type { UtteranceFeatures } from "./extractor.js";

/**
 * Maps utterance-level speech features to vibrotactile control signals
 * for three neck transducer zones.
 *
 * Zone model:
 *  central  — low-frequency voicing resonance; strongest during voiced, low-F0 speech
 *  left     — breathiness / high-frequency energy; active for breathy or whispery voice
 *  right    — rhythmic pulse; mirrors amplitude envelope beat
 *
 * All intensities are 0–1. Frequencies reflect comfortable vibrotactile ranges
 * (typically 20–300 Hz for perception through skin).
 */
export function mapToTransducers(features: UtteranceFeatures): TransducerSignal[] {
  const { meanRms, meanVoicing, meanF0, breathIndex, voicedRatio } = features;

  // ── Central transducer ────────────────────────────────────────────────────
  // Encodes grounded vocal production: amplitude × voicing, tuned to F0.
  // Low F0 → stronger central sensation to reinforce chest resonance.
  const centralIntensity = clamp(meanRms * meanVoicing * 1.5);
  // Map F0 (70–300 Hz) onto vibration range (30–120 Hz)
  const centralFreq = meanF0 > 0 ? clamp((meanF0 - 70) / 230) * 90 + 30 : 40;

  // ── Left transducer (breathiness indicator) ───────────────────────────────
  // High ZCR in voiced frames indicates breathiness / air escape.
  // Active when voice is breathy or aspirated; localized laterally to help
  // the user distinguish breathiness from clean voicing.
  const leftIntensity = clamp(breathIndex * 4 * meanRms);
  const leftFreq = 100 + breathIndex * 100; // 100–200 Hz breathiness band

  // ── Right transducer (rhythmic amplitude pulse) ───────────────────────────
  // Mirrors the RMS envelope to give a rhythmic pulse of vocal effort.
  // Helps users develop temporal patterning and pacing.
  const rightIntensity = clamp(meanRms * (voicedRatio + 0.2) * 1.2);
  const rightFreq = 60; // Fixed low pulse for rhythm

  return [
    { zone: "central", intensity: centralIntensity, frequencyHz: centralFreq },
    { zone: "left",    intensity: leftIntensity,    frequencyHz: leftFreq },
    { zone: "right",   intensity: rightIntensity,   frequencyHz: rightFreq },
  ];
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}
