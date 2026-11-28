# Operations, Monitoring & Disaster Recovery Runbook

This operational handover handbook documents every secret, health probe, alerting trigger, backup/restore workflow, and production troubleshooting playbook for **Lakzee Fitness Studio**.

Related references:
- Architecture & topology diagrams: [ARCHITECTURE.md](ARCHITECTURE.md)
- Complete API & RBAC contract: [API.md](API.md) | [openapi.yaml](openapi.yaml)
- Detailed Disaster Recovery playbooks (RPO/RTO scenarios A/B/C): [DR-RUNBOOK.md](DR-RUNBOOK.md)
- Platform hosting & CI/CD overview: [DEPLOYMENT-RUNBOOK.md](DEPLOYMENT-RUNBOOK.md)

---

## 1. Environment Variables & Platform Secrets Checklist

Never commit `.env`, `.env.local`, private keys, or real connection strings into Git. Populate these values strictly inside platform secret managers.

### Backend (`backend/` / Render / Docker)
| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Controls HSTS, Cookie `Secure`/`SameSite`, error stack suppression, JSON request logging, and disabling `/api-docs` |
| `PORT` | No | `5000` | HTTP listen port |
| `DATABASE_URL` | **Yes (Prod)** | `postgresql://<user>:<pass>@<host>:5432/<db>?pgbouncer=true` | Pooled runtime PostgreSQL connection used by Prisma |
| `DIRECT_URL` | **Yes (Migrations/Backup)** | `postgresql://<user>:<pass>@<host>:5432/<db>` | Direct non-pooled Postgres URL required by `prisma db push` and `pg_dump` |
| `PRISMA_CONNECTION_LIMIT` | No | `15` (min `5`) | Appended cleanly when `connection_limit` is absent from `DATABASE_URL` |
| `PRISMA_POOL_TIMEOUT` | No | `15` (min `5`) | Appended cleanly when `pool_timeout` is absent from `DATABASE_URL` |
| `JWT_SECRET` | **Yes** | `<64-char random hex>` | HMAC signing key for short-lived `15m` access tokens (`backend/src/config/env.ts` throws if empty) |
| `JWT_REFRESH_SECRET` | Recommended | `<distinct 64-char hex>` | Signing key for `7d` rotating `HttpOnly` refresh cookies (derives isolated HMAC-SHA256 subkey from `JWT_SECRET` if omitted) |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access JWT TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh JWT & cookie TTL |
| `CLIENT_URL` | **Yes (Prod)** | `https://your-app.vercel.app` | Comma-separated exact HTTPS origins permitted by CORS and production cookie refresh origin checks |
| `UPSTASH_REDIS_REST_URL` | No | *(empty)* | Upstash Redis REST endpoint for distributed cache & rate-limit sharing |
| `UPSTASH_REDIS_REST_TOKEN` | No | *(empty)* | Upstash REST Bearer token |
| `REDIS_URL` | No | *(empty)* | Standard `redis://` / `rediss://` TCP URL (used if Upstash REST vars are unset; falls back to memory automatically) |
| `CLOUDINARY_URL` / `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | No | *(empty)* | Enables remote profile photo uploads; falls back to `backend/uploads/` local volume when unset |
| `GOOGLE_SCRIPT_URL` & `GOOGLE_SCRIPT_SECRET` | If OTP enabled | *(empty)* | Google Apps Script email webhook used by password/phone OTP flows |
| `OPENROUTER_API_KEY` | If AI enabled | *(empty)* | Enables `/api/ai/chat` and `/api/ai/voice` OpenRouter completions |
| `SENTRY_DSN` | Recommended | *(empty)* | Sentry or GlitchTip DSN (`redactSensitiveData` + `sanitizeTelemetryContext` scrub tokens, cookies, emails, phones before sending) |
| `SENTRY_ENVIRONMENT` | No | `production` | Environment tag attached to Sentry envelopes |
| `SLOW_QUERY_THRESHOLD_MS` | No | `200` | Threshold in ms above which Prisma queries emit redacted `slow_database_query` warnings |
| `ERROR_SPIKE_THRESHOLD` | No | `5` | Rolling `60s` `5xx` count triggering `SERVER_ERROR_SPIKE` critical alert |
| `AUTH_SPIKE_THRESHOLD` | No | `5` | Rolling `120s` auth failure count triggering `BRUTE_FORCE_AUTH_SPIKE` warning/critical alert |
| `HIGH_LATENCY_THRESHOLD_MS` | No | `1000` | Average latency across last 20 requests triggering `HIGH_API_LATENCY` alert |
| `ALERT_WEBHOOK_URL` | Recommended | *(empty)* | Slack/Discord-compatible webhook receiving critical/warning SRE alerts & backup failures |
| `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` | No | *(empty)* | Optional Telegram Bot parallel alert delivery |
| `ALERT_COOLDOWN_MS` | No | `300000` (`5m`) | Deduplication window per alert rule key |

### Frontend (`web/` / Vercel)
| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | **Yes** | `https://<api-host>/api` | Backend base URL baked into browser requests (`web/next.config.ts` adds it to CSP `connect-src`) |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `https://<frontend-host>` | Canonical origin used for SEO metadata (`robots.ts`, `sitemap.ts`) |
| `NEXT_PUBLIC_SENTRY_DSN` | No | *(empty)* | Public client Sentry DSN (also documented in `web/.env.example`) |
| `NEXT_OUTPUT_STANDALONE` | Docker only | `1` | Emits `.next/standalone` output inside `web/Dockerfile` |

