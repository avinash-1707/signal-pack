import { timingSafeEqual } from "node:crypto";

type ExpiredSessionStore = {
  deleteExpired(now: Date): Promise<number>;
};

export function matchesCronSecret(authorization: string | null, cronSecret: string): boolean {
  const received = Buffer.from(authorization ?? "");
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export class RetentionService {
  constructor(
    private readonly sessions: ExpiredSessionStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async purgeExpiredSessions(): Promise<number> {
    return this.sessions.deleteExpired(this.now());
  }
}
