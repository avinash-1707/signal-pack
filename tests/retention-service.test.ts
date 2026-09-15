import { describe, expect, it } from "vitest";

import { RetentionService, matchesCronSecret } from "../src/server/services/retention-service";

describe("retention cleanup", () => {
  it("accepts only the configured Cron bearer secret", () => {
    expect(matchesCronSecret("Bearer scheduled-secret", "scheduled-secret")).toBe(true);
    expect(matchesCronSecret("Bearer incorrect", "scheduled-secret")).toBe(false);
    expect(matchesCronSecret(null, "scheduled-secret")).toBe(false);
  });

  it("deletes sessions expired at the cleanup time", async () => {
    let receivedNow: Date | undefined;
    const now = new Date("2026-09-16T00:00:00.000Z");
    const service = new RetentionService(
      {
        async deleteExpired(value) {
          receivedNow = value;
          return 3;
        },
      },
      () => now,
    );

    await expect(service.purgeExpiredSessions()).resolves.toBe(3);
    expect(receivedNow).toBe(now);
  });
});
