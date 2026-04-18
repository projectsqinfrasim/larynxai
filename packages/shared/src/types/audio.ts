/** Audio format accepted by Gradium STT */
export type AudioInputFormat = "wav" | "pcm" | "ogg" | "mp3" | "flac";

/** Audio format produced by Gradium TTS */
export type AudioOutputFormat = "wav" | "pcm" | "ogg" | "mp3";

/** 24 kHz mono int16 PCM chunk */
export interface PcmChunk {
  /** Raw PCM bytes at 24 kHz, 16-bit, mono */
  data: Buffer;
  /** Wall-clock timestamp (ms) when the chunk was captured */
  capturedAt: number;
}

/** Text segment with word-level timing from Gradium */
export interface TextWithTimestamps {
  text: string;
  startS: number;
  stopS: number;
}

/** Gradium TTS setup payload */
export interface TtsSetup {
  type: "setup";
  model_name?: string;
  voice?: string;
  voice_id?: string;
  output_format?: AudioOutputFormat;
  json_config?: string;
}

/** Gradium STT setup payload */
export interface SttSetup {
  type: "setup";
  model_name?: string;
  input_format?: AudioInputFormat;
  json_config?: string;
}
