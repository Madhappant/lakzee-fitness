# System Architecture & Technical Design

Architectural blueprints derived directly from the **Lakzee Fitness Studio** codebase (`web/`, `backend/`, `backend/prisma/schema.prisma`, `scripts/`, and `.github/workflows/`).

Related documentation: [../README.md](../README.md) | [API.md](API.md) | [openapi.yaml](openapi.yaml) | [RUNBOOK.md](RUNBOOK.md)

---

## 1. High-Level Full-Stack & Scaling Architecture

```mermaid
flowchart TB
    subgraph Client["Client Browser & PWA Tier"]
        UI["Next.js 16 App Router UI (Obsidian #0A0A0C / Chalk #F5F5F7 / Volt #D4FF00)"]
        SWR["TanStack Query + localStorage SWR Snapshot (lakzee_swr_cache_v1, 15s staleTime)"]
        SW["Service Worker (/sw.js, lakzee-shell-v1 static bundles & fonts)"]
        RUM["TelemetryObserver (Web Vitals + Redacted Browser Errors)"]
        UI --> SWR
        UI --> SW
        UI --> RUM
    end

    subgraph Edge["Edge & Uptime Layer"]
        Vercel["Vercel Edge CDN (next.config.ts CSP, HSTS, immutable asset cache)"]
        Pinger["External Keep-Alive Pinger (UptimeRobot / Cron-job.org every 5m)"]
        RenderProxy["Render Reverse Proxy (TLS termination -> PORT 5000)"]
    end

    subgraph Backend["Express 5 Multi-Tenant API Tier (backend/)"]
        KeepAlive["24/7 Keep-Alive Loop (SELECT 1 every 4m, 65s keepAliveTimeout)"]
        AppMw["Security & Rate Limit Pipeline (Helmet, CORS, HybridRateLimitStore, Auth/Tenant)"]
        Services["Domain Services & Repositories (Tenant isolation, AuditLog writer, Prisma pool=15)"]
        L1Cache["L1 In-Memory LRU Cache (SimpleMemoryCache max 500 keys)"]
        AppMw --> Services
        Services <--> L1Cache
        KeepAlive -.-> Services
    end

    subgraph Infra["Distributed State, Persistence & External Services"]
        Redis["L2 HybridRedisAdapter (Upstash REST / TCP RESP2 + 15s Circuit Breaker)"]
        Postgres[("PostgreSQL Primary (DATABASE_URL pgbouncer=true + DIRECT_URL)")]
        R2[("Off-Site Backup Bucket (Cloudflare R2 / AWS S3 / Backblaze B2)")]
        BackupJob["Daily 02:00 UTC GitHub Backup (pg_dump -> gzip -> AES-256-GCM -> SHA-256 -> GFS 7/4/12)"]
        Observability["External Sinks (Sentry/GlitchTip Envelopes, Slack/Discord/Telegram Alerts)"]
        MediaAI["Integrations (Cloudinary Uploads, OpenRouter AI, Google Script OTP)"]
    end

    UI <-->|"HTTPS HTML / RSC / Assets"| Vercel
    UI -->|"HTTPS REST + Bearer JWT + HttpOnly Cookie + X-Branch-Id"| RenderProxy
    RUM -->|"POST /api/telemetry/client (sendBeacon)"| RenderProxy
    Pinger -->|"GET /api/health (every 5m)"| RenderProxy
    RenderProxy --> AppMw
    L1Cache <-->|"Shared L2 Cache + Rate Limits"| Redis
    Services <-->|"Prisma Pooled Queries"| Postgres
    Services -.->|"Non-blocking Redacted Envelopes & Webhooks"| Observability
    Services -.->|"Optional Remote Storage / AI / Email OTP"| MediaAI
    Postgres -->|"DIRECT_URL Dump"| BackupJob
    BackupJob -->|"Encrypted .sql.gz.enc + .sha256 + .manifest"| R2
```

---

## 2. Backend Request, Security & Tenant Isolation Pipeline

Every request flows strictly through the middleware chain mounted in `backend/src/app.ts` and route modules in `backend/src/routes/`.

