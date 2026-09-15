import { createSign } from "node:crypto";

import { z } from "zod";

import type { CreatorBrief } from "@/schemas/brief";

const tokenUrl = "https://oauth2.googleapis.com/token";
const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";
const trackerRange = "A:K";

const serviceAccountSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1),
  private_key_id: z.string().min(1),
}).strict();

const tokenResponseSchema = z.object({ access_token: z.string().min(1) }).passthrough();
const appendResponseSchema = z.object({
  updates: z.object({ updatedRange: z.string().min(1) }),
}).passthrough();

export type GoogleSheetsExport = {
  spreadsheetId: string;
  range: string;
};

export class GoogleSheetsProviderError extends Error {
  constructor(readonly knownNotWritten: boolean) {
    super("Google Sheets export failed");
  }
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function signedAssertion(credentials: z.infer<typeof serviceAccountSchema>, now: Date): string {
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: credentials.private_key_id }));
  const claims = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: sheetsScope,
    aud: tokenUrl,
    iat: issuedAt,
    exp: issuedAt + 3_600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(credentials.private_key).toString("base64url")}`;
}

export function buildTrackerRows(runId: string, briefs: readonly CreatorBrief[]): string[][] {
  return briefs.map((brief) => [
    runId,
    brief.id,
    brief.lane,
    brief.audienceLens,
    brief.hook,
    brief.creatorPrompt,
    brief.requiredAsset,
    brief.cta,
    brief.prohibitedClaims.join("\n"),
    brief.primaryEvidenceId,
    brief.supportingEvidenceIds.join(","),
  ]);
}

export class GoogleSheetsAdapter {
  constructor(
    private readonly spreadsheetId: string,
    private readonly serviceAccountJson: string,
    private readonly request: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async appendTrackerRows(runId: string, briefs: readonly CreatorBrief[]): Promise<GoogleSheetsExport> {
    const credentials = serviceAccountSchema.parse(JSON.parse(this.serviceAccountJson) as unknown);
    const tokenResponse = await this.request(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signedAssertion(credentials, this.now()),
      }),
    });
    if (!tokenResponse.ok) {
      throw new GoogleSheetsProviderError(true);
    }
    const token = tokenResponseSchema.parse(await tokenResponse.json()).access_token;
    const response = await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.spreadsheetId)}/values/${encodeURIComponent(trackerRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ majorDimension: "ROWS", values: buildTrackerRows(runId, briefs) }),
      },
    );
    if (!response.ok) {
      // A timeout or 5xx can arrive after Sheets has accepted the append.
      throw new GoogleSheetsProviderError(response.status < 500 && response.status !== 429);
    }
    const body = appendResponseSchema.parse(await response.json());
    return { spreadsheetId: this.spreadsheetId, range: body.updates.updatedRange };
  }
}
