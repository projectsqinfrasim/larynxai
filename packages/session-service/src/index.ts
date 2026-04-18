import "dotenv/config";
import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { TrainingLevel, AttemptRecord } from "@larynxai/shared";
import { SessionStore } from "./store/redis.js";

const PORT = parseInt(process.env.PORT ?? "3005", 10);
const app = express();
app.use(express.json());

const store = new SessionStore();

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "session-service", ts: Date.now() });
});

/** POST /sessions — create a new session */
app.post("/sessions", async (req: Request, res: Response): Promise<void> => {
  const { userId, level } = req.body as {
    userId?: string;
    level?: TrainingLevel;
  };
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const session = {
    sessionId: uuidv4(),
    userId,
    level: (level ?? 1) as TrainingLevel,
    attemptsTotal: 0,
    attemptsSuccessful: 0,
    recentAttempts: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await store.save(session);
  res.status(201).json(session);
});

/** GET /sessions/:id */
app.get("/sessions/:id", async (req: Request, res: Response): Promise<void> => {
  const session = await store.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  res.json(session);
});

/** DELETE /sessions/:id */
app.delete("/sessions/:id", async (req: Request, res: Response): Promise<void> => {
  await store.delete(req.params.id);
  res.status(204).send();
});

/** POST /sessions/:id/attempt — record a training attempt */
app.post(
  "/sessions/:id/attempt",
  async (req: Request, res: Response): Promise<void> => {
    const attempt = req.body as Partial<AttemptRecord>;
    if (!attempt.phraseTarget || attempt.score === undefined) {
      res.status(400).json({ error: "phraseTarget and score are required" });
      return;
    }

    const record: AttemptRecord = {
      phraseTarget: attempt.phraseTarget,
      phraseTranscribed: attempt.phraseTranscribed ?? "",
      score: attempt.score,
      durationMs: attempt.durationMs ?? 0,
      attemptedAt: Date.now(),
    };

    const updated = await store.recordAttempt(req.params.id, record);
    if (!updated) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json(updated);
  }
);

/** POST /sessions/:id/advance — advance training level */
app.post(
  "/sessions/:id/advance",
  async (req: Request, res: Response): Promise<void> => {
    const updated = await store.advanceLevel(req.params.id);
    if (!updated) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json(updated);
  }
);

store
  .connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[session-service] listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to Redis:", err);
    process.exit(1);
  });
