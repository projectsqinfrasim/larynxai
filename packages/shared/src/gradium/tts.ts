import WebSocket from "ws";
import type { GradiumClient } from "./client.js";
import type { TextWithTimestamps, AudioOutputFormat } from "../types/index.js";

export interface TtsStreamOptions {
  modelName?: string;
  voice?: string;
  voiceId?: string;
  outputFormat?: AudioOutputFormat;
  jsonConfig?: Record<string, unknown>;
}

export interface TtsMessage {
  type: "ready" | "audio" | "text" | "error";
  audio?: string;           // base64 encoded audio chunk
  text?: string;
  start_s?: number;
  stop_s?: number;
  message?: string;
  code?: string;
}

/** Wraps a Gradium TTS WebSocket stream */
export class TtsStream {
  private ws: WebSocket;
  private ready = false;
  private readonly readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (err: Error) => void;

  constructor(client: GradiumClient, options: TtsStreamOptions = {}) {
    this.ws = client.openSocket("speech/tts");

    this.readyPromise = new Promise((res, rej) => {
      this.readyResolve = res;
      this.readyReject = rej;
    });

    this.ws.once("open", () => {
      const setup = {
        type: "setup",
        model_name: options.modelName ?? "default",
        output_format: options.outputFormat ?? "wav",
        ...(options.voiceId
          ? { voice_id: options.voiceId }
          : { voice: options.voice ?? "default" }),
        ...(options.jsonConfig
          ? { json_config: JSON.stringify(options.jsonConfig) }
          : {}),
      };
      this.ws.send(JSON.stringify(setup));
    });

    this.ws.on("message", (raw: WebSocket.RawData) => {
      const msg: TtsMessage = JSON.parse(raw.toString());
      if (msg.type === "ready" && !this.ready) {
        this.ready = true;
        this.readyResolve();
      }
    });

    this.ws.once("error", (err: Error) => {
      if (!this.ready) this.readyReject(err);
    });
  }

  waitForReady(): Promise<void> {
    return this.readyPromise;
  }

  /** Send a text chunk to synthesize */
  sendText(text: string, clientReqId?: string): void {
    const payload: Record<string, string> = { type: "text", text };
    if (clientReqId) payload.client_req_id = clientReqId;
    this.ws.send(JSON.stringify(payload));
  }

  /** Signal end of text input */
  sendEos(clientReqId?: string): void {
    const payload: Record<string, string> = { type: "end_of_stream" };
    if (clientReqId) payload.client_req_id = clientReqId;
    this.ws.send(JSON.stringify(payload));
  }

  /** Iterate over audio chunks (raw Buffer) */
  async *iterAudio(): AsyncGenerator<Buffer> {
    for await (const msg of this.iterMessages()) {
      if (msg.type === "audio" && msg.audio) {
        yield Buffer.from(msg.audio, "base64");
      }
    }
  }

  /** Iterate over text timing segments */
  async *iterText(): AsyncGenerator<TextWithTimestamps> {
    for await (const msg of this.iterMessages()) {
      if (msg.type === "text" && msg.text) {
        yield {
          text: msg.text,
          startS: msg.start_s ?? 0,
          stopS: msg.stop_s ?? msg.start_s ?? 0,
        };
      }
    }
  }

  /** Synthesize text fully, collecting all audio into a single Buffer */
  async synthesize(text: string): Promise<Buffer> {
    await this.waitForReady();
    this.sendText(text);
    this.sendEos();

    const chunks: Buffer[] = [];
    for await (const chunk of this.iterAudio()) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /** Iterate over all raw TTS messages */
  iterMessages(): AsyncGenerator<TtsMessage> {
    const ws = this.ws;
    return (async function* () {
      const queue: TtsMessage[] = [];
      let done = false;
      let resolveNext: (() => void) | null = null;

      ws.on("message", (raw: WebSocket.RawData) => {
        const msg: TtsMessage = JSON.parse(raw.toString());
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
              `Gradium TTS error: ${item.message} (${item.code})`
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
