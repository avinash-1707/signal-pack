import { randomUUID } from "node:crypto";

import type { CreateRunRequest } from "@/schemas/api";
import type { RunRecord, RunRepository } from "@/server/repositories/run-repository";
import type { SessionService, SessionToken } from "@/server/services/session-service";
import type { RunLimitResult, RunLimits } from "@/server/services/run-limits";

export type CreateRunResult =
  | { kind: "created"; runId: string; token?: SessionToken }
  | { kind: "existing"; runId: string; token?: SessionToken }
  | { kind: "limited"; limit: Exclude<RunLimitResult, { allowed: true }> };

export class RunService {
  constructor(
    private readonly runs: RunRepository,
    private readonly sessions: SessionService,
    private readonly limits: RunLimits,
  ) {}

  async create(
    input: CreateRunRequest,
    sessionToken: string | undefined,
    ipAddress: string,
  ): Promise<CreateRunResult> {
    const resolved = await this.sessions.getOrCreate(sessionToken);
    const active = await this.runs.findActiveBySession(resolved.session.id);
    if (active) {
      return resolved.token
        ? { kind: "existing", runId: active.id, token: resolved.token }
        : { kind: "existing", runId: active.id };
    }

    const limit = await this.limits.consume(resolved.session.id, ipAddress);
    if (!limit.allowed) {
      return { kind: "limited", limit };
    }

    const runId = randomUUID();
    await this.runs.create(runId, resolved.session.id, input);
    return resolved.token
      ? { kind: "created", runId, token: resolved.token }
      : { kind: "created", runId };
  }

  async getOwned(runId: string, sessionToken: string | undefined): Promise<RunRecord | null> {
    const session = await this.sessions.get(sessionToken);
    return session ? this.runs.findOwned(runId, session.id) : null;
  }
}
