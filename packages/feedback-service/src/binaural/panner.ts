/**
 * Binaural audio panning.
 *
 * Takes a mono WAV buffer and produces a stereo WAV buffer where the
 * left/right channel balance is controlled by an azimuth angle.
 *
 * This is a simplified equal-power HRTF approximation suitable for
 * providing spatialized auditory feedback:
 *   azimuth = -90  → fully left
 *   azimuth =   0  → centre
 *   azimuth = +90  → fully right
 *
 * The feedback-service uses this to spatialize different voice components
 * so users can differentiate vocal qualities by perceived location.
 */

const WAV_HEADER_SIZE = 44;

/** Parse a minimal PCM WAV header (16-bit, mono) */
function parseWavHeader(wav: Buffer): {
  sampleRate: number;
  numSamples: number;
  dataOffset: number;
} {
  const sampleRate = wav.readUInt32LE(24);
  const dataSize = wav.readUInt32LE(40);
  return { sampleRate, numSamples: dataSize / 2, dataOffset: WAV_HEADER_SIZE };
}

/** Write a minimal stereo PCM WAV header */
function writeWavHeader(
  buf: Buffer,
  numSamples: number,
  sampleRate: number
): void {
  const dataSize = numSamples * 2 * 2; // stereo, 16-bit
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);       // PCM chunk size
  buf.writeUInt16LE(1, 20);        // PCM format
  buf.writeUInt16LE(2, 22);        // stereo
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2 * 2, 28); // byte rate
  buf.writeUInt16LE(4, 32);        // block align
  buf.writeUInt16LE(16, 34);       // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
}

/**
 * Apply equal-power panning to a mono WAV buffer.
 * Returns a stereo WAV buffer.
 *
 * @param monoWav   Buffer containing a 16-bit mono PCM WAV file
 * @param azimuth   Panning angle in degrees (-90 to +90)
 */
export function panWav(monoWav: Buffer, azimuth: number): Buffer {
  const { sampleRate, numSamples, dataOffset } = parseWavHeader(monoWav);

  // Equal-power law: gain_L = cos(θ), gain_R = sin(θ)
  const theta = ((azimuth + 90) / 180) * (Math.PI / 2);
  const gainL = Math.cos(theta);
  const gainR = Math.sin(theta);

  const outBuf = Buffer.allocUnsafe(WAV_HEADER_SIZE + numSamples * 4);
  writeWavHeader(outBuf, numSamples, sampleRate);

  for (let i = 0; i < numSamples; i++) {
    const sample = monoWav.readInt16LE(dataOffset + i * 2);
    const l = Math.round(sample * gainL);
    const r = Math.round(sample * gainR);
    outBuf.writeInt16LE(clamp16(l), WAV_HEADER_SIZE + i * 4);
    outBuf.writeInt16LE(clamp16(r), WAV_HEADER_SIZE + i * 4 + 2);
  }

  return outBuf;
}

/**
 * Create a binaural mix:
 *  - Voiced components are centred (azimuth 0)
 *  - Breathy/high-frequency components are shifted to the left (azimuth -30)
 *  - The overall signal is available at azimuth 0 as well
 *
 * For now this just pans the mono signal at the requested azimuth.
 * A full HRTF implementation would convolve with head-related impulse responses.
 */
export function createBinauralFeedback(
  monoWav: Buffer,
  voicingLevel: number, // 0–1
  breathIndex: number   // 0–1
): Buffer {
  // Place grounded voice at centre; breathy voice shifts left
  const azimuth = -(breathIndex * 30); // 0° to -30°
  return panWav(monoWav, azimuth);
}

function clamp16(v: number): number {
  return Math.max(-32768, Math.min(32767, v));
}
