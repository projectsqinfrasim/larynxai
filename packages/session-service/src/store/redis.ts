import Redis from "ioredis";
import type { SessionState, TrainingLevel, AttemptRecord } from "@larynxai/shared";

const REDIS_URL = process.env.REDIS_URL ?? "redis://redis:6379";
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const MAX_RECENT_ATTEMPTS = 20;

export class SessionStore {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(REDIS_URL, { lazyConnect: true });
  }

  async connect(): Promise<void> {
    await this.redis.connect();
  }

  private key(sessionId: string): string {
    return `session:${sessionId}`;
  }

  async save(session: SessionState): Promise<void> {
    await this.redis.set(
      this.key(session.sessionId),
      JSON.stringify(session),
      "EX",
      SESSION_TTL_SECONDS
    );
  }

  async get(sessionId: string): Promise<SessionState | null> {
    const raw = await this.redis.get(this.key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }

  /** Append an attempt and update stats */
  async recordAttempt(
    sessionId: string,
    attempt: AttemptRecord
  ): Promise<SessionState | null> {
    const session = await this.get(sessionId);
    if (!session) return null;

    session.attemptsTotal += 1;
    if (attempt.score >= 0.75) session.attemptsSuccessful += 1;

    session.recentAttempts.push(attempt);
    if (session.recentAttempts.length > MAX_RECENT_ATTEMPTS) {
      session.recentAttempts.shift();
    }

    session.updatedAt = Date.now();
    await this.save(session);
    return session;
  }

  /** Advance level by one if not already at max */
  async advanceLevel(sessionId: string): Promise<SessionState | null> {
    const session = await this.get(sessionId);
    if (!session) return null;
    if (session.level < 5) {
      session.level = (session.level + 1) as TrainingLevel;
      session.updatedAt = Date.now();
      await this.save(session);
    }
    return session;
  }
}
