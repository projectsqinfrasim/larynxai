/** Unique identifier for a training session */
export type SessionId = string;

/** User identifier */
export type UserId = string;

/** Training level (1 = beginner, higher = more advanced) */
export type TrainingLevel = 1 | 2 | 3 | 4 | 5;

/** Snapshot of a single training attempt */
export interface AttemptRecord {
  phraseTarget: string;
  phraseTranscribed: string;
  score: number;          // 0–1 similarity
  durationMs: number;
  attemptedAt: number;    // Unix ms
}

/** Full session state stored in Redis */
export interface SessionState {
  sessionId: SessionId;
  userId: UserId;
  level: TrainingLevel;
  attemptsTotal: number;
  attemptsSuccessful: number;
  recentAttempts: AttemptRecord[];
  createdAt: number;
  updatedAt: number;
}

/** Payload sent by the client to start a session */
export interface StartSessionPayload {
  userId: UserId;
  level?: TrainingLevel;
}
