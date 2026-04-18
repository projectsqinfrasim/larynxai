import "dotenv/config";
import express, { Request, Response } from "express";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import axios from "axios";
import type { TrainingLevel } from "@larynxai/shared";
import { getRandomPhrase } from "./grammar/phrases.js";
import { getConstraint } from "./grammar/constraints.js";

const PORT = parseInt(process.env.PORT ?? "3003", 10);
const SESSION_SERVICE_URL =
  process.env.SESSION_SERVICE_URL ?? "http://session-service:3005";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const LLM_MODEL = process.env.LLM_MODEL ?? "qwen2.5:3b";

const app = express();
app.use(express.json());

/** Invoke the LLM and parse JSON from the response */
async function invokeJson<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.6
): Promise<T> {
  const llm = new ChatOllama({
    baseUrl: OLLAMA_BASE_URL,
    model: LLM_MODEL,
    temperature,
    format: "json",
  });

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  const text =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  return JSON.parse(text) as T;
}

app.get("/health", async (_req: Request, res: Response) => {
  // Ping Ollama to check it's reachable
  try {
    await axios.get(`${OLLAMA_BASE_URL}/api/version`, { timeout: 2000 });
    res.json({ status: "ok", service: "llm-service", model: LLM_MODEL, ts: Date.now() });
  } catch {
    res.status(503).json({ status: "degraded", reason: "ollama unreachable", ts: Date.now() });
  }
});

/**
 * POST /next-phrase
 * Body: { sessionId: string }
 * Returns: { phrase: TrainingPhrase, instruction: string, targetVoiceQuality: string }
 */
app.post("/next-phrase", async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  try {
    const { data: session } = await axios.get(
      `${SESSION_SERVICE_URL}/sessions/${sessionId}`
    );
    const level = (session.level as TrainingLevel) ?? 1;
    const constraint = getConstraint(level);
    const phrase = getRandomPhrase(level);

    const systemPrompt = [
      "You are a clinical voice therapist assistant for LarynxAI.",
      "Your role is to provide concise, encouraging training instructions for each phrase.",
      `Current constraint: ${constraint.systemHint}`,
      "Respond with a JSON object with exactly two keys:",
      '  "instruction": a 1-2 sentence directive for the user (what to focus on while saying the phrase).',
      '  "targetVoiceQuality": a 3-5 word description of the ideal voice output.',
      "Keep language simple, warm, and clinically grounded.",
      "Output only valid JSON. No markdown, no extra text.",
    ].join("\n");

    const userPrompt = `Phrase: "${phrase.text}"\nHint: ${phrase.hint ?? "none"}`;

    const result = await invokeJson<{
      instruction?: string;
      targetVoiceQuality?: string;
    }>(systemPrompt, userPrompt, 0.6);

    res.json({
      phrase,
      instruction: result.instruction ?? phrase.hint ?? "Repeat the phrase clearly.",
      targetVoiceQuality: result.targetVoiceQuality ?? "Grounded, resonant voice",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "llm error";
    res.status(502).json({ error: message });
  }
});

/**
 * POST /score
 * Body: { sessionId: string, transcript: string }
 * Returns: AttemptFeedback + phraseTarget
 */
app.post("/score", async (req: Request, res: Response): Promise<void> => {
  const { sessionId, transcript } = req.body as {
    sessionId?: string;
    transcript?: string;
  };

  if (!sessionId || transcript === undefined) {
    res.status(400).json({ error: "sessionId and transcript are required" });
    return;
  }

  try {
    const { data: session } = await axios.get(
      `${SESSION_SERVICE_URL}/sessions/${sessionId}`
    );
    const level = (session.level as TrainingLevel) ?? 1;
    const constraint = getConstraint(level);

    const recent = session.recentAttempts as
      | { phraseTarget: string }[]
      | undefined;
    const phraseTarget =
      recent && recent.length > 0
        ? recent[recent.length - 1].phraseTarget
        : transcript;

    const systemPrompt = [
      "You are a clinical voice therapist scoring a voice training attempt for LarynxAI.",
      `Training level: ${level}. ${constraint.systemHint}`,
      "Respond with a JSON object with exactly four keys:",
      '  "score": number 0-1 (overall attempt quality; 0=failed, 1=perfect).',
      '  "similarity": number 0-1 (lexical similarity between target and transcription).',
      '  "comment": string of 1-2 sentences of warm, specific coaching feedback.',
      '  "advanceLevel": boolean — true only if score >= 0.85 and performance is consistently strong.',
      "Output only valid JSON. No markdown, no extra text.",
    ].join("\n");

    const userPrompt = `Target phrase: "${phraseTarget}"\nTranscribed: "${transcript}"`;

    const result = await invokeJson<{
      score?: number;
      similarity?: number;
      comment?: string;
      advanceLevel?: boolean;
    }>(systemPrompt, userPrompt, 0.4);

    res.json({
      phraseTarget,
      score: result.score ?? 0,
      similarity: result.similarity ?? 0,
      comment: result.comment ?? "Keep going!",
      advanceLevel: result.advanceLevel ?? false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "scoring error";
    res.status(502).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`[llm-service] listening on port ${PORT} — model: ${LLM_MODEL} @ ${OLLAMA_BASE_URL}`);
});
