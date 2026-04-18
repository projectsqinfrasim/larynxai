import WebSocket from "ws";

const GRADIUM_BASE_WSS = "wss://api.gradium.ai/api";
const GRADIUM_BASE_HTTPS = "https://api.gradium.ai/api";
const SOURCE = "larynxai-ts-client/0.1.0";

export class GradiumClient {
  private readonly apiKey: string;
  private readonly baseWss: string;
  private readonly baseHttps: string;

  constructor(options?: { apiKey?: string; baseUrl?: string }) {
    const key = options?.apiKey ?? process.env.GRADIUM_API_KEY;
    if (!key) {
      throw new Error(
        "Gradium API key is required. Set GRADIUM_API_KEY or pass apiKey option."
      );
    }
    this.apiKey = key;
    const base = options?.baseUrl ?? GRADIUM_BASE_HTTPS;
    this.baseHttps = base.replace(/\/$/, "");
    this.baseWss = this.baseHttps
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");
  }

  get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "x-gradium-source": SOURCE,
    };
  }

  /** Open a WebSocket connection to a Gradium streaming endpoint */
  openSocket(route: string): WebSocket {
    const url = `${this.baseWss}/${route}`;
    return new WebSocket(url, { headers: this.authHeaders });
  }

  /** Make an authenticated HTTP GET request */
  async httpGet<T>(path: string): Promise<T> {
    const url = `${this.baseHttps}/${path}`;
    const res = await fetch(url, {
      headers: {
        ...this.authHeaders,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Gradium HTTP error ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }
}
