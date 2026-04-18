import { Router, Request, Response } from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import type { StartSessionPayload } from "@larynxai/shared";

const SESSION_SERVICE_URL =
  process.env.SESSION_SERVICE_URL ?? "http://session-service:3005";

const router = Router();

/** POST /sessions — create a new training session */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<StartSessionPayload>;
  if (!body.userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  try {
    const { data } = await axios.post(`${SESSION_SERVICE_URL}/sessions`, {
      userId: body.userId,
      level: body.level ?? 1,
    });
    res.status(201).json(data);
  } catch (err) {
    res.status(502).json({ error: "session-service unavailable" });
  }
});

/** GET /sessions/:id — retrieve session state */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { data } = await axios.get(
      `${SESSION_SERVICE_URL}/sessions/${req.params.id}`
    );
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: "session not found" });
  }
});

export default router;
