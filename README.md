# Lakzee Fitness Studio — Multi-Branch Gym Management System

An enterprise full-stack gym operations platform uniting a **3-color Next.js 16 web application** with a **multi-tenant Express 5 + Prisma + PostgreSQL API**, distributed Redis/in-memory caching, automated encrypted database backups, and zero-downtime CI/CD.

---

## Documentation Suite

| Document | Purpose |
| :--- | :--- |
| **[docs/API.md](docs/API.md)** | Complete endpoint reference, JWT/RBAC matrix, request/response envelopes, sorting/pagination guide, and copy-paste `cURL` examples |
| **[docs/openapi.yaml](docs/openapi.yaml)** | Machine-readable **OpenAPI 3.1.0** specification (Swagger / Redoc / Postman compatible) |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Mermaid.js diagrams covering full-stack topology, request/security pipeline, Prisma PostgreSQL ERD, and CI/CD atomic deployment flow |
| **[docs/RUNBOOK.md](docs/RUNBOOK.md)** | Operations handover handbook: environment secrets checklist, 24/7 keep-alive & Sentry/webhook alerts, backup/DR procedures, and troubleshooting |
| **[docs/DR-RUNBOOK.md](docs/DR-RUNBOOK.md)** | Incident-specific Disaster Recovery playbooks (RPO/RTO targets, SHA-256 verification, `--dry-run` and live restore drills) |
| **[docs/DEPLOYMENT-RUNBOOK.md](docs/DEPLOYMENT-RUNBOOK.md)** | Hosting topology and platform setup notes for Render, Vercel, Supabase/Neon, and Docker |

---

## Key Platform Capabilities

- **Obsidian / Chalk / Volt Lime Design System:** Strict 3-color UI palette (`#0A0A0C` Obsidian Black, `#F5F5F7` Chalk White, `#D4FF00` Volt Lime) across public pages, Admin Studio OS, and the Member Portal (`web/src/app/globals.css`).
- **Natural Sequential Member Sorting:** Default `asc` ordering (`001` -> highest ID) with natural comparison so newly registered members append at the bottom, plus `desc` and `latest` sort modes and server-side cursor pagination (`limit`, `cursor`, `nextCursor`, `hasMore`).
- **24/7 Zero-Loading Performance:**
  - Client SWR snapshot persistence in `localStorage` (`lakzee_swr_cache_v1`, `15s` `staleTime`, `30m` `gcTime`) hydrating cached pages in `0ms` while silently revalidating in the background (`web/src/components/Providers.tsx`, `web/src/lib/query-persistence.ts`).
  - Service Worker shell caching (`web/public/sw.js`, `lakzee-shell-v1`) for hashed `_next/static` assets and fonts without ever intercepting HTML navigations or live `/api/*` traffic.
  - Backend PostgreSQL warm keep-alive ping (`SELECT 1` every `4 minutes`), HTTP `65s` keep-alive timeout aligned above reverse-proxy idle limits, and `/api/health` readiness probes (`backend/src/server.ts`, `backend/src/app.ts`).
- **Enterprise AppSec & RBAC:**
  - Dual-token JWT sessions (`15m` short-lived `Bearer` access token + `7d` rotating `HttpOnly` refresh cookie `lakzee_refresh_token` scoped to `/api/auth` with family revocation on token reuse).
  - Role hierarchy across `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN`, `RECEPTIONIST`, `TRAINER`, `STAFF`, and `MEMBER`.
  - Strict CORS origin allowlist (`CLIENT_URL`), Helmet CSP/HSTS, `100kb` JSON payload cap (`512kb` for `/api/ai`), recursive prototype-pollution/NoSQL/XSS input sanitization, Zod validation, and 7 distributed rate limiters.
- **Multi-Branch Scaling & Distributed Caching:**
  - `Branch` tenancy root (`branch-primary-001` / `BR-001` default) with per-branch sequential Member ID uniqueness (`@@unique([branchId, memberId])`), `SUPER_ADMIN`-only Branch Switcher (`X-Branch-Id` / `?branchId=`), and HTTP `403` enforcement against cross-branch access for all non-`SUPER_ADMIN` roles.
  - `HybridRedisAdapter` supporting Upstash REST (`UPSTASH_REDIS_REST_*`) or TCP/TLS RESP2 (`REDIS_URL`) with a `15s` circuit breaker and seamless in-memory fallback (`backend/src/utils/redis.ts`).
- **Observability & Automated Encrypted Backups:**
  - Non-blocking `AuditLog` persistence, redacted JSON logging, in-process APM latency percentiles (`p50`/`p95`/`p99`), slow-query tracking (`> 200ms`), client Web Vitals ingestion (`POST /api/telemetry/client`), Sentry/GlitchTip envelopes, and Slack/Discord/Telegram alerts.
  - Daily GitHub Actions snapshot pipeline (`.github/workflows/backup-db.yml`): `pg_dump` -> `gzip` -> `AES-256-GCM` encryption (`scrypt`) -> `SHA-256` sidecar -> Cloudflare R2 / AWS S3 / Backblaze B2 upload -> **GFS retention (`7 daily · 4 weekly · 12 monthly`)**.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend (`web/`)** | Next.js `16.2.10` (App Router, Turbopack), React `19.2.4`, TypeScript `5`, Tailwind CSS v4, TanStack React Query `5.101.2`, React Hook Form + Zod, Recharts `3.9.2`, Framer Motion `12.42.2`, Lucide Icons |
