import { afterEach, describe, expect, it, vi } from "vitest";

import { approveRun, connectRunEvents, exportRun, unlockExport } from "../src/features/runs/run-api-client";

type MessageHandler = ((message: MessageEvent<string>) => void) | null;

class FakeEventSource {
  static instance: FakeEventSource | undefined;
  onmessage: MessageHandler = null;
  closed = false;

  constructor() {
    FakeEventSource.instance = this;
  }

  close(): void {
    this.closed = true;
  }

  emit(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeEventSource.instance = undefined;
});

describe("run event client", () => {
  it("ignores duplicate events and refreshes after a sequence gap", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const received: number[] = [];
    const refresh = vi.fn();
    const close = connectRunEvents("6c4c1e99-7272-4d07-8382-dca1649112a9", {
      onEvent: (item) => received.push(item.sequence),
      onSequenceGap: refresh,
    });

    const source = FakeEventSource.instance;
    expect(source).toBeDefined();
    source!.emit({ type: "run.status", sequence: 0, status: "queued", at: "2026-09-15T12:00:00.000Z" });
    source!.emit({ type: "run.status", sequence: 0, status: "queued", at: "2026-09-15T12:00:00.000Z" });
    source!.emit({ type: "report.ready", sequence: 2, runId: "6c4c1e99-7272-4d07-8382-dca1649112a9", status: "awaiting_approval", at: "2026-09-15T12:01:00.000Z" });

    expect(received).toEqual([0]);
    expect(refresh).toHaveBeenCalledOnce();
    close();
  });

  it("closes after a terminal report event", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    connectRunEvents("6c4c1e99-7272-4d07-8382-dca1649112a9", {
      onEvent: vi.fn(),
      onSequenceGap: vi.fn(),
    });

    const source = FakeEventSource.instance;
    source!.emit({ type: "report.ready", sequence: 0, runId: "6c4c1e99-7272-4d07-8382-dca1649112a9", status: "awaiting_approval", at: "2026-09-15T12:01:00.000Z" });

    expect(source!.closed).toBe(true);
  });
});

describe("approval and export client", () => {
  const runId = "6c4c1e99-7272-4d07-8382-dca1649112a9";
  const idempotencyKey = "ab9ae5e9-d80e-49d4-9ae7-4730b5c1ca6c";

  it("sends the documented approval, owner unlock, and idempotent export requests", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        approvalId: "58a75de6-9ca4-47f5-a8fc-0cf9be2140e7",
        status: "awaiting_approval",
        approvedAt: "2026-09-15T12:03:00.000Z",
        exportEligible: false,
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ unlockedUntil: "2026-09-15T12:18:00.000Z" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        exportId: "bd5071a8-0c9f-455e-bf5f-d80e97e7e0c0",
        spreadsheetId: "sheet-1",
        range: "A2:K4",
        exportedAt: "2026-09-15T12:04:00.000Z",
      })));
    vi.stubGlobal("fetch", fetchMock);

    await approveRun(runId);
    await unlockExport("presenter-code");
    await exportRun(runId, idempotencyKey);

    expect(fetchMock).toHaveBeenNthCalledWith(1, `/api/runs/${runId}/approve`, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ acknowledgmentVersion: "creator-brief-review-v1", acknowledged: true }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/demo/unlock-export", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ code: "presenter-code" }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, `/api/runs/${runId}/export`, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ idempotencyKey }),
    }));
  });
});
