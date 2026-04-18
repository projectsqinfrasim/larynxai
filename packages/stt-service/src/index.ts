import "dotenv/config";
import express, { Request, Response } from "express";
import { GradiumClient, SttStream } from "@larynxai/shared";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const app = express();
app.use(express.json({ limit: "50mb" }));

const gradium = new GradiumClient();

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "stt-service", ts: Date.now() });
});

/**
 * POST /transcribe
 * Body: { audioB64: string }  — base64-encoded PCM 24 kHz mono int16
 * Returns: { text: string, segments: TextWithTimestamps[] }
 */
app.post("/transcribe", async (req: Request, res: Response): Promise<void> => {
  const { audioB64 } = req.body as { audioB64?: string };
  if (!audioB64) {
    res.status(400).json({ error: "audioB64 is required" });
    return;
  }

  const pcm = Buffer.from(audioB64, "base64");

  const stream = new SttStream(gradium, { inputFormat: "pcm" });
  try {
    await stream.waitForReady();

    // Send PCM in 1920-byte chunks (80 ms at 24 kHz int16)
    const CHUNK = 1920;
    for (let offset = 0; offset < pcm.length; offset += CHUNK) {
      stream.sendAudio(pcm.subarray(offset, offset + CHUNK));
    }
    stream.sendEos();

    const segments: { text: string; startS: number; stopS: number }[] = [];
    for await (const seg of stream.iterText()) {
      segments.push(seg);
    }

    const text = segments.map((s) => s.text).join(" ").trim();
    res.json({ text, segments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "stt error";
    res.status(502).json({ error: message });
  } finally {
    stream.close();
  }
});

app.listen(PORT, () => {
  console.log(`[stt-service] listening on port ${PORT}`);
});
