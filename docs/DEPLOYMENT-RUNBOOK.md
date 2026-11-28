# Production Deployment, Zero-Downtime CI/CD & Backup Runbook

## 1. Hosting Architecture
- **Frontend (`web/`):** Next.js 16 on **Vercel** (`vercel.json`, strict CSP/security headers in `next.config.ts`).
- **Backend (`backend/`):** Express 5 + Prisma on **Render** (`render.yaml`, `healthCheckPath: /api/health` for zero-downtime rolling swaps).
- **Database:** PostgreSQL (**Supabase** / **Neon**) via pooled `DATABASE_URL` (`pgbouncer=true`) + direct migration URL `DIRECT_URL`.
- **Container Option:** Multi-stage `backend/Dockerfile`, `web/Dockerfile`, and `docker-compose.prod.yml`.

---

## 2. Required Platform Secrets

### GitHub Actions Secrets (`Repository → Settings → Secrets and variables → Actions`)
| Secret Name | Purpose |
| :--- | :--- |
| `DATABASE_URL` | Pooled PostgreSQL URL (`?pgbouncer=true`) |
| `DIRECT_URL` | Direct PostgreSQL URL used cleanly by `prisma db push` |
| `RENDER_DEPLOY_HOOK_URL` | Render Deploy Hook URL for `lakzee-backend` |
| `RENDER_ROLLBACK_HOOK_URL` | *(Optional)* Webhook to trigger rollback on failed smoke checks |
| `BACKEND_HEALTH_URL` | Public `https://<render-host>/api/health` endpoint verified post-deploy |
| `BACKEND_BASE_URL` | Public `https://<render-host>` root URL used by daily reminder cron workflow |
| `CRON_SECRET` | Secret sent in `X-Cron-Secret` by `.github/workflows/expiry-reminders.yml` |
| `VERCEL_TOKEN` | Vercel CLI access token (for `cd.yml` staged deploy -> promote) |
| `VERCEL_ORG_ID` | Vercel Organization/Team ID |
| `VERCEL_PROJECT_ID` | Vercel Project ID for `lakzee-fitness/web` |

### Render Environment Variables (`lakzee-backend`)
- `NODE_ENV=production`
- `JWT_SECRET=<64-char random hex>`
- `JWT_REFRESH_SECRET=<distinct 64-char random hex>`
- `JWT_ACCESS_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `CLIENT_URL=https://lakzee-fitness.vercel.app` (comma-separated if multiple domains)
- `DATABASE_URL` / `DIRECT_URL`
- `GOOGLE_SCRIPT_URL`, `GOOGLE_SCRIPT_SECRET`, `OPENROUTER_API_KEY` *(if enabled)*

### Vercel Environment Variables (`web`)
- `NEXT_PUBLIC_API_URL=https://<your-render-backend>.onrender.com/api`
- `NEXT_PUBLIC_APP_URL=https://lakzee-fitness.vercel.app`

---

## 3. 24/7 Always-On Health Pinger (`GET /api/health`)
Connect **Cron-job.org** or **UptimeRobot** (`HTTP GET`, every `5 minutes`) to:
`https://<your-render-backend>.onrender.com/api/health`

Configure anomaly alerts (email/Slack) for HTTP `!= 200` (`503` triggers automatically if DB connectivity drops or container is draining).

---

## 4. Database Backups, Multi-Branch Scaling & Disaster Recovery (DR)
1. **Multi-Branch Migration (`backend/scripts/migrate-multi-branch.ts`):** Idempotent zero-downtime script executed during deploy (`npm run db:migrate:branches`) ensuring `Branch #1` (`branch-primary-001` / `BR-001`) exists and linking all legacy rows cleanly.
2. **Distributed Cache & Pooling:** Configure `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or `REDIS_URL`) plus `PRISMA_CONNECTION_LIMIT=15` for multi-instance Render deployments (automatic in-memory fallback when Redis is absent).
3. **Automated Encrypted Off-Site Backups (`.github/workflows/backup-db.yml`):** Daily 02:00 UTC `pg_dump -> gzip -> AES-256-GCM` encrypted upload to Cloudflare R2 / AWS S3 / Backblaze B2 with SHA-256 checksums, webhook failure alerts, and GFS retention (**7 daily · 4 weekly · 12 monthly**). Requires GitHub Secrets `BACKUP_ENCRYPTION_KEY` + `BACKUP_S3_*`.
4. **Full Disaster Recovery Playbook:** See [DR-RUNBOOK.md](./DR-RUNBOOK.md) for RPO (`< 24h` snapshot / `< 15m` PITR), RTO (`< 30m`), `--dry-run` validation, and one-command `scripts/restore-db.mjs` / `scripts/restore-db.sh` recovery steps.

---

## 5. Production Error Tracking, APM & Alerting Setup
- **Backend Sentry / GlitchTip (`SENTRY_DSN`, `SENTRY_ENVIRONMENT`):** Set `SENTRY_DSN` in Render (supports Sentry.io and self-hosted GlitchTip envelope endpoints). All credentials, tokens, cookies, emails, and phones are scrubbed before transmission.
- **Frontend Sentry / Crash Telemetry (`NEXT_PUBLIC_SENTRY_DSN`):** Optional public DSN in Vercel env; unhandled browser errors, chunk load failures, and Web Vitals (`LCP`, `INP`, `CLS`, `FCP`, `TTFB`) stream non-blockingly to `POST /api/telemetry/client`.
- **APM & Slow-Query Threshold (`SLOW_QUERY_THRESHOLD_MS`):** Defaults to `200` ms; queries exceeding threshold log redacted `slow_database_query` warnings and increment counters exposed at Admin-only `GET /api/metrics`.
- **Real-Time Alerts (`ALERT_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ALERT_COOLDOWN_MS`):** Dispatches deduplicated webhook alerts (Slack/Discord JSON or Telegram Bot) on `/api/health` DB failure, `5xx` error spikes, repeated `401`/`429` auth failures, and sustained high latency.
