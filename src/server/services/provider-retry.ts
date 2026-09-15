export type ProviderFailure = { code: "TIMEOUT" | "RATE_LIMITED" | "UPSTREAM_UNAVAILABLE" | "ACCESS_DISALLOWED" | "INVALID_RESPONSE" };

export function isRetryableProviderFailure(failure: ProviderFailure): boolean {
  return failure.code === "RATE_LIMITED" || failure.code === "UPSTREAM_UNAVAILABLE";
}

export async function retryTransient<T>(
  operation: () => Promise<T>,
  classify: (error: unknown) => ProviderFailure,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<{ outcome: "success"; value: T } | { outcome: "partial" | "error"; failure: ProviderFailure }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return { outcome: "success", value: await operation() };
    } catch (error: unknown) {
      const failure = classify(error);
      if (!isRetryableProviderFailure(failure) || attempt === 2) {
        return { outcome: isRetryableProviderFailure(failure) || failure.code === "TIMEOUT" || failure.code === "ACCESS_DISALLOWED" ? "partial" : "error", failure };
      }
      await wait(250 * 2 ** attempt);
    }
  }
  throw new Error("Unreachable retry state");
}
