import { describe, expect, it } from 'vitest';
import { buildPooledDatabaseUrl } from '../../src/config/prisma';
import { HybridRedisAdapter } from '../../src/utils/redis';
import { HybridRateLimitStore } from '../../src/utils/rate-limit-store';
import {
  assertBranchOwnership,
  PRIMARY_BRANCH_ID,
  resolveTenantScope,
  resolveWriteBranchId,
} from '../../src/utils/tenant';
import { ForbiddenError } from '../../src/utils/errors';
// @ts-expect-error Cross-runtime pure ESM helper shared with scheduled CLI backup/restore scripts
import * as backupLib from '../../../scripts/backup-lib.mjs';

describe('Multi-Branch Tenant Scope, Redis Scaling & Encrypted Backup Utilities', () => {
  it('resolves SUPER_ADMIN global/branch scope while strictly blocking cross-branch requests with 403', () => {
    const superGlobal = resolveTenantScope({ userRole: 'SUPER_ADMIN', userBranchId: PRIMARY_BRANCH_ID });
    expect(superGlobal).toEqual({ branchId: null, isGlobalView: true, actorRole: 'SUPER_ADMIN' });

    const superBranchB = resolveTenantScope({
      userRole: 'SUPER_ADMIN',
      userBranchId: PRIMARY_BRANCH_ID,
      requestedBranchId: 'branch-b',
    });
    expect(superBranchB).toEqual({ branchId: 'branch-b', isGlobalView: false, actorRole: 'SUPER_ADMIN' });

    const branchAdminSelf = resolveTenantScope({
      userRole: 'BRANCH_ADMIN',
      userBranchId: 'branch-a',
      requestedBranchId: 'branch-a',
    });
    expect(branchAdminSelf.branchId).toBe('branch-a');

    expect(() =>
      resolveTenantScope({
        userRole: 'BRANCH_ADMIN',
        userBranchId: 'branch-a',
        requestedBranchId: 'branch-b',
      })
    ).toThrow(ForbiddenError);

    expect(() =>
      resolveTenantScope({
        userRole: 'STAFF',
        userBranchId: 'branch-a',
        requestedBranchId: 'all',
      })
    ).toThrow(ForbiddenError);

    expect(() =>
      assertBranchOwnership('branch-b', { branchId: 'branch-a', role: 'BRANCH_ADMIN' })
    ).toThrow(ForbiddenError);

    expect(
      resolveWriteBranchId({
        userRole: 'BRANCH_ADMIN',
        userBranchId: 'branch-a',
      })
    ).toBe('branch-a');
  });

  it('builds pooled PostgreSQL URLs cleanly without clobbering existing parameters or SQLite strings', () => {
    const pooled = buildPooledDatabaseUrl('postgresql://user:pass@db.example.com:5432/gym?pgbouncer=true');
    expect(pooled).toContain('pgbouncer=true');
    expect(pooled).toContain('connection_limit=');
    expect(pooled).toContain('pool_timeout=');

    const custom = buildPooledDatabaseUrl(
      'postgresql://user:pass@db.example.com:5432/gym?connection_limit=30&pool_timeout=25'
    );
    expect(custom).toContain('connection_limit=30');
    expect(custom).toContain('pool_timeout=25');

    expect(buildPooledDatabaseUrl('file:./dev.db')).toBe('file:./dev.db');
  });

  it('gracefully falls back to in-memory rate-limiting and cache when Redis is unconfigured or offline', async () => {
    const offlineRedis = new HybridRedisAdapter({
      upstashUrl: '',
      upstashToken: '',
      redisUrl: '',
    });
    expect(offlineRedis.mode).toBe('memory-fallback');
    expect(offlineRedis.isEnabled()).toBe(false);

    const store = new HybridRateLimitStore('test:rl:', offlineRedis);
    store.init({ windowMs: 60_000 } as never);
    const first = await store.increment('10.0.0.1');
    const second = await store.increment('10.0.0.1');
    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    await store.resetKey('10.0.0.1');
    const afterReset = await store.increment('10.0.0.1');
    expect(afterReset.totalHits).toBe(1);

    // Simulate unreachable remote Redis endpoint -> circuit breaker protects request path
    const brokenRedis = new HybridRedisAdapter({
      redisUrl: 'redis://127.0.0.1:1',
    });
    expect(brokenRedis.mode).toBe('tcp-resp');
    const brokenStore = new HybridRateLimitStore('test:rl:broken:', brokenRedis);
    brokenStore.init({ windowMs: 60_000 } as never);
    const fallbackHit = await brokenStore.increment('10.0.0.2');
    expect(fallbackHit.totalHits).toBe(1);
    expect(brokenRedis.getStatus().healthy).toBe(false);
  });

  it('encrypts with AES-256-GCM, verifies SHA-256, rejects tampered payloads & enforces 7/4/12 GFS retention', () => {
    const sampleSql = 'CREATE TABLE "Branch" ("id" TEXT PRIMARY KEY);\nINSERT INTO "Branch" VALUES (\'branch-primary-001\');';
    const passphrase = 'super-strong-backup-test-passphrase-2026';

    const gz = backupLib.gzipCompress(Buffer.from(sampleSql, 'utf8'));
    const encrypted = backupLib.encryptBufferAes256Gcm(gz, passphrase);
    const digest = backupLib.computeSha256Hex(encrypted);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);

    // Valid decrypt -> decompress roundtrip matches byte-for-byte
    const decryptedGz = backupLib.decryptBufferAes256Gcm(encrypted, passphrase);
    const restoredSql = backupLib.gzipDecompress(decryptedGz).toString('utf8');
    expect(restoredSql).toBe(sampleSql);

    // Wrong key & tampered ciphertext both fail loudly
    expect(() => backupLib.decryptBufferAes256Gcm(encrypted, 'wrong-passphrase-2026-test')).toThrow();
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 5] ^= 0xff;
    expect(() => backupLib.decryptBufferAes256Gcm(tampered, passphrase)).toThrow();

    // Generate 400 daily snapshot filenames across ~13 months -> verify 7 daily, 4 weekly, 12 monthly preserved
    const baseMs = Date.UTC(2026, 10, 28, 2, 0, 0);
    const files: string[] = [];
    for (let dayOffset = 0; dayOffset < 400; dayOffset++) {
      const d = new Date(baseMs - dayOffset * 86_400_000);
      const stamp = d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
      files.push(`lakzee-backup-${stamp}.sql.gz.enc`);
    }

    const retention = backupLib.selectGfsRetentionKeys(files);
    expect(retention.tiers.daily.length).toBe(7);
    expect(retention.tiers.weekly.length).toBe(4);
    expect(retention.tiers.monthly.length).toBe(12);
    expect(retention.keep.length).toBe(23);
    expect(retention.prune.length).toBe(400 - 23);
    // Newest daily snapshot must always be retained
    expect(retention.keep).toContain(files[0]);
  });
});