### GitHub Actions Secrets (`.github/workflows/ci.yml`, `cd.yml`, `backup-db.yml`)
| Secret | Workflow(s) | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `cd.yml`, `backup-db.yml` | Pooled PostgreSQL URL |
| `DIRECT_URL` | `cd.yml`, `backup-db.yml` | Direct PostgreSQL URL for `prisma db push`, `migrate-multi-branch`, and `pg_dump` |
| `RENDER_DEPLOY_HOOK_URL` | `cd.yml` | Triggers zero-downtime backend rollout on Render |
| `RENDER_ROLLBACK_HOOK_URL` | `cd.yml` | Automatically triggers rollback if `/api/health` smoke loop fails (`24 x 10s`) |
| `BACKEND_HEALTH_URL` | `cd.yml` | Public `https://<api-host>/api/health` verified for HTTP `200` + `"db":"up"` |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `cd.yml` | Enables staged Vercel build (`--prebuilt --skip-domain`) -> HTTP `200` smoke -> `vercel promote` |
| `BACKUP_ENCRYPTION_KEY` | `backup-db.yml`, CLI | Minimum 16-char passphrase deriving `AES-256-GCM` keys via `scrypt` |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_REGION` | `backup-db.yml`, CLI | Object storage target (Cloudflare R2, AWS S3, Backblaze B2) for encrypted dumps & GFS pruning |
| `ALERT_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `backup-db.yml` | Backup failure notifications |

---

## 2. 24/7 Keep-Alive, Health Probes & Observability

### Health Endpoints (`backend/src/app.ts`)
- **`GET /health`:** Fast process liveness probe (`Cache-Control: no-store`). Exempt from rate limiting. Add `?deep=1` to run `SELECT 1`.
- **`GET /api/health`:** Production readiness probe used by Render (`render.yaml`), Docker, and `cd.yml`. Runs `SELECT 1` by default (pass `?shallow=1` to skip DB ping) and returns HTTP `200` with `dbLatencyMs`, `cacheHitRate`, Redis mode, Prisma `pool` settings, RSS `memoryMb`, and `uptimeSeconds`.
- **Draining / Failure State (`503`):** Immediately returns HTTP `503` if PostgreSQL fails or after `SIGTERM`/`SIGINT` sets `isServerDraining()` (`backend/src/server.ts`) so load balancers stop routing new traffic during the `10s` graceful drain window.

