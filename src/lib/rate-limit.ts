const buckets = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, limit = 10, windowMs = 60_000, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || now - current.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { ok: true as const, remaining: limit - 1 };
  }
  if (current.count >= limit) return { ok: false as const, remaining: 0 };
  current.count += 1;
  return { ok: true as const, remaining: limit - current.count };
}

export function resetRateLimits() {
  buckets.clear();
}
