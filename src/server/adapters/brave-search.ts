import { z } from "zod";

import type { SearchPublicWeb } from "../../schemas/evidence";
import { normalizeUrl } from "../services/evidence-service";
import { retryTransient, type ProviderFailure } from "../services/provider-retry";

const braveResponseSchema = z.object({
  web: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.url(),
      description: z.string().default(""),
    })).default([]),
  }).optional(),
});

export type SearchResult = { title: string; url: string; excerpt: string; publisher: string };
export type BraveSearchResult =
  | { outcome: "success"; results: SearchResult[] }
  | { outcome: "partial" | "error"; code: ProviderFailure["code"] };

export class BraveSearch {
  constructor(private readonly apiKey: string, private readonly request: typeof fetch = fetch) {}

  async search(input: SearchPublicWeb): Promise<BraveSearchResult> {
    const result = await retryTransient(
      async () => {
        const url = new URL("https://api.search.brave.com/res/v1/web/search");
        url.searchParams.set("q", input.query);
        url.searchParams.set("count", String(input.resultLimit));
        if (input.domains?.length) {
          url.searchParams.set("site", input.domains.join(","));
        }
        const response = await this.request(url, { headers: { Accept: "application/json", "X-Subscription-Token": this.apiKey } });
        if (!response.ok) {
          throw { status: response.status };
        }
        return braveResponseSchema.parse(await response.json());
      },
      classifyBraveFailure,
    );
    if (result.outcome !== "success") {
      return { outcome: result.outcome, code: result.failure.code };
    }
    return {
      outcome: "success",
      results: (result.value.web?.results ?? []).map((entry) => ({
        title: entry.title,
        url: normalizeUrl(entry.url),
        excerpt: entry.description.trim().slice(0, 4_000),
        publisher: new URL(entry.url).hostname,
      })),
    };
  }
}

function classifyBraveFailure(error: unknown): ProviderFailure {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    if (error.status === 429) return { code: "RATE_LIMITED" };
    if ([502, 503, 504].includes(error.status)) return { code: "UPSTREAM_UNAVAILABLE" };
    return { code: "INVALID_RESPONSE" };
  }
  if (error instanceof DOMException && error.name === "TimeoutError") return { code: "TIMEOUT" };
  return { code: "UPSTREAM_UNAVAILABLE" };
}
