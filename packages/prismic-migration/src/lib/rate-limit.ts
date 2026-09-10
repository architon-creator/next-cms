/**
 * Serializes async calls so consecutive invocations are spaced at least
 * `minIntervalMs` apart. Used to respect the Migration API's documented
 * limit of one request per second per repository — every call through
 * lib/prismic-http.ts's migration-document functions is routed through one
 * shared limiter instance, so callers never have to think about spacing
 * requests themselves.
 */
export function createRateLimiter(minIntervalMs: number) {
  let readyAt = 0;

  return async function schedule<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const waitMs = Math.max(0, readyAt - now);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    readyAt = Math.max(now, readyAt) + minIntervalMs;
    return fn();
  };
}
