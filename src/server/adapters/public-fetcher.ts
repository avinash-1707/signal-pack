import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import robotsParser from "robots-parser";
import { Client } from "undici";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "SignalPackBot";

export type FetchFailureCode =
  | "INVALID_URL"
  | "UNSAFE_ADDRESS"
  | "ACCESS_DISALLOWED"
  | "UNSUPPORTED_CONTENT"
  | "RESPONSE_TOO_LARGE"
  | "TIMEOUT"
  | "UPSTREAM_UNAVAILABLE";

export type FetchResult =
  | { outcome: "success"; url: string; title: string; excerpt: string }
  | { outcome: "partial"; code: FetchFailureCode };

type ResolvedAddress = { address: string; family: 4 | 6 };
type HttpResponse = { statusCode: number; headers: Record<string, string | string[] | undefined>; body: AsyncIterable<Uint8Array> & { destroy(): void } };

export type PublicFetcherDependencies = {
  resolve?(hostname: string): Promise<ResolvedAddress[]>;
  request?(url: URL, address: ResolvedAddress, headers: Record<string, string>, signal?: AbortSignal): Promise<HttpResponse>;
  now?(): Date;
};

type RobotsPolicy = { allowAll: boolean; rules: ReturnType<typeof robotsParser> | null; expiresAt: number };

export class PublicFetcher {
  private readonly robots = new Map<string, RobotsPolicy>();
  private readonly resolve: (hostname: string) => Promise<ResolvedAddress[]>;
  private readonly request: (url: URL, address: ResolvedAddress, headers: Record<string, string>, signal?: AbortSignal) => Promise<HttpResponse>;
  private readonly now: () => Date;

  constructor(dependencies: PublicFetcherDependencies = {}) {
    this.resolve = dependencies.resolve ?? resolvePublicAddresses;
    this.request = dependencies.request ?? requestPublicUrl;
    this.now = dependencies.now ?? (() => new Date());
  }

  async extract(value: string, signal?: AbortSignal): Promise<FetchResult> {
    let target: URL;
    try {
      target = validateUrl(value);
    } catch {
      return { outcome: "partial", code: "INVALID_URL" };
    }

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const address = await this.publicAddress(target.hostname);
      if (!address) {
        return { outcome: "partial", code: "UNSAFE_ADDRESS" };
      }
      if (!(await this.isRobotsAllowed(target, address, signal))) {
        return { outcome: "partial", code: "ACCESS_DISALLOWED" };
      }

      let response: HttpResponse;
      try {
        response = await this.request(target, address, { accept: "text/html, text/plain", "user-agent": USER_AGENT }, signal);
      } catch (error: unknown) {
        return { outcome: "partial", code: isTimeout(error) ? "TIMEOUT" : "UPSTREAM_UNAVAILABLE" };
      }

      if (isRedirect(response.statusCode)) {
        response.body.destroy();
        const location = header(response.headers, "location");
        if (!location || redirects === MAX_REDIRECTS) {
          return { outcome: "partial", code: "UPSTREAM_UNAVAILABLE" };
        }
        try {
          target = validateUrl(new URL(location, target).toString());
        } catch {
          return { outcome: "partial", code: "UNSAFE_ADDRESS" };
        }
        continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.body.destroy();
        return { outcome: "partial", code: "UPSTREAM_UNAVAILABLE" };
      }
      const contentType = header(response.headers, "content-type")?.toLowerCase() ?? "";
      if (!contentType.startsWith("text/html") && !contentType.startsWith("text/plain")) {
        response.body.destroy();
        return { outcome: "partial", code: "UNSUPPORTED_CONTENT" };
      }
      const contentLength = Number(header(response.headers, "content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        response.body.destroy();
        return { outcome: "partial", code: "RESPONSE_TOO_LARGE" };
      }
      try {
        const text = await readBounded(response.body);
        const extracted = extractText(text, contentType.startsWith("text/html"));
        return extracted
          ? { outcome: "success", url: target.toString(), ...extracted }
          : { outcome: "partial", code: "UNSUPPORTED_CONTENT" };
      } catch {
        return { outcome: "partial", code: "RESPONSE_TOO_LARGE" };
      }
    }
    return { outcome: "partial", code: "UPSTREAM_UNAVAILABLE" };
  }

  private async publicAddress(hostname: string): Promise<ResolvedAddress | null> {
    try {
      const addresses = await this.resolve(hostname);
      return addresses.every((address) => isPublicAddress(address.address)) ? addresses[0] ?? null : null;
    } catch {
      return null;
    }
  }