### Keeping Managed Containers & Pooled Databases Warm
1. **In-process DB Keep-Alive (`backend/src/server.ts`):** Executes `prisma.$queryRaw('SELECT 1')` every `4 minutes` (`240,000ms`), reporting errors via `telemetry.recordHealthFailure`.
2. **External Uptime Monitor:** Point **Cron-job.org** or **UptimeRobot** (`GET`, every `5 minutes`) to `https://<api-host>/api/health`. Alert immediately when status `!= 200`.
3. **Socket Alignment:** Node `server.keepAliveTimeout` (`65000ms`) and `headersTimeout` (`66000ms`) stay above standard `60s` reverse proxies to eliminate spurious `502 Bad Gateway` EOF resets.

### Telemetry, APM & Alerting (`GET /api/metrics`)
Authenticated `SUPER_ADMIN` / `ADMIN` / `BRANCH_ADMIN` callers can inspect live metrics at `GET /api/metrics?limit=25&action=<AUDIT_ACTION>`:
- **APM Summary:** `p50Ms`, `p95Ms`, `p99Ms`, status bucket counts (`2xx`/`3xx`/`4xx`/`5xx`), `slowQueriesCount`, and `recentSlowQueries`.
- **Client RUM Telemetry (`POST /api/telemetry/client`):** Unauthenticated beacon accepting redacted Web Vitals (`LCP`, `INP`, `CLS`, `FCP`, `TTFB`) and unhandled React/ErrorBoundary errors (`TelemetryObserver.tsx`).
- **Alert Rules (`backend/src/utils/alerts.ts`):** Deduplicated per rule with `ALERT_COOLDOWN_MS`:
  - `HEALTH_CHECK_FAILED` (`critical`)
  - `SERVER_ERROR_SPIKE` (`critical` when `>= ERROR_SPIKE_THRESHOLD` 5xx responses occur in `60s`)
  - `BRUTE_FORCE_AUTH_SPIKE` (`warning`/`critical` on repeated `401` or `429` on `/api/auth/login` or `/api/auth/reset-password`)
  - `HIGH_API_LATENCY` (`warning` when rolling 20-request average exceeds `HIGH_LATENCY_THRESHOLD_MS`)

---

## 3. Automated Backups & Disaster Recovery Procedures

### Schedule & Retention (`scripts/backup-db.mjs` + `.github/workflows/backup-db.yml`)
- **Cron Schedule:** Daily at `02:00 UTC` (plus manual `workflow_dispatch`).
- **Pipeline:** `pg_dump --format=plain --no-owner --no-privileges` -> non-empty check -> `gzip` level 9 -> `AES-256-GCM` (`scrypt` salt + 12B IV + 16B GCM authTag) -> `.sha256` & `.manifest.json` -> R2/S3 upload -> GFS pruning (**7 daily · 4 weekly · 12 monthly**).

### Verify Backup Integrity Before Any Restore (`--dry-run`)
```bash
export BACKUP_ENCRYPTION_KEY="<secret-min-16-chars>"
node scripts/restore-db.mjs --latest --backup-dir backups --dry-run
# Or inspect a specific encrypted archive:
node scripts/restore-db.mjs --file backups/lakzee-backup-YYYY-MM-DDTHH-mm-ssZ.sql.gz.enc --dry-run
```
Confirm output reports `"sha256Verified": true` and lists expected PostgreSQL tables (`Branch`, `User`, `MemberProfile`, `AuditLog`, etc.).

### Execute a Transactional Restore (With Safety Guards)
Live execution **refuses to run** without `--confirm-restore` (and requires `--target-db-name <dbname>` for remote hosts). Restores execute atomically via `psql -v ON_ERROR_STOP=1 --single-transaction`:

```bash
export BACKUP_ENCRYPTION_KEY="<secret-min-16-chars>"
node scripts/restore-db.mjs \
  --latest \
  --target-url "$STAGING_DIRECT_URL" \
  --confirm-restore \
  --target-db-name "<staging_db_name>"
```

After restoring or importing records across providers, verify multi-branch relational integrity:
```bash
npm run db:migrate:branches
```
For full incident playbooks (single-row recovery vs corrupted migration vs region/provider outage), follow [DR-RUNBOOK.md](DR-RUNBOOK.md).

---

## 4. Common Troubleshooting

| Symptom | Root Cause in Codebase | Resolution |
| :--- | :--- | :--- |
| **HTTP `403: CORS blocked for origin`** on API calls | `CLIENT_URL` is missing the exact frontend origin (`new URL(origin).origin` match in `backend/src/config/env.ts`), or wildcards `*` were configured (which are rejected). | Add the exact `https://<domain>` origin to `CLIENT_URL` on Render (comma-separated for multiple domains) and restart. Ensure `X-Branch-Id` is not stripped by an upstream proxy. |
| **Silent token refresh loops / unexpected `/login?session_expired=1`** | 1) Cross-origin cookies blocked when `NODE_ENV=production` lacks HTTPS or browser blocks third-party cookies.<br>2) `JWT_SECRET` / `JWT_REFRESH_SECRET` changed between deploys, invalidating active tokens.<br>3) Refresh token reuse detected (`revokedAt != null` revokes entire `familyId`). | Verify `NODE_ENV=production` uses HTTPS (`SameSite=None; Secure` automatically applies cross-origin in `cookies.ts`), keep `JWT_SECRET` & `JWT_REFRESH_SECRET` persistent across deploys, and ensure API base URL ends cleanly in `/api` (`path: '/api/auth'`). |
| **HTTP `403` on Member / Dashboard requests after switching roles** | Non-`SUPER_ADMIN` account attempted to supply `X-Branch-Id`, `?branchId=`, or `body.branchId` targeting another branch (`resolveTenantScope` in `tenant.ts`), or frontend `localStorage.lakzee_active_branch_id` retained a stale branch selector. | Non-`SUPER_ADMIN` accounts are strictly branch-locked. Clear client storage or ensure `apiRequest` (`web/src/lib/api/config.ts`) only injects `X-Branch-Id` when `user.role === 'SUPER_ADMIN'`. |
| **Database connection pool timeouts / exhausted connections** | `DATABASE_URL` points to direct port without PgBouncer, or `PRISMA_CONNECTION_LIMIT` exceeds database plan connection cap across multiple instances. | Point `DATABASE_URL` to Supabase/Neon pooler (`?pgbouncer=true`), keep `DIRECT_URL` for migrations/`pg_dump`, tune `PRISMA_CONNECTION_LIMIT` (default `15`) and `PRISMA_POOL_TIMEOUT` (default `15`), and inspect live settings at `GET /api/health`. |
| **Redis connection errors or rate-limit drift across instances** | `REDIS_URL` / `UPSTASH_REDIS_REST_*` unreachable or unset. `HybridRedisAdapter` opens its `15s` circuit breaker cleanly and falls back to per-process memory without throwing `500`. | Verify Upstash REST credentials or TLS `rediss://` URL connectivity. Note: multi-instance deployments require shared Redis for synchronized cache invalidation and rate-limit counters. |
| **Stale UI data after mutations** | Mutation omitted branch cache key or client SWR snapshot (`15s` `staleTime` in `Providers.tsx`) hasn't finished revalidating. | Backend services call `invalidateTenantCacheScopes(branchId, ...)` automatically clearing both `<base>:<branchId>` and `<base>:all`. Client React Query keys include `activeBranchId` (`["members", activeBranchId]`) and trigger background refetch on mount. |