```mermaid
flowchart TD
    Req(["Incoming HTTP Request"]) --> Cors["cors() Strict Origin Check (CLIENT_URL; never * in production)"]
    Cors -->|"Disallowed Origin"| Err403Cors["errorHandler -> 403 CORS Blocked"]
    Cors -->|"Allowed"| Helmet["helmet() Security Headers (CSP default-src none, DENY frame, HSTS, noSniff)"]
    Helmet --> CompApm["compression() + apmMiddleware (hrtime.bigint p50/p95/p99 timer)"]
    CompApm --> BodyParser["Body Parser (512kb limit on /api/ai; 100kb JSON & form limit elsewhere)"]
    BodyParser -->|"> Limit / Bad JSON"| Err413["errorHandler -> 413 PAYLOAD_TOO_LARGE / 400 INVALID_JSON"]
    BodyParser --> Sanitize["sanitizeInputs() Strip __proto__, constructor, prototype, $ operators, XSS tags"]
    Sanitize --> HealthRoute{"Path is /health or /api/health?"}
    HealthRoute -->|"Yes (Exempt)"| HealthCheck["handleHealthCheck() -> 200 OK (db:up) or 503 Draining/DB Down"]
    HealthRoute -->|"No"| RateLimit["HybridRateLimitStore (/api 300/m, /login 10/15m, /refresh 60/15m, /otp 8/15m)"]
    RateLimit -->|"> Limit"| Err429["429 RATE_LIMITED + RateLimit-* Headers"]
    RateLimit -->|"Within Quota"| PublicCheck{"Public Endpoint?"}
    PublicCheck -->|"Yes (/plans get, /contact, /telemetry)"| Validate["validateRequest(Zod) -> req.validated"]
    PublicCheck -->|"No (Protected)"| RequireAuth["requireAuth() Verify Bearer JWT + 5s Auth Cache + resolveTenantScope()"]
    RequireAuth -->|"Missing / Invalid JWT"| Err401["401 Unauthorized"]
    RequireAuth -->|"Non-SUPER_ADMIN requesting foreign branch or all"| Err403Tenant["403 CROSS_BRANCH_FORBIDDEN"]
    RequireAuth -->|"Valid TenantScope"| RequireRole["requireRole() Check Inherited Role Matrix"]
    RequireRole -->|"Role Lacking"| Err403Role["403 Forbidden, insufficient permissions"]
    RequireRole --> Validate
    Validate -->|"ZodError"| Err400["errorHandler -> 400 Validation failed"]
    Validate --> Controller["Controller -> Domain Service -> Repository"]
    Controller --> ServiceGuards["assertBranchOwnership() + L1/L2 Cache Lookup + invalidateTenantCacheScopes()"]
    ServiceGuards --> DB[("PostgreSQL via Prisma")]
    ServiceGuards -.->|"Non-blocking Fire-and-Forget"| Audit["auditService.record() -> AuditLog Table (PII Redacted)"]
    DB --> Response{"Success or Error?"}
    Response -->|"OK"| Envelope["sendSuccess() -> { success: true, status: success, data, meta }"]
    Response -->|"Thrown AppError / Prisma P2002 / Unhandled"| ErrorHandler["errorHandler() Mask 5xx in prod + Sentry captureException"]
```

---

## 3. Database Entity-Relationship Diagram (PostgreSQL / Prisma)

Modelled directly from `backend/prisma/schema.prisma`. All tenant tables carry nullable indexed `branchId` foreign keys backfilled idempotently to Primary Branch `BR-001` (`branch-primary-001`).

