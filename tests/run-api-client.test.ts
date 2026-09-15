import { afterEach, describe, expect, it, vi } from "vitest";

import { connectRunEvents } from "../src/features/runs/run-api-client";

type MessageHandler = ((message: MessageEvent<string>) => void) | null;

class FakeEventSource {
  static instance: FakeEventSource | undefined;
  onmessage: MessageHandler = null;
  closed = false;

  constructor(_url: string) {
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
