import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const ownerLifetimeMs = 15 * 60 * 1_000;

const ownerTokenPayloadSchema = z
  .object({
    sessionId: z.uuid(),
    capability: z.uuid(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type OwnerCapabilityToken = {
  value: string;
  expiresAt: Date;
};

function sign(payload: string, signingSecret: string): string {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

function signaturesMatch(payload: string, signature: string, signingSecret: string): boolean {
  const expected = Buffer.from(sign(payload, signingSecret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function encode(sessionId: string, expiresAt: Date, signingSecret: string): string {
  const payload = Buffer.from(JSON.stringify({
    sessionId,
    capability: randomUUID(),
    expiresAt: expiresAt.getTime(),
  })).toString("base64url");
  return `${payload}.${sign(payload, signingSecret)}`;
}

export function matchesDemoExportCode(submitted: string, configured: string): boolean {
  const submittedHash = createHash("sha256").update(submitted).digest();
  const configuredHash = createHash("sha256").update(configured).digest();
  return timingSafeEqual(submittedHash, configuredHash);
}

export class OwnerCapabilityService {
  constructor(
    private readonly signingSecret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  issue(sessionId: string): OwnerCapabilityToken {
    const expiresAt = new Date(this.now().getTime() + ownerLifetimeMs);
    return { value: encode(sessionId, expiresAt, this.signingSecret), expiresAt };
  }

  isValidForSession(token: string | undefined, sessionId: string): boolean {
    if (!token) {
      return false;
    }
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !signaturesMatch(payload, signature, this.signingSecret)) {
      return false;
    }

    try {
      const parsed = ownerTokenPayloadSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown);
      return parsed.success && parsed.data.sessionId === sessionId && parsed.data.expiresAt > this.now().getTime();
    } catch {
      return false;
    }
  }
}
