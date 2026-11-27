/* eslint-disable @typescript-eslint/no-explicit-any */
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class SimpleMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    // Refresh insertion order for lightweight LRU eviction under memory pressure
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
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

  delete(key: string): void {
    this.cache.delete(key);
  }

  deletePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const CACHE_KEYS = {
  DASHBOARD_STATS: 'dashboard_stats',
  MEMBERSHIP_PLANS: 'membership_plans',
  REPORTS_OVERVIEW: 'reports_overview',
  GYM_SETTINGS: 'gym_settings',
  MEMBERS_LIST: 'members_list',
  SUBSCRIPTIONS_EXPIRY_SYNC: 'subscriptions_expiry_synced_at',
  AUTH_USER_PREFIX: 'auth_user:',
} as const;

export const memoryCache = new SimpleMemoryCache(500);

export type CacheScope = 'dashboard' | 'plans' | 'reports' | 'settings' | 'members' | `auth:${string}`;

export function invalidateCacheScopes(...scopes: CacheScope[]): void {
  for (const scope of scopes) {
    switch (scope) {
      case 'dashboard':
        memoryCache.delete(CACHE_KEYS.DASHBOARD_STATS);
        break;
      case 'plans':
        memoryCache.delete(CACHE_KEYS.MEMBERSHIP_PLANS);
        break;
      case 'reports':
        memoryCache.delete(CACHE_KEYS.REPORTS_OVERVIEW);
        break;
      case 'settings':
        memoryCache.delete(CACHE_KEYS.GYM_SETTINGS);
        break;
      case 'members':
        memoryCache.deletePrefix(CACHE_KEYS.MEMBERS_LIST);
        break;
      default:
        if (scope.startsWith('auth:')) {
          memoryCache.delete(`${CACHE_KEYS.AUTH_USER_PREFIX}${scope.slice(5)}`);
        }
    }
  }
}
