interface Bucket {
  tokens: number;
  lastRefill: number;
}

const BUCKET_LIMIT = 5; // Maximum requests allowed in a burst
const REFILL_INTERVAL_MS = 15000; // Time in MS to refill 1 token (refills 5 tokens per 75 seconds)

const ipBuckets = new Map<string, Bucket>();

/**
 * Checks if a given IP address has exceeded the rate limit.
 * Uses a token-bucket algorithm with sliding expiration.
 * Auto-prunes idle entries when the active pool exceeds 1000 IPs.
 */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Periodic cleanup of idle buckets to prevent memory leaks
  if (ipBuckets.size > 1000) {
    const idleTimeout = BUCKET_LIMIT * REFILL_INTERVAL_MS;
    for (const [key, value] of ipBuckets.entries()) {
      if (now - value.lastRefill > idleTimeout) {
        ipBuckets.delete(key);
      }
    }
  }

  let bucket = ipBuckets.get(ip);

  if (!bucket) {
    bucket = { tokens: BUCKET_LIMIT - 1, lastRefill: now };
    ipBuckets.set(ip, bucket);
    return false;
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refillTokens = Math.floor(elapsed / REFILL_INTERVAL_MS);

  if (refillTokens > 0) {
    bucket.tokens = Math.min(BUCKET_LIMIT, bucket.tokens + refillTokens);
    // Keep remainder time to avoid fractional token loss
    bucket.lastRefill = now - (elapsed % REFILL_INTERVAL_MS);
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return false;
  }

  return true;
}
