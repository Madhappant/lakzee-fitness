# Disaster Recovery (DR) & Business Continuity Runbook

## 1. Recovery Objectives (RPO & RTO)

| Recovery Tier | Mechanism | Target | Scope |
| :--- | :--- | :--- | :--- |
| **RPO (Managed WAL PITR)** | Supabase / Neon continuous Point-in-Time Recovery | **< 15 minutes** | Point-in-time rollback before accidental deletes or corruption |
| **RPO (Encrypted Off-Site Snapshot)** | Daily `.github/workflows/backup-db.yml` (`pg_dump -> gzip -> AES-256-GCM -> R2/S3`) | **< 24 hours** (configurable to `< 1 hour` cron) | Vendor-independent cross-cloud encrypted backup |
| **RTO (Standard DB Recovery)** | One-command verified `scripts/restore-db.mjs` / `restore-db.sh` into standby Postgres + Render env swap | **< 30 minutes** | Full database restoration and API recovery |
| **GFS Retention Policy** | Automatic pruning after each backup run | **7 daily · 4 weekly · 12 monthly** | Covers rolling 1-year history while bounding storage cost |

---

## 2. Backup Security & Integrity Guarantees
- **Compression & Cipher:** Streams PostgreSQL plain-SQL dump through `gzip` level 9 and `AES-256-GCM` with `scrypt` key derivation (`BACKUP_ENCRYPTION_KEY` secret — never committed).
- **Tamper & Empty Detection:** Aborts immediately if dump size is `0` bytes; writes `.sha256` + `.manifest.json` sidecars alongside every `.sql.gz.enc` artifact and triggers `ALERT_WEBHOOK_URL` / Telegram alerts on failure.
- **Safety Guards During Restore:**
  1. SHA-256 verification runs **before** decryption; tampered files fail immediately.
  2. Authenticated GCM tag rejects corrupted payloads or wrong passphrases.
  3. Live restores execute inside a single PostgreSQL transaction (`ON_ERROR_STOP=1 --single-transaction`).
  4. **Mandatory confirmation guard:** Live execution refuses to run without `--confirm-restore`, and remote non-localhost restores additionally require `--target-db-name <dbname>`.

---

## 3. One-Command Verification & Restore Reference

### Always Validate First (`--dry-run`)
```bash
export BACKUP_ENCRYPTION_KEY="<secret>"
node scripts/restore-db.mjs --latest --dry-run
# Or inspect a specific encrypted artifact / R2 key:
bash scripts/restore-db.sh --file backups/lakzee-backup-YYYY-MM-DDTHH-mm-ssZ.sql.gz.enc --dry-run
```

### Execute Staging or Recovery Restore
```bash
export BACKUP_ENCRYPTION_KEY="<secret>"
node scripts/restore-db.mjs \
  --latest \
  --target-url "$STAGING_DIRECT_URL" \
  --confirm-restore \
  --target-db-name "<staging_db_name>"
```

---

## 4. Incident Playbooks

### Scenario A: Accidental Member Deletion (Single Tenant / Row Recovery)
1. **Contain & Audit:** Query `GET /api/metrics` (as `SUPER_ADMIN`) or inspect `AuditLog` for `MEMBER_DELETED` (`actorId`, `targetId`, `branchId`, `createdAt`) to establish the exact deletion timestamp.
2. **Isolate Restore Target:** Provision a clean staging database (`STAGING_DIRECT_URL`). Never restore directly over live production for single-row recovery.
3. **Dry-Run & Restore Snapshot to Staging:**
   ```bash
   node scripts/restore-db.mjs --latest --target-url "$STAGING_DIRECT_URL" --confirm-restore --target-db-name "<staging_db>"
   ```
   *(If deletion happened within the last 15 minutes and PITR is enabled, fork/restore via Supabase/Neon PITR to `timestamp - 1 minute`.)*
4. **Extract & Re-Import Missing Records:** Export the recovered `"User"`, `"MemberProfile"`, `"Subscription"`, `"Invoice"`, and `"Payment"` rows from staging and upsert back into production under the original `branchId` so member IDs (`001..N`) stay intact.
5. **Invalidate Branch Cache:** Trigger branch cache clear or let short TTL (`30s`) expire cleanly.

### Scenario B: Database Corruption or Bad Schema Migration
1. **Halt CI/CD:** Cancel any pending `CD Zero-Downtime Deploy` workflow runs in GitHub Actions.
2. **Enable Drain / Maintenance:** Verify Render health probe state; keep existing healthy read replicas intact if possible.
3. **Verify Latest Backup Integrity:** Run `node scripts/restore-db.mjs --latest --dry-run` and inspect `"tablesDetected"` & `"sha256Verified": true`.
4. **Restore into Fresh Replacement Database:** Create a clean Postgres database (`NEW_DIRECT_URL`), run the confirmed restore command:
   ```bash
   node scripts/restore-db.mjs --latest --target-url "$NEW_DIRECT_URL" --confirm-restore --target-db-name "<new_db>"
   ```
5. **Run Multi-Branch Integrity Check & Cut Over:**
   - Run `DIRECT_URL="$NEW_DIRECT_URL" DATABASE_URL="$NEW_DIRECT_URL" npx tsx backend/scripts/migrate-multi-branch.ts` to verify all branch FKs and counts.
   - Update Render `DATABASE_URL` / `DIRECT_URL` env vars and verify `GET /api/health` returns `200 {"db":"up"}`.

### Scenario C: Full Hosting Provider Outage (Supabase / Neon or Render)
1. **Database Provider Down:** Provision a new Postgres instance on an alternate provider (e.g., Neon / AWS RDS / Supabase backup region) -> restore latest off-site encrypted R2/S3 snapshot (`BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `--latest --confirm-restore`) -> point Render `DATABASE_URL` / `DIRECT_URL` to the new host.
2. **Backend Host (Render) Down:** Deploy `backend/Dockerfile` with existing Render secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `REDIS_URL` / `UPSTASH_REDIS_REST_*`) to Cloud Run / Fly.io / Railway, verify `/api/health`, and update Vercel `NEXT_PUBLIC_API_URL` + redeploy Vercel.
3. **Redis Provider Outage:** No manual failover required — `HybridRedisAdapter` automatically trips its `15s` circuit breaker and degrades gracefully to L1 in-memory caching & rate limiting with zero HTTP 500s.
