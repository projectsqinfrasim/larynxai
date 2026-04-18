import WebSocket from "ws";
import type { GradiumClient } from "./client.js";
import type { TextWithTimestamps, AudioInputFormat } from "../types/index.js";

export interface SttStreamOptions {
  modelName?: string;
  inputFormat?: AudioInputFormat;
  jsonConfig?: Record<string, unknown>;
}

export interface SttMessage {
  type: "ready" | "text" | "step" | "flushed" | "error";
  text?: string;
  start_s?: number;
  stop_s?: number;
  vad?: unknown[];
  flush_id?: number;
  message?: string;
  code?: string;
}

/** Wraps a Gradium STT WebSocket stream */
export class SttStream {
  private ws: WebSocket;
  private ready = false;
  private readonly readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (err: Error) => void;

  constructor(client: GradiumClient, options: SttStreamOptions = {}) {
    this.ws = client.openSocket("speech/asr");

    this.readyPromise = new Promise((res, rej) => {
      this.readyResolve = res;
      this.readyReject = rej;
    });

    this.ws.once("open", () => {
      const setup = {
        type: "setup",
        model_name: options.modelName ?? "default",
        input_format: options.inputFormat ?? "pcm",
        ...(options.jsonConfig
          ? { json_config: JSON.stringify(options.jsonConfig) }
          : {}),
      };
      this.ws.send(JSON.stringify(setup));
    });

    this.ws.on("message", (raw: WebSocket.RawData) => {
      const msg: SttMessage = JSON.parse(raw.toString());
      if (msg.type === "ready" && !this.ready) {
        this.ready = true;
        this.readyResolve();
      }
    });

    this.ws.once("error", (err: Error) => {
      if (!this.ready) this.readyReject(err);
    });
  }

  /** Wait until the server confirms readiness */
  waitForReady(): Promise<void> {
    return this.readyPromise;
  }

  /** Send a PCM audio chunk (base64-encoded) */
  sendAudio(pcmBytes: Buffer): void {
    const payload = {
      type: "audio",
      audio: pcmBytes.toString("base64"),
    };
    this.ws.send(JSON.stringify(payload));
  }

  /** Signal end of audio input */
  sendEos(): void {
    this.ws.send(JSON.stringify({ type: "end_of_stream" }));
  }

  /** Flush buffered audio with a flush ID */
  sendFlush(flushId = 0): void {
    this.ws.send(JSON.stringify({ type: "flush", flush_id: flushId }));
  }

  /** Iterate over transcription text segments */
  async *iterText(): AsyncGenerator<TextWithTimestamps> {
    for await (const msg of this.iterMessages()) {
      if (msg.type === "text" && msg.text !== undefined) {
        yield {
          text: msg.text,
          startS: msg.start_s ?? 0,
          stopS: msg.stop_s ?? msg.start_s ?? 0,
        };
      }
    }
  }

  /** Iterate over all raw STT messages */
  iterMessages(): AsyncGenerator<SttMessage> {
    const ws = this.ws;
    return (async function* () {
      const queue: SttMessage[] = [];
      let done = false;
      let resolveNext: (() => void) | null = null;

      ws.on("message", (raw: WebSocket.RawData) => {
        const msg: SttMessage = JSON.parse(raw.toString());
        if (msg.type === "error") {
          done = true;
        }
        queue.push(msg);
        resolveNext?.();
        resolveNext = null;
      });

      ws.once("close", () => {
        done = true;
        resolveNext?.();
        resolveNext = null;
      });

      while (!done || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((res) => {
            resolveNext = res;
          });
        }
        const item = queue.shift();
        if (item) {
          if (item.type === "error") {
            throw new Error(
              `Gradium STT error: ${item.message} (${item.code})`
            );
          }
          yield item;
        }
      }
    })();
  }

  close(): void {
    this.ws.close();
  }
}
