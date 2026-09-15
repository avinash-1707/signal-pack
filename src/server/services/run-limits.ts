import type { RunLimitCode, RunLimitStore } from "@/server/adapters/kv";

export type RunLimitResult =
  | { allowed: true }
  | { allowed: false; code: RunLimitCode };

export class RunLimits {
  constructor(private readonly counter: RunLimitStore) {}

  async consume(sessionId: string, ipAddress: string): Promise<RunLimitResult> {
    const result = await this.counter.consumeRunLimits(sessionId, ipAddress);
    if (result.allowed) {
      return { allowed: true };
    }
    if (!result.code) {
      throw new Error("KV limit rejection did not include a code");
    }

    return { allowed: false, code: result.code };
  }
}
