import { createHash, randomUUID } from "node:crypto";

import type { AssetRole, SourceKind } from "../../schemas/domain";
import { evidenceSchema, type Evidence } from "../../schemas/evidence";

const trackingParameter = /^(utm_|fbclid$|gclid$|mc_[ce]id$)/i;
const allRoles: AssetRole[] = [
  "authority",
  "product_proof",
  "retention",
  "creator_narrative",
  "social_proof",
  "conversion",
];

export type EvidenceInput = Omit<Evidence, "id" | "contentHash" | "url" | "sourceKind"> & {
  url: string;
  sourceKind?: SourceKind;
};

export function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (trackingParameter.test(key)) {
      url.searchParams.delete(key);
    }
  }
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  return url.toString();
}

export function sourceKindForUrl(url: string, productUrl: string): SourceKind {
  return new URL(url).hostname === new URL(productUrl).hostname
    ? "first_party"
    : "third_party";
}

export function normalizeEvidence(input: EvidenceInput, productUrl: string): Evidence {
  const url = normalizeUrl(input.url);
  const excerpt = input.excerpt.trim().replace(/\s+/g, " ");
  const title = input.title.trim().replace(/\s+/g, " ");
  const publisher = input.publisher.trim().replace(/\s+/g, " ");
  return evidenceSchema.parse({
    ...input,
    id: randomUUID(),
    url,
    title,
    publisher,
    excerpt,
    observations: input.observations.map((observation) => observation.trim()).filter(Boolean),
    sourceKind: input.sourceKind ?? sourceKindForUrl(url, productUrl),
    contentHash: createHash("sha256").update(`${url}\n${title}\n${excerpt}`).digest("hex"),
  });
}

export function deduplicateEvidence(evidence: readonly Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    if (seen.has(item.contentHash)) {
      return false;
    }
    seen.add(item.contentHash);
    return true;
  });
}

export function calculateCoverage(evidence: readonly Evidence[]): {
  found: string[];
  notFoundInThisRun: string[];
} {
  const found = new Set(evidence.flatMap((item) => item.roles));
  return {
    found: allRoles.filter((role) => found.has(role)),
    notFoundInThisRun: allRoles.filter((role) => !found.has(role)),
  };
}
