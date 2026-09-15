import { sessionCookieName } from "@/server/session-cookie";
import { createFoundationServices } from "@/server/services/foundation";

type Context = { params: Promise<{ runId: string }> };

const encoder = new TextEncoder();

function getSessionToken(request: Request): string | undefined {
  return request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${sessionCookieName}=([^;]*)`))?.[1];
}

function event(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { runId } = await params;
  const run = await createFoundationServices().runs.getOwned(runId, getSessionToken(request));
  if (!run) {
    return new Response(null, { status: 404 });
  }

  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let sequence = 0;
      let lastStatus = run.status;
      let closed = false;
      controller.enqueue(event({
        type: "run.status",
        sequence,
        status: run.status,
        at: run.createdAt.toISOString(),
      }));
      if (run.status === "awaiting_approval" || run.status === "incomplete") {
        sequence += 1;
        controller.enqueue(event({
          type: "report.ready",
          sequence,
          runId: run.id,
          status: run.status,
          at: (run.completedAt ?? run.createdAt).toISOString(),
        }));
        return;
      }

      const timer = setInterval(() => {
        void createFoundationServices().runs.getOwned(runId, getSessionToken(request)).then((current) => {
          if (closed || !current || current.status === lastStatus) {
            return;
          }
          lastStatus = current.status;
          sequence += 1;
          controller.enqueue(event({
            type: "run.status",
            sequence,
            status: current.status,
            at: (current.completedAt ?? new Date()).toISOString(),
          }));
          if (current.status === "awaiting_approval" || current.status === "incomplete") {
            sequence += 1;
            controller.enqueue(event({
              type: "report.ready",
              sequence,
              runId: current.id,
              status: current.status,
              at: (current.completedAt ?? new Date()).toISOString(),
            }));
            clearInterval(timer);
          }
        }).catch(() => {
          // The next browser reconnect can recover an unavailable stream.
        });
      }, 3_000);

      stop = () => {
        closed = true;
        clearInterval(timer);
      };
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
    },
  });
}
