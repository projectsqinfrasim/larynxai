# LarynxAI — Front-End Integration Guide

Everything the client talks to lives behind the **api-gateway** on port `3000`. There are two integration surfaces: a REST API for session management, and a WebSocket connection for the real-time audio pipeline.

---

## Base URL

| Environment | Base URL |
|---|---|
| Local (Docker) | `http://localhost:3000` |
| WebSocket | `ws://localhost:3000/ws` |

---

## 1. REST API

### `POST /sessions`

Create a new training session before opening the WebSocket.

**Request body:**
```json
{
  "userId": "user-abc123",
  "level": 1
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | string | ✅ | Your user identifier |
| `level` | 1–5 | ❌ | Starting training level (default: 1) |

**Response `201`:**
```json
{
  "sessionId": "f3a1b2c4-...",
  "userId": "user-abc123",
  "level": 1,
  "attemptsTotal": 0,
  "attemptsSuccessful": 0,
  "recentAttempts": [],
  "createdAt": 1713450000000,
  "updatedAt": 1713450000000
}
```

---

### `GET /sessions/:id`

Retrieve the current state of a session. Useful for resuming a session across page loads.

**Response `200`:**
```json
{
  "sessionId": "f3a1b2c4-...",
  "userId": "user-abc123",
  "level": 2,
  "attemptsTotal": 7,
  "attemptsSuccessful": 5,
  "recentAttempts": [
    {
      "phraseTarget": "Hello, how are you?",
      "phraseTranscribed": "Hello, how are you?",
      "score": 0.92,
      "durationMs": 1800,
      "attemptedAt": 1713450100000
    }
  ]
}
```

---

### `GET /health`

Returns `200 { "status": "ok" }` when the gateway is up. Use this for liveness probes.

---

## 2. WebSocket Pipeline

Open one WebSocket per user session. All real-time communication — audio streaming, transcription results, coaching feedback, TTS playback audio, and haptic signals — flows over this single connection.

```
ws://localhost:3000/ws
```

All messages are **JSON strings** in both directions.

---

### Message Flow Diagram

```
Client                                      Server
  │                                            │
  │── session.start ──────────────────────────▶│  Creates session
  │◀─ session.created ─────────────────────────│
  │◀─ phrase.prompt ────────────────────────────│  First phrase + instructions
  │◀─ tts.audio ────────────────────────────────│  TTS audio of the phrase (WAV base64)
  │                                            │
  │── audio.chunk (×N) ───────────────────────▶│  Stream PCM audio as user speaks
  │── audio.end ───────────────────────────────▶│  Signal end of recording
  │                                            │
  │◀─ stt.result ───────────────────────────────│  Transcription of what was said
  │◀─ feedback ─────────────────────────────────│  Score + coaching + haptic signals
  │◀─ phrase.prompt ────────────────────────────│  Next phrase
  │◀─ tts.audio ────────────────────────────────│  TTS audio of next phrase
  │                                            │
  │── session.end ─────────────────────────────▶│  Closes connection
```

---

### Messages you send (Client → Server)

#### `session.start`

Start the session and receive the first training phrase. **Send this immediately after the WebSocket opens.** Pass the `sessionId` you got from `POST /sessions`.

```json
{
  "type": "session.start",
  "userId": "user-abc123",
  "sessionId": "f3a1b2c4-...",
  "level": 1
}
```

> The `sessionId` field is optional here — if omitted, the gateway creates a new session internally. It is recommended to create the session via REST first so you have the ID before connecting.

---

#### `audio.chunk`

Send raw PCM audio as the user speaks. Call this repeatedly — in real time or in buffered chunks.

```json
{
  "type": "audio.chunk",
  "audio": "<base64-encoded PCM bytes>"
}
```

**Audio format requirements:**
- Sample rate: **24 000 Hz**
- Bit depth: **16-bit signed integer (int16)**
- Channels: **mono**
- Encoding: **raw PCM** (no WAV header)
- Chunk size: any size, but 1920 bytes (80 ms at 24 kHz/16-bit) is recommended

**How to capture from the browser:**

```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const context = new AudioContext({ sampleRate: 24000 });
const source = context.createMediaStreamSource(stream);
const processor = context.createScriptProcessor(4096, 1, 1);

