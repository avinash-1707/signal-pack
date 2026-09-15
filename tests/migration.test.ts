import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("initial migration", () => {
  it("makes all run-owned records cascade from their session", async () => {
    const migration = await readFile(
      resolve(process.cwd(), "migrations/0000_initial.sql"),
      "utf8",
    );

    expect(migration).toContain("session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE");
    expect(migration).toContain("run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE");
    expect(migration).toContain("run_id UUID NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE");
  });
});
