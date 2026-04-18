import "dotenv/config";
import express, { Request, Response } from "express";
import { extractFeatures, aggregateFeatures } from "./vibrotactile/extractor.js";
import { mapToTransducers } from "./vibrotactile/mapper.js";
import { createBinauralFeedback } from "./binaural/panner.js";

const PORT = parseInt(process.env.PORT ?? "3004", 10);
const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "feedback-service", ts: Date.now() });
});

/**
 * POST /analyze
 * Body: { audioB64: string, ttsAudioB64?: string }
 *   audioB64:    base64 PCM 24 kHz int16 mono — user's recorded speech
 *   ttsAudioB64: base64 WAV mono — TTS reference audio to apply binaural panning
 * Returns: { transducers: TransducerSignal[], binauralAudioB64?: string, features: UtteranceFeatures }
 */
app.post("/analyze", async (req: Request, res: Response): Promise<void> => {
  const { audioB64, ttsAudioB64 } = req.body as {
    audioB64?: string;
    ttsAudioB64?: string;
  };

  if (!audioB64) {
    res.status(400).json({ error: "audioB64 is required" });
    return;
  }

  try {
    const pcm = Buffer.from(audioB64, "base64");
    const frames = extractFeatures(pcm);
    const features = aggregateFeatures(frames);
    const transducers = mapToTransducers(features);

    let binauralAudioB64: string | undefined;
    if (ttsAudioB64) {
      const monoWav = Buffer.from(ttsAudioB64, "base64");
      const stereoWav = createBinauralFeedback(
        monoWav,
        features.meanVoicing,
        features.breathIndex
      );
      binauralAudioB64 = stereoWav.toString("base64");
    }

    // Strip raw frames from response to keep payload small
    const { frames: _frames, ...featuresCompact } = features;

    res.json({
      transducers,
      binauralAudioB64,
      features: featuresCompact,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "analysis error";
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`[feedback-service] listening on port ${PORT}`);
});