processor.onaudioprocess = (e) => {
  const float32 = e.inputBuffer.getChannelData(0);
  // Convert Float32 [-1, 1] to Int16
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
  }
  const b64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
  ws.send(JSON.stringify({ type: "audio.chunk", audio: b64 }));
};

source.connect(processor);
processor.connect(context.destination);
```

---

#### `audio.end`

Signal that the user has finished speaking. This triggers transcription, scoring, and feedback.

```json
{
  "type": "audio.end"
}
```

---

#### `session.end`

Close the session cleanly.

```json
{
  "type": "session.end"
}
```

---

### Messages you receive (Server → Client)

#### `session.created`

Confirms the session is active.

```json
{
  "type": "session.created",
  "sessionId": "f3a1b2c4-..."
}
```

---

#### `phrase.prompt`

A new training phrase with clinical instructions. Display this to the user before they speak.

```json
{
  "type": "phrase.prompt",
  "phrase": {
    "id": "phrase-042",
    "text": "The sun is warm today.",
    "level": 1,
    "tags": ["voiced", "sonorant"],
    "hint": "Focus on steady airflow through voiced consonants."
  },
  "instruction": "Speak slowly and feel the resonance in your chest. Keep your voice grounded and steady throughout the phrase."
}
```

| Field | Description |
|---|---|
| `phrase.text` | The text the user should say aloud |
| `phrase.level` | Training level (1–5) |
| `phrase.tags` | Phonetic categories for the phrase |
| `phrase.hint` | Clinical focus (internal hint, can be shown or hidden) |
| `instruction` | LLM-generated coaching direction — **show this prominently** |

---

#### `tts.audio`

The phrase spoken aloud by the TTS engine. Play this automatically so the user hears the target voice before attempting it.

```json
{
  "type": "tts.audio",
  "audioB64": "<base64-encoded WAV>",
  "text": "The sun is warm today."
}
```

**How to play in the browser:**

```js
function playTtsAudio(audioB64) {
  const binary = atob(audioB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
}
```

---

#### `stt.result`

The transcription of what the user said. Arrives immediately after `audio.end` is processed.

```json
{
  "type": "stt.result",
  "transcript": "The sun is warm today."
}
```

---

#### `feedback`

The complete result of the attempt: score, coaching comment, and vibrotactile haptic control signals. This arrives after `stt.result`.

```json
{
  "type": "feedback",
  "sessionId": "f3a1b2c4-...",
  "feedback": {
    "phraseTarget": "The sun is warm today.",
    "score": 0.87,
    "similarity": 0.95,
    "comment": "Great resonance on the voiced consonants. Try to sustain the vowel in 'warm' a little longer.",
    "advanceLevel": false
  },
  "transducers": [
    { "zone": "central", "intensity": 0.72, "frequencyHz": 68.4 },
    { "zone": "left",    "intensity": 0.18, "frequencyHz": 132.0 },
    { "zone": "right",   "intensity": 0.55, "frequencyHz": 60.0 }
  ]
}
```

**`feedback` fields:**

| Field | Type | Description |
|---|---|---|
| `score` | 0–1 | Overall attempt quality |
| `similarity` | 0–1 | Word-level match between target and transcription |
| `comment` | string | LLM coaching comment — **show this to the user** |
| `advanceLevel` | boolean | If `true`, the user is ready for the next level |

**`transducers` — vibrotactile haptic signals:**

Three signals, one per neck transducer zone:

| Zone | Purpose | Frequency range |
|---|---|---|
| `central` | Vocal resonance / voicing strength | 30–120 Hz |
| `left` | Breathiness indicator | 100–200 Hz |
| `right` | Rhythmic amplitude pulse | 60 Hz (fixed) |

Each signal has `intensity` (0–1) and `frequencyHz`. Map these to your hardware transducer driver — intensity typically maps to PWM duty cycle or amplitude, frequency to the vibration motor drive frequency.

---

#### `error`

Sent when something goes wrong. Always handle this.

```json
{
  "type": "error",
  "message": "no active session"
}
```

---

## 3. Complete Integration Example

```js
async function startTrainingSession(userId) {
  // 1. Create session via REST
  const res = await fetch("http://localhost:3000/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, level: 1 }),
  });
  const { sessionId } = await res.json();

  // 2. Open WebSocket
  const ws = new WebSocket("ws://localhost:3000/ws");

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "session.start", userId, sessionId }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case "session.created":
        console.log("Session active:", msg.sessionId);
        break;

      case "phrase.prompt":
        // Show phrase text and instruction to the user
        displayPhrase(msg.phrase.text, msg.instruction);
        break;

      case "tts.audio":
        // Play model voice immediately
        playTtsAudio(msg.audioB64);
        break;

      case "stt.result":
        // Show live transcription
        displayTranscript(msg.transcript);
        break;

      case "feedback":
        // Show score + coaching comment
        displayFeedback(msg.feedback.score, msg.feedback.comment);
        // Drive haptic transducers
        driveTransducers(msg.transducers);
        if (msg.feedback.advanceLevel) showLevelUpNotification();
        break;

      case "error":
        console.error("Server error:", msg.message);
        break;
    }
  };

  return { ws, sessionId };
}

