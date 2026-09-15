import { describe, expect, it } from "vitest";

import type { Database } from "../src/server/adapters/database";
import type { RunLimitStore } from "../src/server/adapters/kv";
import { RunRepository } from "../src/server/repositories/run-repository";
import type { SessionRecord } from "../src/server/repositories/session-repository";
import { RunLimits } from "../src/server/services/run-limits";
import { SessionService } from "../src/server/services/session-service";

class InMemorySessions {
  readonly records = new Map<string, SessionRecord>();

  async create(session: SessionRecord): Promise<void> {
    this.records.set(session.id, session);
  }

  async findActive(id: string, now: Date): Promise<SessionRecord | null> {
    const session = this.records.get(id);
    return session && session.expiresAt > now ? session : null;
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

class RecordingCounter implements RunLimitStore {
  requests: Array<{ sessionId: string; ipAddress: string }> = [];

  constructor(private readonly result: { allowed: boolean; code?: "RUN_LIMIT_REACHED" }) {}

  async consumeRunLimits(sessionId: string, ipAddress: string) {
    this.requests.push({ sessionId, ipAddress });
    return this.result;
  }
}

describe("SessionService", () => {
  it("rejects a tampered cookie and creates a replacement session", async () => {
    const repository = new InMemorySessions();
    const now = new Date("2026-09-15T12:00:00.000Z");
    const service = new SessionService(repository, "x".repeat(32), () => now);
    const created = await service.getOrCreate(undefined);
    const replacement = await service.getOrCreate(`${created.token?.value}.tampered`);

    expect(replacement.session.id).not.toBe(created.session.id);
    expect(replacement.token).toBeDefined();
  });

  it("deletes only the session identified by a valid signed cookie", async () => {
    const repository = new InMemorySessions();
    const service = new SessionService(repository, "x".repeat(32));
    const created = await service.getOrCreate(undefined);

    await service.delete(created.token?.value);

    expect(repository.records.has(created.session.id)).toBe(false);
  });
});

describe("RunLimits", () => {
  it("delegates all run quotas to one shared-store operation", async () => {
    const counter = new RecordingCounter({ allowed: false, code: "RUN_LIMIT_REACHED" });
    const result = await new RunLimits(counter).consume("session-1", "203.0.113.1");

    expect(result).toEqual({ allowed: false, code: "RUN_LIMIT_REACHED" });
    expect(counter.requests).toEqual([{ sessionId: "session-1", ipAddress: "203.0.113.1" }]);
  });
});

describe("RunRepository", () => {
  it("uses the owning session in the run lookup", async () => {
    let query = "";
    let values: readonly unknown[] = [];
    const database: Database = {
      async query(text, parameters = []) {
        query = text;
        values = parameters;
        return { rowCount: 0, rows: [] };
      },
    };

    await new RunRepository(database).findOwned(
      "6c4c1e99-7272-4d07-8382-dca1649112a9",
      "d41dbad0-2f91-4f07-b8e9-73d7f90c08f7",
    );

    expect(query).toContain("WHERE runs.id = $1 AND runs.session_id = $2");
    expect(values).toEqual([
      "6c4c1e99-7272-4d07-8382-dca1649112a9",
      "d41dbad0-2f91-4f07-b8e9-73d7f90c08f7",
    ]);
  });
});