```mermaid
erDiagram
    BRANCH {
        string id PK "UUID or branch-primary-001"
        string name UK
        string code UK "e.g. BR-001"
        string location
        string status "ACTIVE | INACTIVE"
        datetime createdAt
        datetime updatedAt
    }

    USER {
        string id PK
        string email UK
        string password "bcrypt cost 12"
        string role "SUPER_ADMIN | BRANCH_ADMIN | ADMIN | RECEPTIONIST | TRAINER | STAFF | MEMBER"
        string branchId FK "Indexed (branchId, role, createdAt)"
        string firstName
        string lastName
        string phone
        datetime createdAt
    }

    REFRESH_SESSION {
        string id PK "JWT jti"
        string familyId "Rotation reuse family"
        string userId FK
        string tokenHash UK "SHA-256 hash"
        datetime expiresAt
        datetime revokedAt
        string replacedById
    }

    STAFF_PROFILE {
        string id PK
        string userId UK
        string designation
        string shiftStart
        string shiftEnd
        string specialization
    }

    MEMBER_PROFILE {
        string id PK
        string branchId FK "Unique per (branchId, memberId)"
        string memberId "Sequential per branch 001..N"
        string userId UK
        string qrCode UK "UUID scanned at reception"
        string trainerId FK "Assigned trainer User.id"
        datetime joiningDate
        datetime createdAt
    }

    MEMBERSHIP_PLAN {
        string id PK
        string branchId FK
        string name
        float price
        int durationDays
        float gstPercentage
        boolean isActive
    }

    SUBSCRIPTION {
        string id PK
        string branchId FK
        string memberId FK
        string planId FK
        datetime startDate
        datetime endDate
        string status "ACTIVE | EXPIRED | FROZEN | CANCELLED"
        string paymentStatus "PAID | PENDING"
        float balanceAmount
    }

    INVOICE {
        string id PK
        string branchId FK
        string invoiceNumber UK
        string memberId FK
        string subscriptionId UK
        float subtotal
        float gstAmount
        float totalAmount
        string status "PENDING | COMPLETED | FAILED | REFUNDED"
    }

    PAYMENT {
        string id PK
        string branchId FK
        string invoiceId FK
        float amount
        string method "CASH | UPI | CREDIT_CARD | DEBIT_CARD | BANK_TRANSFER | SPLIT"
        string status "COMPLETED | ..."
        datetime paymentDate
    }

    EXPENSE {
        string id PK
        string branchId FK
        string title
        string category
        float amount
        datetime date
    }

    ATTENDANCE {
        string id PK
        string branchId FK
        string memberId FK
        datetime checkIn
        datetime checkOut
        datetime date
    }

    DIET_PLAN {
        string id PK
        string memberId FK
        string title
        string mealsData
        boolean isActive
    }

    WORKOUT_ROUTINE {
        string id PK
        string memberId FK
        string title
        string exercisesData
        boolean isActive
    }

    AUDIT_LOG {
        string id PK
        string branchId FK
        string actorId
        string actorRole
        string action "ADMIN_LOGIN | MEMBER_CREATED | ROLE_CHANGED | BRANCH_CREATED..."
        string targetId
        string description
        datetime createdAt
    }

    SETTINGS {
        string id PK
        string branchId UK "One settings record per branch"
        string gymName
        string gstNumber
        string workingHours
    }

    ANNOUNCEMENT {
        string id PK
        string branchId FK
        string authorId FK
        string title
        string message
        datetime createdAt
    }

    CONSULTATION_INQUIRY {
        string id PK
        string branchId FK
        string name
        string phone
        string goal
        string status "NEW | CONTACTED | CONVERTED | CLOSED"
    }

    BRANCH ||--o{ USER : "scopes staff & members"
    BRANCH ||--o{ MEMBER_PROFILE : "isolates roster"
    BRANCH ||--o{ MEMBERSHIP_PLAN : "owns plans"
    BRANCH ||--o{ SUBSCRIPTION : "tracks subscriptions"
    BRANCH ||--o{ INVOICE : "tracks invoices"
    BRANCH ||--o{ PAYMENT : "tracks payments"
    BRANCH ||--o{ EXPENSE : "tracks expenses"
    BRANCH ||--o{ ATTENDANCE : "tracks visits"
    BRANCH ||--o{ AUDIT_LOG : "scopes audit trail"
    BRANCH ||--o| SETTINGS : "configures studio"
    BRANCH ||--o{ ANNOUNCEMENT : "publishes notices"
    BRANCH ||--o{ CONSULTATION_INQUIRY : "captures leads"

    USER ||--o| MEMBER_PROFILE : "has member profile"
    USER ||--o| STAFF_PROFILE : "has staff metadata"
    USER ||--o{ REFRESH_SESSION : "owns refresh tokens"
    USER ||--o{ ANNOUNCEMENT : "authors"
    USER ||--o{ MEMBER_PROFILE : "trains assignedMembers"

    MEMBER_PROFILE ||--o{ SUBSCRIPTION : "subscribes"
    MEMBERSHIP_PLAN ||--o{ SUBSCRIPTION : "defines terms"
    MEMBER_PROFILE ||--o{ INVOICE : "billed"
    SUBSCRIPTION ||--o| INVOICE : "generates"
    INVOICE ||--o{ PAYMENT : "settled by"
    MEMBER_PROFILE ||--o{ ATTENDANCE : "checks in"
    MEMBER_PROFILE ||--o{ DIET_PLAN : "receives"
    MEMBER_PROFILE ||--o{ WORKOUT_ROUTINE : "follows"
```

