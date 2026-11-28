import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { DistributedRedisClient, redisAdapter } from './redis';

interface MemoryBucket {
  totalHits: number;
  expiresAt: number;
}

/**
 * Distributed-ready Express Rate Limit store backed by Redis when configured
 * (sharing request quotas cleanly across load-balanced nodes) with deterministic
 * per-store in-memory fallback when Redis is absent or temporarily unreachable.
 */
export class HybridRateLimitStore implements Store {
  readonly localKeys = false;
  prefix: string;
  private windowMs = 60_000;
  private readonly buckets = new Map<string, MemoryBucket>();

  constructor(
    prefix = 'lakzee:rl:',
    private readonly redis: DistributedRedisClient = redisAdapter
  ) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private pruneExpired(now: number): void {
    if (this.buckets.size < 500) return;
    for (const [k, bucket] of this.buckets.entries()) {
      if (bucket.expiresAt <= now) {
        this.buckets.delete(k);
      }
    }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const namespacedKey = `${this.prefix}${key}`;

    if (this.redis.isEnabled()) {
      const remote = await this.redis.incrWithTtl(namespacedKey, this.windowMs);
      if (remote) {
        return {
          totalHits: remote.count,
          resetTime: new Date(Date.now() + Math.max(remote.ttlMs, 0)),
        };
      }
    }

    const now = Date.now();
    this.pruneExpired(now);

    const existing = this.buckets.get(namespacedKey);
    if (!existing || existing.expiresAt <= now) {
      const expiresAt = now + this.windowMs;
      this.buckets.set(namespacedKey, { totalHits: 1, expiresAt });
      return { totalHits: 1, resetTime: new Date(expiresAt) };
    }

    existing.totalHits += 1;
    return {
      totalHits: existing.totalHits,
      resetTime: new Date(existing.expiresAt),
    };
  }

  async decrement(key: string): Promise<void> {
    const namespacedKey = `${this.prefix}${key}`;
    if (this.redis.isEnabled()) {
      await this.redis.decr(namespacedKey);
      return;
    }

    const existing = this.buckets.get(namespacedKey);
    if (existing && existing.totalHits > 0) {
      existing.totalHits -= 1;
    }
  }

  async resetKey(key: string): Promise<void> {
    const namespacedKey = `${this.prefix}${key}`;
    if (this.redis.isEnabled()) {
      await this.redis.del(namespacedKey);
    }
    this.buckets.delete(namespacedKey);
  }

  async resetAll(): Promise<void> {
    this.buckets.clear();
    if (this.redis.isEnabled()) {
      await this.redis.deletePrefix(this.prefix);
    }
  }
}