| **Backend (`backend/`)** | Node.js `22`, Express `5.2.1`, TypeScript `7`, Prisma `5.21.1`, Zod `4.4.3`, Helmet `8.3.0`, `express-rate-limit` `8.6.2`, `jsonwebtoken`, `bcryptjs` (cost `12`), Multer + Cloudinary, Swagger UI (`swagger-ui-express`) |
| **Database & Cache** | PostgreSQL (`pgbouncer` pooled `DATABASE_URL` + `DIRECT_URL`), Upstash Redis REST / TCP RESP2 + L1 LRU `SimpleMemoryCache` |
| **Testing & QA** | `node:test` (`test:baseline`), Vitest `3.2.7` (`@vitest/coverage-v8`), Supertest `7.3.2`, Playwright `1.65.1` (Desktop + Mobile Chromium) |
| **CI/CD & Infra** | GitHub Actions (`ci.yml`, `cd.yml`, `backup-db.yml`), Render (`render.yaml`), Vercel (`web/vercel.json`), Multi-stage Docker (`docker-compose.prod.yml`) |

---

## Repository Structure

```text
lakzee-fitness/
├── .github/workflows/
│   ├── ci.yml                     # Lint, TypeScript, Prisma check, Unit/Integration coverage & Playwright E2E
│   ├── cd.yml                     # Additive DB sync, Render deploy + health smoke/rollback, Vercel stage & promote
│   └── backup-db.yml              # Daily 02:00 UTC encrypted pg_dump -> R2/S3 with GFS retention & dry-run check
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Multi-branch PostgreSQL schema & compound tenant indexes
│   │   └── seed.ts                # Primary Branch #1 sync, initial staff roles, and default membership plans
│   ├── scripts/
│   │   └── migrate-multi-branch.ts # Idempotent zero-downtime backfill linking legacy records to BR-001
│   ├── src/
│   │   ├── config/                # env.ts (JWT/CORS validation), prisma.ts (pool config), lifecycle.ts (SIGTERM drain)
│   │   ├── controllers/           # Express 5 route handlers calling services & buildSuccess/sendSuccess
│   │   ├── middlewares/           # auth (JWT/RBAC/tenant), validate (Zod), sanitize, apm, error, upload
│   │   ├── repositories/          # Prisma queries isolated behind repository interfaces
│   │   ├── routes/                # Express routers mounted in app.ts under /api/*
│   │   ├── services/              # Domain logic, financial ledger math, tenant cache invalidation, audit writes
│   │   ├── utils/                 # tenant.ts, jwt.ts, redis.ts, cache.ts, rate-limit-store.ts, alerts.ts, telemetry.ts
│   │   ├── validators/            # domain.schemas.ts Zod request validation schemas
│   │   ├── app.ts                 # Middleware stack, rate limiters, /health, /api/health, /api-docs & router mounts
│   │   └── server.ts              # Process bootstrap, IPv4 DNS order, 4m DB keep-alive, graceful shutdown
│   └── tests/                     # Baseline node:test suites, Vitest unit tests, Supertest integration tests & factories
├── web/
│   ├── e2e/                       # Playwright specs (login-dashboard, members-sorting-crud, multi-branch, resilience)
│   ├── public/                    # PWA manifest, static brand assets, sw.js shell Service Worker
│   ├── src/
│   │   ├── app/                   # Next.js App Router public pages, /admin/* Studio OS, and /member/* Portal
│   │   ├── components/            # BranchSwitcher, Providers (SWR persistence), TelemetryObserver, charts & modals
│   │   └── lib/                   # api/* fetch wrapper (silent JWT refresh & X-Branch-Id), branch-context, telemetry
│   ├── next.config.ts             # CSP, security headers, image formats & bundle tree-shaking config
│   └── playwright.config.ts       # Isolated E2E test harness configuration
├── scripts/
│   ├── backup-lib.mjs             # AES-256-GCM encryption/decryption, SHA-256, GFS policy & S3/R2 SigV4 client
│   ├── backup-db.mjs / .sh        # Automated backup CLI
│   └── restore-db.mjs / .sh       # Verified --dry-run and transactional --confirm-restore CLI
├── docs/                          # API.md, openapi.yaml, ARCHITECTURE.md, RUNBOOK.md, DR-RUNBOOK.md, DEPLOYMENT-RUNBOOK.md
├── docker-compose.prod.yml        # Local/self-hosted multi-container production stack
├── render.yaml                    # Render web service build/preDeploy/healthCheck spec
└── package.json                   # Root workspace orchestrator scripts (tests, multi-branch migration, backup/restore)
```

