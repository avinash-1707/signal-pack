import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PublicFetcher, type PublicFetcherDependencies } from "../src/server/adapters/public-fetcher";
import { calculateCoverage, deduplicateEvidence, normalizeEvidence, normalizeUrl } from "../src/server/services/evidence-service";
import { retryTransient } from "../src/server/services/provider-retry";

function body(value: string): AsyncIterable<Uint8Array> & { destroy(): void } {
  return Object.assign((async function* () { yield new TextEncoder().encode(value); })(), { destroy() {} });
}

function fetcher(dependencies: Partial<PublicFetcherDependencies>): PublicFetcher {
  return new PublicFetcher({
    resolve: async () => [{ address: "93.184.216.34", family: 4 }],
    request: async () => ({ statusCode: 404, headers: {}, body: body("") }),
    ...dependencies,
  });
}

describe("PublicFetcher", () => {
  it("rejects private and credentialed targets before making a request", async () => {
    let requests = 0;
    const unsafe = fetcher({
      resolve: async () => [{ address: "127.0.0.1", family: 4 }],
      request: async () => { requests += 1; return { statusCode: 200, headers: {}, body: body("") }; },
    });

    await expect(unsafe.extract("https://internal.example.test/")).resolves.toEqual({ outcome: "partial", code: "UNSAFE_ADDRESS" });
    await expect(unsafe.extract("https://user:pass@example.test/")).resolves.toEqual({ outcome: "partial", code: "INVALID_URL" });
    expect(requests).toBe(0);
  });

  it("rejects reserved IPv6 destinations before making a request", async () => {
    let requests = 0;
    const result = await fetcher({
      resolve: async () => [{ address: "2001:db8::1", family: 6 }],
      request: async () => { requests += 1; return { statusCode: 200, headers: {}, body: body("") }; },
    }).extract("https://reserved.example.test/");

    expect(result).toEqual({ outcome: "partial", code: "UNSAFE_ADDRESS" });
    expect(requests).toBe(0);
  });

  it("rejects IPv4-compatible IPv6 and special-use IPv4 destinations", async () => {
    for (const address of ["::127.0.0.1", "::192.168.1.1", "0:0:0:0:0:0:0:1", "192.0.2.1", "198.18.0.1"]) {
      let requests = 0;
      const result = await fetcher({
        resolve: async () => [{ address, family: address.includes(":") ? 6 : 4 }],
        request: async () => { requests += 1; return { statusCode: 200, headers: {}, body: body("") }; },
      }).extract("https://reserved.example.test/");
      expect(result).toEqual({ outcome: "partial", code: "UNSAFE_ADDRESS" });
      expect(requests).toBe(0);
    }
  });

  it("does not follow a redirect to a private address", async () => {
    let targetRequests = 0;
    const result = await fetcher({
      resolve: async (hostname) => hostname === "private.test"
        ? [{ address: "10.0.0.8", family: 4 }]
        : [{ address: "93.184.216.34", family: 4 }],
      request: async (url) => {
        if (url.pathname === "/robots.txt") return { statusCode: 404, headers: {}, body: body("") };
        targetRequests += 1;
        return { statusCode: 302, headers: { location: "https://private.test/" }, body: body("") };
      },
    }).extract("https://public.test/");

    expect(result).toEqual({ outcome: "partial", code: "UNSAFE_ADDRESS" });
    expect(targetRequests).toBe(1);
  });

  it("denies robots-disallowed and oversized pages without extraction", async () => {
    let pages = 0;
    const denied = await fetcher({
      request: async (url) => url.pathname === "/robots.txt"
        ? { statusCode: 200, headers: {}, body: body("User-agent: SignalPackBot\nDisallow: /") }
        : { statusCode: 200, headers: {}, body: body("page") },
    }).extract("https://public.test/private");
    const oversized = await fetcher({
      request: async (url) => {
        if (url.pathname === "/robots.txt") return { statusCode: 404, headers: {}, body: body("") };
        pages += 1;
        return { statusCode: 200, headers: { "content-type": "text/html", "content-length": "1048577" }, body: body("page") };
      },
    }).extract("https://public.test/");

    expect(denied).toEqual({ outcome: "partial", code: "ACCESS_DISALLOWED" });
    expect(oversized).toEqual({ outcome: "partial", code: "RESPONSE_TOO_LARGE" });
    expect(pages).toBe(1);
  });

  it("evaluates cached robots rules for every requested path", async () => {
    const requests: string[] = [];
    const instance = fetcher({
      request: async (url) => {
        requests.push(url.pathname);
        if (url.pathname === "/robots.txt") return { statusCode: 200, headers: {}, body: body("User-agent: SignalPackBot\nDisallow: /private") };
        return { statusCode: 200, headers: { "content-type": "text/plain" }, body: body("allowed") };
      },
    });
    await expect(instance.extract("https://public.test/allowed")).resolves.toMatchObject({ outcome: "success" });
    await expect(instance.extract("https://public.test/private")).resolves.toEqual({ outcome: "partial", code: "ACCESS_DISALLOWED" });
    expect(requests).toEqual(["/robots.txt", "/allowed"]);
  });
});

describe("evidence fixture", () => {
  it("normalizes eight records, deduplicates content, and calculates expected coverage without network access", async () => {
    const fixture: { input: { productUrl: string }; evidence: Array<Omit<Parameters<typeof normalizeEvidence>[0], "runId" | "retrievedAt">>; expected: { coverage: ReturnType<typeof calculateCoverage> } } = JSON.parse(await readFile(resolve(process.cwd(), "fixtures/cartesia-awareness-2026-09-15.json"), "utf8"));
    const records = fixture.evidence.map((item) => normalizeEvidence({
      ...item,
      runId: "6c4c1e99-7272-4d07-8382-dca1649112a9",
      retrievedAt: "2026-09-15T12:00:00.000Z",
    }, fixture.input.productUrl));

    expect(records).toHaveLength(8);
    expect(deduplicateEvidence([...records, records[0]!])).toHaveLength(8);
    expect(calculateCoverage(records)).toEqual(fixture.expected.coverage);
    expect(normalizeUrl("https://CARTESIA.ai/?utm_source=test#overview")).toBe("https://cartesia.ai/");
  });
});

describe("provider retries", () => {
  it("retries transient failures twice before preserving a partial outcome", async () => {
    let attempts = 0;
    const result = await retryTransient(
      async () => { attempts += 1; throw new Error("unavailable"); },
      () => ({ code: "UPSTREAM_UNAVAILABLE" }),
      async () => {},
    );

    expect(attempts).toBe(3);
    expect(result).toEqual({ outcome: "partial", failure: { code: "UPSTREAM_UNAVAILABLE" } });
  });
});
