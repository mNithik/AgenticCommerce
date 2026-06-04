const startedAt = Date.now();

type BucketConfig = {
  limit: number;
  windowMs: number;
};

const RATE_LIMITS: Record<string, BucketConfig> = {
  runDiligence: { limit: 8, windowMs: 60_000 },
  signSnapshot: { limit: 20, windowMs: 60_000 },
  verifyProof: { limit: 30, windowMs: 60_000 },
  webhookRetry: { limit: 10, windowMs: 60_000 },
};

type Entry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Entry>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}

export function getRateLimitSnapshot() {
  return RATE_LIMITS;
}

export function getUptimeSeconds() {
  return Math.floor((Date.now() - startedAt) / 1000);
}

export function applyRateLimit(
  request: Request,
  bucketName: keyof typeof RATE_LIMITS,
) {
  const config = RATE_LIMITS[bucketName];
  const key = `${bucketName}:${clientKey(request)}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return null;
  }

  if (current.count >= config.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return new Response("Rate limit exceeded.", {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    });
  }

  current.count += 1;
  buckets.set(key, current);
  return null;
}
