type LogFields = {
  event: string;
  runId?: string;
  provider?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  errorCode?: string;
};

type Logger = Pick<Console, "error" | "info" | "warn">;

export function logEvent(
  logger: Logger,
  level: "error" | "info" | "warn",
  fields: LogFields,
): void {
  logger[level](JSON.stringify(fields));
}
