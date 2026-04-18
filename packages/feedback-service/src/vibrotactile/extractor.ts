/**
 * Speech feature extraction from raw PCM (24 kHz, 16-bit, mono).
 *
 * Extracted features per frame (20 ms, 480 samples at 24 kHz):
 *  - rms:     Root-mean-square amplitude (0–1 normalised)
 *  - voicing: Estimated voicing probability (0=unvoiced, 1=voiced)
 *  - f0:      Estimated fundamental frequency in Hz (0 if unvoiced)
 *  - zcr:     Zero-crossing rate (breathiness proxy)
 */

export interface SpeechFrame {
  /** Frame index */
  index: number;
  /** Centre time in seconds */
  timeS: number;
  /** RMS amplitude 0–1 */
  rms: number;
  /** Voicing probability 0–1 */
  voicing: number;
  /** Fundamental frequency estimate in Hz (0 when unvoiced) */
  f0: number;
  /** Zero-crossing rate (0–1 normalised) */
  zcr: number;
}

const SAMPLE_RATE = 24000;
const FRAME_SIZE = 480;   // 20 ms
const HOP_SIZE = 240;     // 10 ms

/** Convert int16 PCM buffer to normalised float32 samples */
function pcmToFloat(pcm: Buffer): Float32Array {
  const samples = new Float32Array(pcm.length / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = pcm.readInt16LE(i * 2) / 32768;
  }
  return samples;
}

/** Compute RMS of a float32 frame */
function rms(frame: Float32Array): number {
  let sum = 0;
  for (const s of frame) sum += s * s;
  return Math.sqrt(sum / frame.length);
}

/** Zero-crossing rate (normalised 0–1) */
function zeroCrossingRate(frame: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < frame.length; i++) {
    if (frame[i - 1] * frame[i] < 0) crossings++;
  }
  return crossings / frame.length;
}

/**
 * Autocorrelation-based F0 estimation.
 * Searches for peaks in the 70–500 Hz range.
 * Returns 0 if unvoiced.
 */
function estimateF0(frame: Float32Array): number {
  const minLag = Math.floor(SAMPLE_RATE / 500); // 500 Hz upper
  const maxLag = Math.floor(SAMPLE_RATE / 70);  // 70  Hz lower

  let bestLag = 0;
  let bestAcf = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let acf = 0;
    for (let i = 0; i < frame.length - lag; i++) {
      acf += frame[i] * frame[i + lag];
    }
    if (acf > bestAcf) {
      bestAcf = acf;
      bestLag = lag;
    }
  }

  // Normalise against zero-lag energy
  let energy = 0;
  for (const s of frame) energy += s * s;
  const normAcf = energy > 0 ? bestAcf / energy : 0;

  // If normalised peak is strong enough, declare voiced
  if (normAcf > 0.3 && bestLag > 0) {
    return SAMPLE_RATE / bestLag;
  }
  return 0;
}

/** Extract per-frame speech features from a PCM buffer */
export function extractFeatures(pcm: Buffer): SpeechFrame[] {
  const samples = pcmToFloat(pcm);
  const frames: SpeechFrame[] = [];

  for (
    let start = 0, idx = 0;
    start + FRAME_SIZE <= samples.length;
    start += HOP_SIZE, idx++
  ) {
    const frame = samples.subarray(start, start + FRAME_SIZE);
    const frameRms = rms(frame);
    const frameZcr = zeroCrossingRate(frame);
    const frameF0 = frameRms > 0.005 ? estimateF0(frame) : 0;
    const voicing = frameF0 > 0 ? Math.min(1, frameRms * 10) : 0;

    frames.push({
      index: idx,
      timeS: start / SAMPLE_RATE,
      rms: Math.min(1, frameRms),
      voicing,
      f0: frameF0,
      zcr: frameZcr,
    });
  }

  return frames;
}

/** Aggregate frame-level features into utterance-level statistics */
export interface UtteranceFeatures {
  meanRms: number;
  maxRms: number;
  meanVoicing: number;
  meanF0: number;
  /** Voiced frame ratio */
  voicedRatio: number;
  /** Breath index: high ZCR in voiced frames → breathier voice */
  breathIndex: number;
  frames: SpeechFrame[];
}

export function aggregateFeatures(frames: SpeechFrame[]): UtteranceFeatures {
  if (frames.length === 0) {
    return {
      meanRms: 0,
      maxRms: 0,
      meanVoicing: 0,
      meanF0: 0,
      voicedRatio: 0,
      breathIndex: 0,
      frames,
    };
  }

  const voicedFrames = frames.filter((f) => f.voicing > 0.5);
  const meanRms = frames.reduce((a, f) => a + f.rms, 0) / frames.length;
  const maxRms = Math.max(...frames.map((f) => f.rms));
  const meanVoicing =
    frames.reduce((a, f) => a + f.voicing, 0) / frames.length;
  const meanF0 =
    voicedFrames.length > 0
      ? voicedFrames.reduce((a, f) => a + f.f0, 0) / voicedFrames.length
      : 0;
  const voicedRatio = voicedFrames.length / frames.length;
  const breathIndex =
    voicedFrames.length > 0
      ? voicedFrames.reduce((a, f) => a + f.zcr, 0) / voicedFrames.length
      : 0;

  return { meanRms, maxRms, meanVoicing, meanF0, voicedRatio, breathIndex, frames };
}
