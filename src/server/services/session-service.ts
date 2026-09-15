import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import type { SessionRecord } from "@/server/repositories/session-repository";

const sessionLifetimeMs = 24 * 60 * 60 * 1_000;

const sessionTokenPayloadSchema = z
  .object({
    sessionId: z.uuid(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type SessionToken = {
  value: string;
  expiresAt: Date;
};

type SessionStore = {
  create(session: SessionRecord): Promise<void>;
  findActive(id: string, now: Date): Promise<SessionRecord | null>;
  delete(id: string): Promise<void>;
};

function sign(payload: string, signingSecret: string): string {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

function verifySignature(payload: string, signature: string, signingSecret: string): boolean {
  const expected = Buffer.from(sign(payload, signingSecret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function parseToken(value: string, signingSecret: string): SessionRecord | null {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra || !verifySignature(payload, signature, signingSecret)) {
    return null;
  }

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = sessionTokenPayloadSchema.safeParse(JSON.parse(decoded) as unknown);
    if (!parsed.success || parsed.data.expiresAt <= Date.now()) {
      return null;
    }

    return { id: parsed.data.sessionId, expiresAt: new Date(parsed.data.expiresAt) };
  } catch {
    return null;
  }
}

function encodeToken(session: SessionRecord, signingSecret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sessionId: session.id, expiresAt: session.expiresAt.getTime() }),
  ).toString("base64url");
  return `${payload}.${sign(payload, signingSecret)}`;
}

export class SessionService {
  constructor(
    private readonly sessions: SessionStore,
    private readonly signingSecret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getOrCreate(tokenValue: string | undefined): Promise<{ session: SessionRecord; token?: SessionToken }> {
    if (tokenValue) {
      const parsed = parseToken(tokenValue, this.signingSecret);
      if (parsed) {
        const active = await this.sessions.findActive(parsed.id, this.now());
        if (active) {
          return { session: active };
        }
      }
    }

    const expiresAt = new Date(this.now().getTime() + sessionLifetimeMs);
    const session = { id: randomUUID(), expiresAt };
    await this.sessions.create(session);
    return { session, token: { value: encodeToken(session, this.signingSecret), expiresAt } };
  }

  async get(tokenValue: string | undefined): Promise<SessionRecord | null> {
    if (!tokenValue) {
      return null;
    }

    const parsed = parseToken(tokenValue, this.signingSecret);
    return parsed ? this.sessions.findActive(parsed.id, this.now()) : null;
  }

  async delete(tokenValue: string | undefined): Promise<void> {
    if (!tokenValue) {
      return;
    }

    const parsed = parseToken(tokenValue, this.signingSecret);
    if (parsed) {
      await this.sessions.delete(parsed.id);
    }
  }
}
