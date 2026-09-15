export type FixedWindowRequest = {
  key: string;
  limit: number;
  windowMs: number;
};

export type FixedWindowResult = {
  allowed: boolean;
  count: number;
};

export type FixedWindowCounter = {
  consume(request: FixedWindowRequest): Promise<FixedWindowResult>;
};

export type RunLimitCode = "DEMO_AT_CAPACITY" | "IP_LIMIT_REACHED" | "RUN_LIMIT_REACHED";

export type RunLimitStore = {
  consumeRunLimits(sessionId: string, ipAddress: string): Promise<{ allowed: boolean; code?: RunLimitCode }>;
};

const consumeWithinLimit = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if current >= limit then return {0, current} end
local next = redis.call('INCR', KEYS[1])
if next == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return {1, next}
`;

const consumeRunLimits = `
local limits = {3, 5, 3}
local durations = {86400000, 86400000, 90000}
local codes = {'RUN_LIMIT_REACHED', 'IP_LIMIT_REACHED', 'DEMO_AT_CAPACITY'}
for index, key in ipairs(KEYS) do
  local current = tonumber(redis.call('GET', key) or '0')
  if current >= limits[index] then return {0, codes[index]} end
end
for index, key in ipairs(KEYS) do
  local next = redis.call('INCR', key)
  if next == 1 then redis.call('PEXPIRE', key, durations[index]) end
end
return {1, ''}
`;

function parseResult(value: unknown): FixedWindowResult {
  if (
    !value ||
    typeof value !== "object" ||
    !("result" in value) ||
    !Array.isArray(value.result) ||
    typeof value.result[0] !== "number" ||
    typeof value.result[1] !== "number"
  ) {
    throw new Error("Invalid KV response");
  }

  return { allowed: value.result[0] === 1, count: value.result[1] };
}

function parseRunLimitResult(value: unknown): { allowed: boolean; code?: RunLimitCode } {
  if (
    !value ||
    typeof value !== "object" ||
    !("result" in value) ||
    !Array.isArray(value.result) ||
    typeof value.result[0] !== "number" ||
    typeof value.result[1] !== "string"
  ) {
    throw new Error("Invalid KV response");
  }

  if (value.result[0] === 1) {
    return { allowed: true };
  }
  if (
    value.result[1] !== "RUN_LIMIT_REACHED" &&
    value.result[1] !== "IP_LIMIT_REACHED" &&
    value.result[1] !== "DEMO_AT_CAPACITY"
  ) {
    throw new Error("Invalid KV limit code");
  }

  return { allowed: false, code: value.result[1] };
}

export class UpstashFixedWindowCounter implements FixedWindowCounter, RunLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  async consume({ key, limit, windowMs }: FixedWindowRequest): Promise<FixedWindowResult> {
    const response = await this.request(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["EVAL", consumeWithinLimit, 1, key, limit, windowMs]),
    });

    if (!response.ok) {
      throw new Error(`KV request failed with status ${response.status}`);
    }

    return parseResult(await response.json());
  }

  async consumeRunLimits(sessionId: string, ipAddress: string): Promise<{ allowed: boolean; code?: RunLimitCode }> {
    const response = await this.request(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        consumeRunLimits,
        3,
        `runs:session:${sessionId}`,
        `runs:ip:${ipAddress}`,
        "runs:global",
      ]),
    });
    if (!response.ok) {
      throw new Error(`KV request failed with status ${response.status}`);
    }

    return parseRunLimitResult(await response.json());
  }
}

export function createFixedWindowCounter(): UpstashFixedWindowCounter {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are required");
  }

  return new UpstashFixedWindowCounter(url, token);
}
