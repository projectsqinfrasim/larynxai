import "dotenv/config";
import express, { Request, Response } from "express";
import { GradiumClient, TtsStream } from "@larynxai/shared";

const PORT = parseInt(process.env.PORT ?? "3002", 10);
const app = express();
app.use(express.json());

const gradium = new GradiumClient();

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "tts-service", ts: Date.now() });
});

/**
 * POST /synthesize
 * Body: { text: string, voiceId?: string, voice?: string }
 * Returns: { audioB64: string }  — base64-encoded WAV
 */
app.post("/synthesize", async (req: Request, res: Response): Promise<void> => {
  const { text, voiceId, voice } = req.body as {
    text?: string;
    voiceId?: string;
    voice?: string;
  };

  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const stream = new TtsStream(gradium, {
    outputFormat: "wav",
    voiceId,
    voice,
  });

  try {
    const audioBuffer = await stream.synthesize(text);
    res.json({ audioB64: audioBuffer.toString("base64") });
  } catch (err) {
    const message = err instanceof Error ? err.message : "tts error";
    res.status(502).json({ error: message });
  } finally {
    stream.close();
  }
});

/**
 * POST /voices — list available Gradium voices
 */
app.get("/voices", async (_req: Request, res: Response): Promise<void> => {
  try {
    const voices = await gradium.httpGet<unknown>("voices");
    res.json(voices);
  } catch (err) {
    const message = err instanceof Error ? err.message : "error fetching voices";
    res.status(502).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`[tts-service] listening on port ${PORT}`);
});