  private async isRobotsAllowed(target: URL, address: ResolvedAddress, signal?: AbortSignal): Promise<boolean> {
    const origin = target.origin;
    const cached = this.robots.get(origin);
    if (cached && cached.expiresAt > this.now().getTime()) {
      return cached.allowAll || cached.rules?.isAllowed(target.toString(), USER_AGENT) === true;
    }
    const robotsUrl = new URL("/robots.txt", origin);
    let response: HttpResponse;
    try {
      response = await this.request(robotsUrl, address, { accept: "text/plain", "user-agent": USER_AGENT }, signal);
    } catch {
      this.cacheRobots(origin, false, null);
      return false;
    }
    if (response.statusCode === 404) {
      response.body.destroy();
      this.cacheRobots(origin, true, null);
      return true;
    }
    if (response.statusCode !== 200) {
      response.body.destroy();
      this.cacheRobots(origin, false, null);
      return false;
    }
    try {
      const parsed = robotsParser(robotsUrl.toString(), await readBounded(response.body));
      const allowed = parsed.isAllowed(target.toString(), USER_AGENT) === true;
      this.cacheRobots(origin, false, parsed);
      return allowed;
    } catch {
      this.cacheRobots(origin, false, null);
      return false;
    }
  }

  private cacheRobots(origin: string, allowAll: boolean, rules: ReturnType<typeof robotsParser> | null): void {
    this.robots.set(origin, { allowAll, rules, expiresAt: this.now().getTime() + 24 * 60 * 60 * 1000 });
  }
}

function validateUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Unsafe URL");
  }
  return url;
}

async function resolvePublicAddresses(hostname: string): Promise<ResolvedAddress[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((address) => ({ address: address.address, family: address.family === 6 ? 6 : 4 }));
}

async function requestPublicUrl(url: URL, address: ResolvedAddress, headers: Record<string, string>, signal?: AbortSignal): Promise<HttpResponse> {
  const client = new Client(url.origin, {
    connect: {
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      timeout: REQUEST_TIMEOUT_MS,
    },
    headersTimeout: REQUEST_TIMEOUT_MS,
    bodyTimeout: REQUEST_TIMEOUT_MS,
    maxResponseSize: MAX_RESPONSE_BYTES,
  });
  let response;
  try {
    response = await client.request({
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    await client.destroy(error instanceof Error ? error : new Error("Public request failed"));
    throw error;
  }
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: Object.assign(closeAfterRead(response.body, client), {
      destroy: () => {
        response.body.destroy();
        void client.destroy();
      },
    }),
  };
}

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    return isPublicIpv4(address);
  }
  if (isIP(address) !== 6) return false;
  const embeddedIpv4 = address.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (embeddedIpv4) return isPublicIpv4(embeddedIpv4);
  const normalized = address.toLowerCase();
  const parts = expandIpv6(normalized);
  if (!parts) return false;
  const mappedIpv4 = parts.slice(0, 6).every((part, index) => part === 0 || (index === 5 && part === 0xffff));
  if (mappedIpv4) return isPublicIpv4(`${parts[6]! >> 8}.${parts[6]! & 0xff}.${parts[7]! >> 8}.${parts[7]! & 0xff}`);
  const first = parts[0]!;
  return !(parts.every((part) => part === 0) || (parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1) || (first >= 0xfc00 && first <= 0xfdff) || (first >= 0xfe80 && first <= 0xfebf) || first >= 0xff00 || (first === 0x2001 && parts[1] === 0x0db8) || (first === 0x2001 && parts[1]! >= 0x0010 && parts[1]! <= 0x001f));
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  const [first = Number.NaN, second = Number.NaN, third = Number.NaN] = parts;
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return first !== 0 && first !== 10 && first !== 127 && first < 224 && !(first === 100 && second >= 64 && second <= 127) && !(first === 169 && second === 254) && !(first === 172 && second >= 16 && second <= 31) && !(first === 192 && (second === 0 || second === 88 && third === 99 || second === 168 || second === 0 && third === 2)) && !(first === 198 && (second === 18 || second === 19 || second === 51 && third === 100)) && !(first === 203 && second === 0 && third === 113);
}

function expandIpv6(address: string): number[] | null {
  const [left, right] = address.split("::");
  if (address.split("::").length > 2) return null;
  const parse = (value: string | undefined) => value ? value.split(":").map((part) => Number.parseInt(part, 16)) : [];
  const start = parse(left);
  const end = parse(right);
  if (start.some(Number.isNaN) || end.some(Number.isNaN) || start.length + end.length > 8) return null;
  return [...start, ...Array(8 - start.length - end.length).fill(0), ...end];
}

async function* closeAfterRead(body: AsyncIterable<Uint8Array>, client: Client): AsyncIterable<Uint8Array> {
  try {
    yield* body;
  } finally {
    await client.close();
  }
}

function header(headers: HttpResponse["headers"], name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function isRedirect(statusCode: number): boolean {
  return statusCode >= 300 && statusCode < 400;
}

function isTimeout(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error
    && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function readBounded(body: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      throw new ResponseTooLargeError();
    }
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

class ResponseTooLargeError extends Error {}

function extractText(source: string, html: boolean): { title: string; excerpt: string } | null {
  const titleMatch = html ? source.match(/<title[^>]*>([\s\S]*?)<\/title>/i) : null;
  const text = (html ? source
    .replace(/<(script|style|noscript|form)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ") : source)
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return null;
  }
  return {
    title: (titleMatch?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Untitled source").slice(0, 300),
    excerpt: text.slice(0, 4_000),
  };
}
