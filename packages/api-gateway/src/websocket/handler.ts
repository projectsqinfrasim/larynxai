import WebSocket from "ws";
import axios from "axios";

const STT_SERVICE_URL = process.env.STT_SERVICE_URL ?? "http://stt-service:3001";
const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL ?? "http://tts-service:3002";
const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL ?? "http://llm-service:3003";
const FEEDBACK_SERVICE_URL =
  process.env.FEEDBACK_SERVICE_URL ?? "http://feedback-service:3004";
const SESSION_SERVICE_URL =
  process.env.SESSION_SERVICE_URL ?? "http://session-service:3005";

/** Message types sent by the client over the gateway WebSocket */
type ClientMessageType =
  | "session.start"   // begin a session
  | "audio.chunk"     // raw base64 PCM audio
  | "audio.end"       // done recording for this attempt
  | "session.end";    // close the session

interface ClientMessage {
  type: ClientMessageType;
  sessionId?: string;
  userId?: string;
  level?: number;
  audio?: string;      // base64 PCM
}

/** Message types sent by the gateway back to the client */
type ServerMessageType =
  | "session.created"
  | "phrase.prompt"
  | "tts.audio"
  | "stt.result"
  | "feedback"
  | "error";

interface ServerMessage {
  type: ServerMessageType;
  [key: string]: unknown;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Handle a single client WebSocket connection.
 * Orchestrates the STT → LLM → TTS → Feedback pipeline.
 */
export async function handleClientConnection(ws: WebSocket): Promise<void> {
  let sessionId: string | null = null;
  const audioBuffer: Buffer[] = [];

  ws.on("message", async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      send(ws, { type: "error", message: "invalid JSON" });
      return;
    }

    try {
      switch (msg.type) {
        case "session.start": {
          if (!msg.userId) {
            send(ws, { type: "error", message: "userId required" });
            return;
          }
          const { data } = await axios.post(`${SESSION_SERVICE_URL}/sessions`, {
            userId: msg.userId,
            level: msg.level ?? 1,
          });
          sessionId = data.sessionId as string;
          send(ws, { type: "session.created", sessionId });

          // Immediately fetch first training phrase
          await sendNextPhrase(ws, sessionId);
          break;
        }

        case "audio.chunk": {
          if (!msg.audio) return;
          audioBuffer.push(Buffer.from(msg.audio, "base64"));
          break;
        }

        case "audio.end": {
          if (!sessionId) {
            send(ws, { type: "error", message: "no active session" });
            return;
          }
          const pcm = Buffer.concat(audioBuffer);
          audioBuffer.length = 0;

          // 1. Transcribe via STT service
          const { data: sttData } = await axios.post(
            `${STT_SERVICE_URL}/transcribe`,
            { audioB64: pcm.toString("base64") }
          );
          const transcript = sttData.text as string;
          send(ws, { type: "stt.result", transcript });

          // 2. Score and get coaching via LLM service
          const { data: feedbackData } = await axios.post(
            `${LLM_SERVICE_URL}/score`,
            { sessionId, transcript }
          );

          // 3. Extract vibrotactile signals via feedback service
          const { data: hapticData } = await axios.post(
            `${FEEDBACK_SERVICE_URL}/analyze`,
            { audioB64: pcm.toString("base64") }
          );

          // 4. Update session state
          await axios.post(`${SESSION_SERVICE_URL}/sessions/${sessionId}/attempt`, {
            phraseTarget: feedbackData.phraseTarget,
            phraseTranscribed: transcript,
            score: feedbackData.score,
            durationMs: pcm.length / (24000 * 2) * 1000,
          });

          // 5. Send consolidated feedback back to client
          send(ws, {
            type: "feedback",
            sessionId,
            feedback: feedbackData,
            transducers: hapticData.transducers,
          });

          // 6. Advance level if warranted, then prompt next phrase
          if (feedbackData.advanceLevel) {
            await axios.post(
              `${SESSION_SERVICE_URL}/sessions/${sessionId}/advance`
            );
          }
          await sendNextPhrase(ws, sessionId);
          break;
        }

        case "session.end": {
          ws.close();
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal error";
      send(ws, { type: "error", message });
    }
  });
}

async function sendNextPhrase(ws: WebSocket, sessionId: string): Promise<void> {
  // Ask LLM service for the next training prompt
  const { data: promptData } = await axios.post(
    `${LLM_SERVICE_URL}/next-phrase`,
    { sessionId }
  );

  // Synthesize the phrase via TTS service
  const { data: ttsData } = await axios.post(`${TTS_SERVICE_URL}/synthesize`, {
    text: promptData.phrase.text,
  });

  send(ws, {
    type: "phrase.prompt",
    phrase: promptData.phrase,
    instruction: promptData.instruction,
  });

  // Send TTS audio separately so the client can play it
  send(ws, {
    type: "tts.audio",
    audioB64: ttsData.audioB64,
    text: promptData.phrase.text,
  });
}