---

## Prerequisites & Local Quickstart (< 5 Minutes)

### Prerequisites
- **Node.js `22.x`** and **npm `10+`**
- **PostgreSQL `15+`** (local Postgres or Supabase/Neon pooled + direct connection strings)
- *(Optional)* **PostgreSQL client tools (`pg_dump`, `psql`)** for running local backup/restore drills
- *(Optional)* **Redis** (local `redis://` or Upstash REST) — falls back cleanly to in-memory cache/rate-limiting when unset

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd lakzee-fitness
npm --prefix backend ci
npm --prefix web ci
```

### 2. Configure Environment Files
Copy the checked-in templates and fill in **your local values** (never commit `.env` files):

```bash
cp backend/.env.example backend/.env
cp web/.env.example web/.env.local
```

Minimum required variables for local development:

- **`backend/.env`**
  - `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://<user>:<password>@localhost:5432/lakzee_gym`)
  - `DIRECT_URL` — Direct PostgreSQL connection string for Prisma schema operations
  - `JWT_SECRET` — Random `64+` character secret (startup fails immediately if empty)
  - `JWT_REFRESH_SECRET` — Distinct `64+` character secret for refresh tokens
  - `CLIENT_URL` — `http://localhost:3000`
- **`web/.env.local`**
  - `NEXT_PUBLIC_API_URL=http://localhost:5000/api`
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`

### 3. Initialize & Seed Database
```bash
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed
npm run db:migrate:branches
cd ..
```

> **Note:** `npx prisma db seed` automatically creates `Branch #1` (`branch-primary-001` / `BR-001`), default membership plans, and starter staff accounts defined in [backend/prisma/seed.ts](backend/prisma/seed.ts). Change any initial credentials before deploying to shared environments.

### 4. Start Backend & Frontend Dev Servers
Open two terminals at `lakzee-fitness/`:

```bash
# Terminal 1 — Express 5 API (http://localhost:5000, Swagger dev UI at http://localhost:5000/api-docs)
npm --prefix backend run dev

# Terminal 2 — Next.js 16 Frontend (http://localhost:3000)
npm --prefix web run dev
```

Verify API readiness at `http://localhost:5000/api/health` (`{"success":true,"db":"up",...}`).

---

## Scripts Reference

### Root Workspace (`package.json`)
| Command | Purpose |
| :--- | :--- |
| `npm run test:unit` | Run backend Vitest unit tests (`backend/tests/unit`) |
| `npm run test:integration` | Run backend Supertest HTTP integration suites (`backend/tests/integration`) |
| `npm run test:coverage` | Run Vitest unit + integration tests with V8 coverage output |
| `npm run test:backend` | Run backend baseline (`node:test`) + unit + integration suites |
| `npm run test:e2e` | Run Playwright end-to-end suite (`web/e2e`) across Desktop & Mobile viewports |
| `npm run test:all` | Sequentially run `test:unit`, `test:integration`, and `test:e2e` |
| `npm run db:migrate:branches` | Execute idempotent single-branch to Primary Branch (`BR-001`) backfill |
| `npm run db:backup` | Run encrypted PostgreSQL backup pipeline (`scripts/backup-db.mjs`) |
| `npm run db:restore` | Run checksum-verified restore pipeline (`scripts/restore-db.mjs`) |

### Backend (`backend/package.json`)
| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Start hot-reloading Express dev server via `tsx watch src/server.ts` |
| `npm run build` | Generate Prisma Client and compile full `tsconfig.json` |
| `npm run build:prod` | Generate Prisma Client and emit stripped `dist/` via `tsconfig.prod.json` |
| `npm run start` | Push Prisma schema, run seed script, and boot `dist/server.js` |
| `npm run start:prod` | Start compiled production server (`node dist/server.js`) |
| `npm run db:deploy` | Push additive Prisma schema updates safely (`--accept-data-loss=false`) |
| `npm run db:push` | Sync `schema.prisma` to target PostgreSQL database |
| `npm run db:studio` | Launch Prisma Studio GUI |
| `npm run test:baseline` | Run `node:test` baseline suites (`backend/tests/*.test.ts`) |

### Frontend (`web/package.json`)
| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Start Next.js 16 dev server on port `3000` |
| `npm run build` | Compile optimized production bundle (`next build`) |
| `npm run start` | Start Next.js production server |
| `npm run lint` | Run ESLint across `web/` |
| `npm run test:e2e` | Execute Playwright browser QA tests |
| `npm run test:e2e:headed` | Execute Playwright suite in visible browser window |
| `npm run test:e2e:report` | Open latest Playwright HTML test report |

### Docker Production Stack (`docker-compose.prod.yml`)
```bash
docker compose -f docker-compose.prod.yml up --build -d
```
*Runs `backend` on `:5000` with healthcheck `/api/health` and `web` on `:3000` waiting for `backend` health readiness.*
