/**
 * A492 — CF Computation Cache
 *
 * Shared in-memory cache for CF computations (rating, weak tags, review plan).
 * Both /user page and /ai code analysis draw from the same cache.
 *
 * TTL: 5 minutes per user. Cache is per-user, server-side, in-memory only.
 * Invalidated on CF data refresh.
 *
 * NOT a Server Action — this is a plain utility imported by server-only code.
 */

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(userId: string, computation: string): string {
  return userId + "::" + computation;
}

export function getCachedComputation<T>(userId: string, computation: string): T | null {
  var key = cacheKey(userId, computation);
  var entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCachedComputation<T>(userId: string, computation: string, data: T): void {
  var key = cacheKey(userId, computation);
  cache.set(key, { data: data, cachedAt: Date.now() });
}

/** Call after CF data refresh to invalidate user's entire cache */
export function invalidateCfCache(userId: string): void {
  var prefix = userId + "::";
  var keys: string[] = [];
  cache.forEach(function(_, k) {
    if (k.startsWith(prefix)) keys.push(k);
  });
  for (var i = 0; i < keys.length; i++) {
    cache.delete(keys[i]);
  }
}
