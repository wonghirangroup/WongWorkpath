// Tiny in-memory failure counter for the login endpoint. One Render instance serves everything, so
// process memory is enough; a restart just resets the counters, which is acceptable for this use.
interface Bucket {
  failures: number;
  resetAt: number;
}

export function createFailureLimiter(windowMs: number, maxFailures: number) {
  const buckets = new Map<string, Bucket>();

  // Keep the map from growing forever with one-off keys.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, windowMs);
  sweeper.unref();

  const live = (key: string): Bucket | undefined => {
    const bucket = buckets.get(key);
    if (!bucket) return undefined;
    if (bucket.resetAt <= Date.now()) {
      buckets.delete(key);
      return undefined;
    }
    return bucket;
  };

  return {
    // Seconds left on the lockout, or 0 if this key may still try.
    lockedForSeconds(key: string): number {
      const bucket = live(key);
      if (!bucket || bucket.failures < maxFailures) return 0;
      return Math.ceil((bucket.resetAt - Date.now()) / 1000);
    },
    recordFailure(key: string): void {
      const bucket = live(key);
      if (bucket) bucket.failures += 1;
      else buckets.set(key, { failures: 1, resetAt: Date.now() + windowMs });
    },
    reset(key: string): void {
      buckets.delete(key);
    },
  };
}