### Key Compound Indexes & Constraints (`backend/prisma/schema.prisma`)
- **`MemberProfile`:** `@@unique([branchId, memberId])`, `@@index([branchId, memberId])`, `@@index([branchId, createdAt])`, `@@index([branchId, joiningDate])`, `@@index([trainerId])`
- **`User`:** `@@index([branchId, role])`, `@@index([branchId, createdAt])`, `@@index([branchId, role, createdAt])`, `@@index([role, createdAt])`
- **`Subscription` & Ledger:** `Subscription` indexes `(branchId, status, endDate)`, `(branchId, createdAt)`, `(branchId, paymentStatus)`; `Invoice` indexes `(branchId, createdAt)`, `(branchId, status)`; `Payment` indexes `(branchId, paymentDate)`, `(branchId, status, paymentDate)`
- **`Attendance` & `AuditLog`:** `Attendance` `(branchId, date, checkIn(sort: Desc))`, `(memberId, checkOut)`; `AuditLog` `(branchId, createdAt)`, `(branchId, action, createdAt)`

---

## 4. CI/CD Quality Gates & Zero-Downtime Deployment Flow

Derived directly from `.github/workflows/ci.yml`, `.github/workflows/cd.yml`, and `.github/workflows/backup-db.yml`.

```mermaid
flowchart TD
    Push(["Git Push / Pull Request (main or master)"]) --> BackendCI["Job: backend-ci (ci.yml) prisma validate -> build:prod -> test:baseline -> test:coverage -> npm audit"]
    Push --> WebCI["Job: web-ci (ci.yml) eslint -> tsc --noEmit -> next build -> npm audit"]
    BackendCI --> E2ECI["Job: e2e-ci (ci.yml) Playwright Chromium (Desktop + Mobile specs)"]
    WebCI --> E2ECI

    E2ECI -->|"PR / Feature Branch Complete"| DonePR(["CI Status Reported to GitHub"])
    E2ECI -->|"CI Success on main/master triggers cd.yml"| DBMigrate["Job: migrate-database (cd.yml) prisma db push --accept-data-loss=false + npm run db:migrate:branches"]

    DBMigrate --> RenderHook["Job: deploy-backend Trigger RENDER_DEPLOY_HOOK_URL"]
    RenderHook --> HealthLoop["Smoke Test Loop (up to 24 attempts x 10s): GET BACKEND_HEALTH_URL"]
    HealthLoop -->|"HTTP != 200 or db != up"| AutoRollback["Automatic Rollback: POST RENDER_ROLLBACK_HOOK_URL + Fail Pipeline"]
    HealthLoop -->|"HTTP 200 and db = up"| StageWeb["Job: deploy-frontend (Vercel) vercel pull -> vercel build --prod -> deploy --prebuilt --skip-domain"]

    StageWeb --> StageSmoke["Verify Staged URL: GET /login & /manifest.webmanifest return 200"]
    StageSmoke -->|"Smoke Passed"| Promote["Atomic Live Cutover: vercel promote --yes"]
    StageSmoke -->|"Smoke Failed"| BlockPromote(["Live Domain Untouched (No Broken Cutover)"])

    CronBackup(["Daily 02:00 UTC Schedule (backup-db.yml)"]) --> PgDump["pg_dump | gzip -9 | AES-256-GCM | SHA-256 -> R2/S3 Upload + GFS Prune (7d/4w/12m)"]
    PgDump -->|"verify_dry_run=true"| DryRun["restore-db.mjs --latest --dry-run (Checksum + Decryption + Table Check)"]
    PgDump -->|"Failure"| Alert["POST ALERT_WEBHOOK_URL (CRITICAL)"]
```