// Call this while user is speaking
function sendAudioChunk(ws, int16ArrayBuffer) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(int16ArrayBuffer)));
  ws.send(JSON.stringify({ type: "audio.chunk", audio: b64 }));
}

// Call this when user stops speaking
function endAudio(ws) {
  ws.send(JSON.stringify({ type: "audio.end" }));
}
```

---

## 4. Haptic Hardware Interface

The `transducers` array in `feedback` maps directly to the three neck transducer zones. Your hardware driver should consume `intensity` and `frequencyHz` per zone:

```
Neck diagram (front view):

        [LEFT]   [CENTRAL]   [RIGHT]
           \         |         /
            ─────────┴─────────
                  throat
```

- **Central** — strongest signal during voiced, resonant speech. Maps to glottal area.
- **Left** — active when breathy or aspirated. Indicates air escape.
- **Right** — rhythmic pulse following amplitude envelope. Helps pacing.

If using a serial/BLE interface, you might emit something like:

```js
function driveTransducers(transducers) {
  for (const t of transducers) {
    hardware.setZone(t.zone, {
      dutyCycle: t.intensity,      // 0.0–1.0
      frequency: t.frequencyHz,    // Hz
    });
  }
}
```

---

## 5. Audio Format Quick Reference

| Parameter | Value |
|---|---|
| Sample rate | 24 000 Hz |
| Bit depth | 16-bit signed integer |
| Channels | 1 (mono) |
| Format | Raw PCM (no header) when sending; WAV when receiving TTS |
| Encoding | base64 over JSON |

TTS audio arrives as a **WAV file** (with header) in base64. You can decode and play it directly with the Web Audio API or an `<audio>` element.

---

## 6. Training Levels

| Level | Description |
|---|---|
| 1 | Short voiced phrases, simple consonants, steady pitch |
| 2 | Moderate length, introduces fricatives |
| 3 | Longer phrases, prosodic variation |
| 4 | Complex sentences, voicing contrasts |
| 5 | Natural conversation pace, full prosody |

Level advancement is handled automatically by the server. When `feedback.advanceLevel` is `true` in the feedback message, the server has already incremented the level — the next `phrase.prompt` will be at the new level.
