/* eslint-disable @typescript-eslint/no-explicit-any */
import { DistributedRedisClient, redisAdapter } from './redis';
import { scopedCacheKey } from './tenant';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const REDIS_CACHE_PREFIX = 'lakzee:cache:';

export class SimpleMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(
    maxEntries = 500,
    private readonly redis: DistributedRedisClient = redisAdapter
  ) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.misses += 1;
      return null;
    }
    // Refresh insertion order for lightweight LRU eviction under memory pressure
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits += 1;
    return entry.data as T;
  }

  async getDistributed<T>(key: string, ttlSeconds = 60): Promise<T | null> {
    const l1 = this.get<T>(key);
    if (l1 !== null) return l1;

    if (!this.redis.isEnabled()) return null;
    const raw = await this.redis.get(`${REDIS_CACHE_PREFIX}${key}`);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as T;
      this.setLocalOnly(key, parsed, ttlSeconds);
      this.hits += 1;
      if (this.misses > 0) this.misses -= 1;
      return parsed;
    } catch {
      return null;
    }
  }

  private setLocalOnly<T>(key: string, data: T, ttlSeconds: number): void {
    if (ttlSeconds <= 0) return;
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    if (ttlSeconds <= 0) return;
    this.setLocalOnly(key, data, ttlSeconds);

    if (this.redis.isEnabled()) {
      void this.redis.set(`${REDIS_CACHE_PREFIX}${key}`, JSON.stringify(data), ttlSeconds);
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
    if (this.redis.isEnabled()) {
      void this.redis.del(`${REDIS_CACHE_PREFIX}${key}`);
    }
  }

  deletePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
    if (this.redis.isEnabled()) {
      void this.redis.deletePrefix(`${REDIS_CACHE_PREFIX}${prefix}`);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats() {
    const totalLookups = this.hits + this.misses;
    const hitRatePercent =
      totalLookups > 0 ? Math.round((this.hits / totalLookups) * 10000) / 100 : 100;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatePercent,
      entries: this.cache.size,
      maxEntries: this.maxEntries,
      distributed: this.redis.getStatus(),
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

export const CACHE_KEYS = {
  DASHBOARD_STATS: 'dashboard_stats',
  MEMBERSHIP_PLANS: 'membership_plans',
  REPORTS_OVERVIEW: 'reports_overview',
  GYM_SETTINGS: 'gym_settings',
  MEMBERS_LIST: 'members_list',
  BRANCHES_LIST: 'branches_list',
  SUBSCRIPTIONS_EXPIRY_SYNC: 'subscriptions_expiry_synced_at',
  AUTH_USER_PREFIX: 'auth_user:',
  OPERATIONAL_ANALYTICS: 'operational_analytics',
} as const;

export const memoryCache = new SimpleMemoryCache(500);

export type CacheScope =
  | 'dashboard'
  | 'plans'
  | 'reports'
  | 'settings'
  | 'members'
  | 'branches'
  | `auth:${string}`;

function invalidateBaseAndBranch(baseKey: string, branchId?: string | null): void {
  if (branchId) {
    memoryCache.delete(scopedCacheKey(baseKey, branchId));
    memoryCache.delete(scopedCacheKey(baseKey, 'all'));
    memoryCache.delete(baseKey);
    return;
  }
  memoryCache.deletePrefix(baseKey);
}

export function invalidateCacheScopes(...scopes: CacheScope[]): void {
  invalidateTenantCacheScopes(undefined, ...scopes);
}

export function invalidateTenantCacheScopes(
  branchId: string | null | undefined,
  ...scopes: CacheScope[]
): void {
  for (const scope of scopes) {
    switch (scope) {
      case 'dashboard':
        invalidateBaseAndBranch(CACHE_KEYS.DASHBOARD_STATS, branchId);
        invalidateBaseAndBranch(CACHE_KEYS.OPERATIONAL_ANALYTICS, branchId);
        break;
      case 'plans':
        invalidateBaseAndBranch(CACHE_KEYS.MEMBERSHIP_PLANS, branchId);
        break;
      case 'reports':
        invalidateBaseAndBranch(CACHE_KEYS.REPORTS_OVERVIEW, branchId);
        break;
      case 'settings':
        invalidateBaseAndBranch(CACHE_KEYS.GYM_SETTINGS, branchId);
        break;
      case 'branches':
        memoryCache.deletePrefix(CACHE_KEYS.BRANCHES_LIST);
        break;
      case 'members':
        if (branchId) {
          memoryCache.deletePrefix(scopedCacheKey(CACHE_KEYS.MEMBERS_LIST, branchId));
          memoryCache.deletePrefix(scopedCacheKey(CACHE_KEYS.MEMBERS_LIST, 'all'));
        } else {
          memoryCache.deletePrefix(CACHE_KEYS.MEMBERS_LIST);
        }
        break;
      default:
        if (scope.startsWith('auth:')) {
          memoryCache.delete(`${CACHE_KEYS.AUTH_USER_PREFIX}${scope.slice(5)}`);
        }
    }
  }
}
