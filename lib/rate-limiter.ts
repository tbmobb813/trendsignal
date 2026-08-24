import { getSupabaseServerClient } from './supabase-server';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const BUCKET_LIMIT = 5; // Maximum requests allowed in a burst
const REFILL_INTERVAL_MS = 15000; // Time in MS to refill 1 token (refills 5 tokens per 75 seconds)

// Local memory fallback for non-persistent rate limiting (or when DB table is missing)
const ipBuckets = new Map<string, Bucket>();

let isDbTableMissing = false;

function isRateLimitedMemory(ip: string, now: number): boolean {
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

  const elapsed = now - bucket.lastRefill;
  const refillTokens = Math.floor(elapsed / REFILL_INTERVAL_MS);

  if (refillTokens > 0) {
    bucket.tokens = Math.min(BUCKET_LIMIT, bucket.tokens + refillTokens);
    bucket.lastRefill = now - (elapsed % REFILL_INTERVAL_MS);
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return false;
  }

  return true;
}

/**
 * Checks if a given IP address has exceeded the rate limit.
 * Uses a serverless-safe database-backed token bucket, falling back
 * to local memory rate limiting if the `rate_limits` table does not exist.
 */
export async function isRateLimited(ip: string): Promise<boolean> {
  const now = Date.now();

  if (isDbTableMissing) {
    return isRateLimitedMemory(ip, now);
  }

  try {
    const supabase = getSupabaseServerClient();
    
    // Call the atomic database rate limiter RPC function
    const { data: limitExceeded, error } = await supabase.rpc('decrement_rate_limit', {
      client_ip: ip,
      bucket_limit: BUCKET_LIMIT,
      refill_interval_ms: REFILL_INTERVAL_MS
    });

    if (error) {
      if (error.message?.includes('function decrement_rate_limit') || error.message?.includes('does not exist')) {
        console.warn(
          'Supabase RPC function decrement_rate_limit not found. Falling back to local memory rate limiting.\n' +
          'To enable persistent serverless-safe rate limiting, run the SQL in supabase/schema.sql'
        );
        isDbTableMissing = true;
        return isRateLimitedMemory(ip, now);
      }
      console.error('Rate limiter database error:', error);
      // Fallback on db error to preserve availability
      return false;
    }

    return !!limitExceeded;
  } catch (err) {
    console.error('Rate limiter runtime exception:', err);
    return isRateLimitedMemory(ip, now);
  }
}
