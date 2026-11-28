# Lakzee Fitness Studio — REST API Documentation

- **Base URL (Local):** `http://localhost:5000/api` (health probe also at `/health`; non-production Swagger preview at `GET /api-docs`)
- **Base URL (Production):** `https://<api-host>/api`
- **Machine-Readable Spec:** [openapi.yaml](openapi.yaml) (**OpenAPI 3.1.0**)

---

## 1. Authentication, Security & Multi-Branch Tenancy

### Dual-Token JWT Architecture
1. **Access Token (`Bearer`):** Short-lived JWT (`JWT_ACCESS_EXPIRES_IN=15m`) returned in JSON (`data.accessToken` / `data.token`) on `/auth/login`, `/auth/register`, and `/auth/refresh`. Contains `{ id, role, branchId, tokenType: "access" }`. Send in `Authorization: Bearer <access_token>`.
2. **Refresh Token (`HttpOnly` Cookie):** `7d` JWT stored in `lakzee_refresh_token` (`HttpOnly: true`, `Path=/api/auth`, `Secure: NODE_ENV=production`, `SameSite: strict` same-origin / `none` cross-origin in production / `lax` in development).
3. **Silent Rotation & Reuse Detection:** Calling `POST /api/auth/refresh` revokes the previous refresh row (`RefreshSession`), issues a rotated pair in the same `familyId`, and immediately revokes the entire `familyId` + returns `401` if a previously used refresh token is replayed.

### Tenant Scoping Header & Query (`X-Branch-Id` / `branchId`)
- Requests are scoped in `requireAuth` (`backend/src/middlewares/auth.middleware.ts`) via `X-Branch-Id`, `?branchId=`, or `body.branchId`:
  - **`SUPER_ADMIN`:** Defaults to global multi-branch mode (`branchId: null`, returned as `"all"` in metadata) or scopes to any specific branch UUID/`branch-primary-001`.
  - **All other authenticated roles (`BRANCH_ADMIN`, `ADMIN`, `RECEPTIONIST`, `TRAINER`, `STAFF`, `MEMBER`):** Strictly locked to their JWT/DB assigned branch (`branch-primary-001` default for legacy accounts). Supplying any other `branchId` or `"all"` fails immediately with **HTTP `403`** (`CROSS_BRANCH_FORBIDDEN` / `FORBIDDEN`).

### Rate Limiters (`backend/src/app.ts`)
Backed by Redis (`HybridRateLimitStore`) when `REDIS_URL` / `UPSTASH_REDIS_REST_*` are set, with automatic per-limiter in-memory fallback. All rate limiters expose standard `RateLimit-*` headers and emit HTTP `429` (`code: "RATE_LIMITED"`). Exempt routes: `/health`, `/api/health`.

| Limiter | Scope | Window | Max Requests |
| :--- | :--- | :--- | :--- |
| Global API | `/api/*` | `1 minute` | `300` |
| Auth Endpoints | `/api/auth/login`, `/register`, `/request-otp`, `/request-phone-otp` | `15 minutes` | `10` |
| Token Refresh | `/api/auth/refresh` | `15 minutes` | `60` |
| OTP Verification | `/api/auth/reset-password`, `/verify-phone` | `15 minutes` | `8` |
| AI Assistant | `/api/ai/*` (`512kb` JSON limit) | `15 minutes` | `30` |
| Lead Contact | `/api/contact` | `15 minutes` | `10` |
| Client Telemetry | `/api/telemetry/*` | `1 minute` | `120` |

### RBAC Permission Matrix (`backend/src/middlewares/auth.middleware.ts`)
`ADMIN` and `BRANCH_ADMIN` share operational authority within their assigned branch; only `SUPER_ADMIN` can provision/edit branches or switch branches globally.

| Capability / Domain | `SUPER_ADMIN` | `BRANCH_ADMIN` | `ADMIN` | `RECEPTIONIST` | `TRAINER` | `STAFF` | `MEMBER` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Create / Update Branches | Yes | — | — | — | — | — | — |
| Switch Cross-Branch Scope (`X-Branch-Id` / `all`) | Yes | — | — | — | — | — | — |
| List Assigned Branch Details | All | Own | Own | Own | Own | Own | — |
| Dashboard Stats (`GET /dashboard/stats`) | Yes | Yes | Yes | Yes | — | Yes | — |
| Members Read (`GET /members`) | Yes | Yes | Yes | Yes | Yes | Yes | Own ID only |
| Members Create / Update | Yes | Yes | Yes | Yes | — | Yes | — |
| Members Delete | Yes | Yes | Yes | — | — | — | — |
| Plans Create / Update / Delete | Yes | Yes | Yes | — | — | — | — |
| Subscriptions Create / Update | Yes | Yes | Yes | Yes | — | Yes | — |
| Subscriptions Delete | Yes | Yes | Yes | — | — | — | — |
| Attendance Check-In / Check-Out | Yes | Yes | Yes | Yes | — | Yes | — |
| Diet & Workout Assign (`POST`) | Yes | Yes | Yes | — | Yes | Yes | — |
| Financial Reports (`GET /reports`) | Yes | Yes | Yes | — | — | — | — |
| Staff Roles (`GET`, `/assign`, `/revoke`) | Yes | Own Branch | Own Branch | — | — | — | — |
| Studio Settings (`PUT /settings`) | Yes | Yes | Yes | — | — | — | — |
| Observability & Audit Logs (`GET /metrics`) | All | Own Branch | Own Branch | — | — | — | — |
| Member Portal (`/api/portal/*`) | — | — | — | — | — | — | Self only |

---

## 2. Standardized Envelopes & HTTP Status Codes

### Success Envelope (`buildSuccessEnvelope`)
```json
{
  "success": true,
  "status": "success",
  "message": "Optional human-readable confirmation",
  "data": {},
  "meta": {
    "total": 42,
    "count": 42,
    "sort": "asc",
    "cached": false,
    "branchId": "branch-primary-001"
  }
}
```

### Error Envelope (`errorHandler`)
```json
{
  "success": false,
  "status": "error",
  "code": "CROSS_BRANCH_FORBIDDEN",
  "message": "Forbidden: Cross-branch access is denied",
  "errors": [
    {
      "path": ["email"],
      "message": "Invalid email"
    }
  ]
}
```
*(In `production`, unexpected `500` errors mask internal database messages with `"Internal server error"` and never emit stack traces.)*

### Common HTTP Status Codes
| Status | Meaning |
| :--- | :--- |
| `200` | Request succeeded |
| `201` | Resource created (`register`, `createBranch`, `createMember`, `createPlan`, `createSubscription`, `checkIn`, `createExpense`, `createAnnouncement`, `assignDietPlan`, `assignWorkoutRoutine`, `contact`) |
| `202` | Telemetry beacon accepted asynchronously (`POST /api/telemetry/client`) |
| `400` | Zod schema validation failure, invalid Multer file upload, duplicate unique value (`P2002`), or malformed JSON (`INVALID_JSON`) |
| `401` | Missing/expired/invalid `Bearer` JWT or invalid/reused refresh cookie |
| `403` | Role denied (`requireRole`), cross-branch violation (`resolveTenantScope`/`assertBranchOwnership`), or CORS block |
| `404` | Unmatched route or missing entity (`P2025`) |
| `413` | Request body exceeds `100kb` (or `512kb` for `/api/ai`) (`PAYLOAD_TOO_LARGE`) |
| `429` | Rate limiter threshold exceeded (`RATE_LIMITED`) |
| `500` | Unhandled server exception |
| `502` | Upstream email webhook or AI provider failure (`UPSTREAM_ERROR`) |
| `503` | Database unreachable or server draining on shutdown (`/health`, `/api/health`) |

---

## 3. Endpoint Catalog by Domain

### A. Authentication (`/api/auth`)

| Method | Path | Auth | Limiter | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | `authLimiter` | Register a new `MEMBER` under default primary branch and set refresh cookie (`201`) |
| `POST` | `/api/auth/login` | Public | `authLimiter` | Authenticate email/password, emit `Bearer` JWT + refresh cookie, write `ADMIN_LOGIN`/`LOGIN_FAILED` AuditLog (`200`) |
| `POST` | `/api/auth/refresh` | Cookie | `refreshLimiter` | Rotate refresh token cookie and issue fresh `15m` access token (`200`) |
| `POST` | `/api/auth/logout` | Cookie / Optional Bearer | Global | Revoke refresh session family/record and clear `lakzee_refresh_token` cookie (`200`) |
| `POST` | `/api/auth/request-otp` | Public | `authLimiter` | Send 6-digit password-reset OTP email via Google Apps Script (`200`) |
| `POST` | `/api/auth/reset-password` | Public | `otpVerifyLimiter` | Verify 6-digit email OTP and update bcrypt password (`200`) |
| `POST` | `/api/auth/request-phone-otp` | Bearer | `authLimiter` | Send 6-digit OTP to member email to authorize phone update (`200`) |
| `POST` | `/api/auth/verify-phone` | Bearer | `otpVerifyLimiter` | Verify phone update OTP and persist `phone` (`200`) |

#### `POST /api/auth/login`
- **Request Body:**
  ```json
  {
    "email": "admin@example.com",
    "password": "StrongPass!Example1"
  }
  ```
- **Response (`200 OK`) & Error (`401 Unauthorized`):**
  ```json
  {
    "success": true,
    "status": "success",
    "data": {
      "user": {
        "id": "uuid",
        "email": "admin@example.com",
        "role": "SUPER_ADMIN",
        "branchId": "branch-primary-001",
        "firstName": "Studio",
        "lastName": "Owner"
      },
      "token": "<jwt_access_token>",
      "accessToken": "<jwt_access_token>"
    }
  }
  ```
  ```json
  { "success": false, "status": "error", "code": "UNAUTHORIZED", "message": "Invalid email or password" }
  ```
- **cURL Example:**
  ```bash
  curl -i -c cookies.txt -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"StrongPass!Example1"}'
  ```

#### `POST /api/auth/register`
```bash
curl -c cookies.txt -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"member@example.com","password":"StrongPass!Example1","firstName":"Aarav","lastName":"One"}'
```

#### `POST /api/auth/refresh` & `POST /api/auth/logout`
```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/refresh
curl -b cookies.txt -X POST http://localhost:5000/api/auth/logout -H "Authorization: Bearer <access_token>"
```

#### Password & Phone OTP Endpoints
```bash
curl -X POST http://localhost:5000/api/auth/request-otp \
  -H "Content-Type: application/json" -d '{"email":"member@example.com"}'

curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" -d '{"email":"member@example.com","otp":"123456","newPassword":"NewStrongPass!1"}'

curl -X POST http://localhost:5000/api/auth/request-phone-otp \
  -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" -d '{"newPhone":"+919876543210"}'

curl -X POST http://localhost:5000/api/auth/verify-phone \
  -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" -d '{"otp":"123456"}'
```

---

### B. Dashboard & Financial Reports (`/api/dashboard`, `/api/reports`)

| Method | Path | Roles | Cache TTL |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/stats` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN`, `RECEPTIONIST`, `STAFF` | `30s` (`L1/Redis`) branch-scoped |
| `GET` | `/api/reports` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN` | `30s` (`L1/Redis`) branch-scoped |

#### `GET /api/dashboard/stats`
- **Optional Header / Query:** `X-Branch-Id: <branchId|all>` (exclusive to `SUPER_ADMIN`).
- **Sample Response (`200 OK`):**
  ```json
  {
    "success": true,
    "status": "success",
    "data": {
      "activeMembers": 48,
      "todaysCheckIns": 19,
      "newSignups": 6,
      "monthlyRevenue": 94500,
      "todaysCollection": 4500,
      "expiringIn7Days": 3,
      "expiredMembers": 5,
      "birthdaysThisMonth": 2,
      "totalPendingAmount": 3000,
      "branchId": "branch-primary-001",
      "revenueLast14Days": [{ "name": "Nov 28", "revenue": 4500 }],
      "recentActivity": [],
      "pendingMembersList": [],
      "expiringMembersList": [],
      "expiredMembersList": []
    },
    "meta": { "cached": true, "branchId": "branch-primary-001" }
  }
  ```
- **cURL Example:**
  ```bash
  curl -H "Authorization: Bearer <access_token>" \
    -H "X-Branch-Id: branch-primary-001" \
    http://localhost:5000/api/dashboard/stats

  curl -H "Authorization: Bearer <access_token>" \
    http://localhost:5000/api/reports
  ```

---

### C. Members, Sorting & Cursor Pagination (`/api/members`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/members` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN`, `RECEPTIONIST`, `TRAINER`, `STAFF` | Sorted member directory with optional cursor pagination |
| `POST` | `/api/members` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN`, `RECEPTIONIST`, `STAFF` | Create member + auto-allocate next per-branch sequential `memberId` (`001..N`) |
| `GET` | `/api/members/:id` | Staff + `MEMBER` (`self` only) | Full member profile, subscriptions, invoices, routines |
| `PUT` | `/api/members/:id` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN`, `RECEPTIONIST`, `STAFF` | Update member profile/photo/branch (`SUPER_ADMIN`) |
| `DELETE` | `/api/members/:id` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN` | Delete member and cascade related records; logs `MEMBER_DELETED` |

#### `GET /api/members` Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `sort` | `asc \| desc \| latest` | `asc` | `asc`: natural `001 -> last`; `desc`: `last -> 001`; `latest`: `createdAt desc` |
| `branchId` | `string` | Token branch (or `all` for `SUPER_ADMIN`) | Overrides active branch for `SUPER_ADMIN` (`403` for other roles) |
| `limit` | `integer (1..200)` | Omit = full list | Enables cursor pagination (`take: limit + 1`) |
| `cursor` | `string` (`User.id`) | `undefined` | Cursor ID returned as `meta.nextCursor` on the previous page |

- **Sample Response (`200 OK`):**
  ```json
  {
    "success": true,
    "status": "success",
    "data": [
      {
        "id": "user-uuid-001",
        "email": "member@example.com",
        "firstName": "Aarav",
        "lastName": "One",
        "phone": "9876543210",
        "role": "MEMBER",
        "branchId": "branch-primary-001",
        "createdAt": "2026-11-28T05:00:00.000Z",
        "memberProfile": {
          "id": "profile-uuid-001",
          "branchId": "branch-primary-001",
          "memberId": "001",
          "photoUrl": null,
          "gender": "MALE",
          "bloodGroup": "O+",
          "joiningDate": "2026-11-28T05:00:00.000Z",
          "qrCode": "qr-uuid-001",
          "subscriptions": []
        }
      }
    ],
    "meta": {
      "total": 120,
      "count": 100,
      "sort": "asc",
      "cached": false,
      "branchId": "branch-primary-001",
      "limit": 100,
      "nextCursor": "user-uuid-100",
      "hasMore": true
    }
  }
  ```

#### `POST /api/members` Payload (`application/json` or `multipart/form-data` with `photo` max 5MB)
- Required: `email`, `password` (min `6`), `firstName`, `lastName`
- Optional: `branchId` (`SUPER_ADMIN`), `phone`, `gender` (`MALE | FEMALE | OTHER`), `dob`, `bloodGroup`, `address`, `emergencyContact`, `photo`

- **cURL Examples:**
  ```bash
  # Default ascending list with cursor pagination
  curl -H "Authorization: Bearer <access_token>" \
    "http://localhost:5000/api/members?sort=asc&limit=100"

  # Create member (JSON)
  curl -X POST http://localhost:5000/api/members \
    -H "Authorization: Bearer <access_token>" \
    -H "Content-Type: application/json" \
    -d '{"email":"new.member@example.com","password":"StrongPass!Example1","firstName":"Priya","lastName":"Twelve","gender":"FEMALE"}'

  # Update & delete member
  curl -X PUT http://localhost:5000/api/members/<user_id> \
    -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" -d '{"phone":"9876500001"}'

  curl -X DELETE http://localhost:5000/api/members/<user_id> \
    -H "Authorization: Bearer <access_token>"
  ```

---

### D. Branches (`/api/branches`)

| Method | Path | Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/branches` | All staff/admin roles | Returns all branches (`SUPER_ADMIN`) or only caller's branch |
| `GET` | `/api/branches/:id` | All staff/admin roles | Fetch branch details (`403` on cross-branch for non-`SUPER_ADMIN`) |
| `POST` | `/api/branches` | `SUPER_ADMIN` only | Provision a new branch (`code` auto-generated `BR-XXX` if omitted); logs `BRANCH_CREATED` (`201`) |
| `PUT` | `/api/branches/:id` | `SUPER_ADMIN` only | Update branch name/code/location/status (`ACTIVE \| INACTIVE`); logs `BRANCH_UPDATED` (`200`) |

- **cURL Examples:**
  ```bash
  curl -H "Authorization: Bearer <super_admin_token>" http://localhost:5000/api/branches

  curl -X POST http://localhost:5000/api/branches \
    -H "Authorization: Bearer <super_admin_token>" \
    -H "Content-Type: application/json" \
    -d '{"name":"Anna Nagar Flagship","code":"BR-002","location":"Chennai West","status":"ACTIVE"}'

  curl -X PUT http://localhost:5000/api/branches/<branch_id> \
    -H "Authorization: Bearer <super_admin_token>" \
    -H "Content-Type: application/json" \
    -d '{"status":"INACTIVE"}'
  ```

---

### E. Attendance, Billing, Plans & Expenses

| Method | Path | Roles | Key Params / Payload |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/attendance` | `ADMIN`, `RECEPTIONIST`, `TRAINER`, `STAFF` (+ admins) | Optional `?start=<ISO>&end=<ISO>` |
| `POST` | `/api/attendance/checkin` | `ADMIN`, `RECEPTIONIST`, `STAFF` (+ admins) | `{ "lakzeeId": "001 \| <qrUuid> \| <name>" }` (`16h` active session guard) |
| `POST` | `/api/attendance/checkout` | `ADMIN`, `RECEPTIONIST`, `STAFF` (+ admins) | `{ "lakzeeId": "001 \| <qrUuid>" }` |
| `GET` | `/api/plans` | Public | Optional `X-Branch-Id` / `?branchId=`, returns active catalog (`200`) |
| `POST \| PUT \| DELETE` | `/api/plans[/:id]` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN` | `{ name, description?, price, durationDays, gstPercentage?, isActive? }` |
| `GET` | `/api/subscriptions` | `ADMIN`, `RECEPTIONIST`, `STAFF` (+ admins) | `?search`, `?status`, `?paymentStatus` |
| `GET` | `/api/subscriptions/stats` | `ADMIN`, `RECEPTIONIST`, `STAFF` (+ admins) | Branch payment summary metrics |
| `POST \| PUT` | `/api/subscriptions[/:id]` | `ADMIN`, `RECEPTIONIST`, `STAFF` (+ admins) | `{ memberId, planId, startDate, paymentStatus?, paymentMethod?, balanceAmount? }` (`DELETE`: admins only) |
| `GET \| POST \| PUT` | `/api/expenses[/:id]` | `ADMIN`, `RECEPTIONIST`, `STAFF` (+ admins) | `GET` `?month=<1-12>&year=<YYYY>`, body `{ title, category, amount, date?, paymentMethod?, notes? }` (`DELETE`: admins only) |

```bash
# Check-in by sequential ID or QR UUID
curl -X POST http://localhost:5000/api/attendance/checkin \
  -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" -d '{"lakzeeId":"001"}'

# Create subscription + ledger invoice/payment
curl -X POST http://localhost:5000/api/subscriptions \
  -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
  -d '{"memberId":"<profile_uuid>","planId":"<plan_uuid>","startDate":"2026-11-28","paymentStatus":"PAID","paymentMethod":"UPI","balanceAmount":0}'
```

---

### F. Staff, Settings, Announcements, Notifications, Portal, Routines, AI & Contact

| Method | Path | Auth / Roles | Notes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/staff` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN` | List staff accounts scoped to tenant |
| `POST` | `/api/staff/assign` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN` | `{ userId, role, branchId? }` (`ROLE_CHANGED` audit log; `SUPER_ADMIN` grant reserved for `SUPER_ADMIN`) |
| `POST` | `/api/staff/:id/revoke` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN` | Demotes staff member back to `MEMBER` |
| `GET` | `/api/settings` | Public | Returns branch studio config (`300s` cache) |
| `PUT` | `/api/settings` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN` | `{ gymName?, logoUrl?, branch?, workingHours?, gstNumber?, address?, contactEmail?, contactPhone? }` |
| `GET` | `/api/announcements` | Bearer (all authenticated) | Branch announcements list |
| `POST \| DELETE` | `/api/announcements[/:id]` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN` | `{ title, message }` |
| `GET` | `/api/notifications` | Bearer (all authenticated) | Upcoming expirations/birthdays (`?tzOffset=<minutes>`) |
| `GET` | `/api/portal/me` \| `/attendance` \| `/subscriptions` \| `/diet` \| `/workout` | `MEMBER` | Self-service member portal endpoints |
| `POST` | `/api/portal/photo` | `MEMBER` | `multipart/form-data` (`photo`, max 5MB) |
| `POST \| GET` | `/api/plans-routines/diet/:memberId` | Write: `ADMIN`, `TRAINER`, `STAFF` \| Read: + `MEMBER` (self) | `{ title?, notes?, mealsData }` |
| `POST \| GET` | `/api/plans-routines/workout/:memberId` | Write: `ADMIN`, `TRAINER`, `STAFF` \| Read: + `MEMBER` (self) | `{ title?, notes?, exercisesData }` |
| `GET \| POST` | `/api/ai/status` \| `/chat` \| `/voice` | `chat`: staff/admin (`aiLimiter`); `status`/`voice`: public | OpenRouter studio assistant (`chat` supports member & plan tool calling) |
| `POST` | `/api/contact` | Public (`contactLimiter`) | `{ name, phone, email?, goal, message? }` (`201`) |

---

### G. Audit Logs, Metrics, Client Telemetry & Health

| Method | Path | Auth / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public (Exempt) | Fast liveness check; pass `?deep=1` for DB ping & pool status |
| `GET` | `/api/health` | Public (Exempt) | Production readiness check (`SELECT 1` by default, `?shallow=1` to skip); `503` on DB failure or shutdown drain |
| `GET` | `/api/metrics` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `ADMIN` | Returns **Audit Logs** (`auditLogs`), APM percentiles (`p50Ms`/`p95Ms`/`p99Ms`), cache stats & Redis mode, Prisma pool config, Web Vitals `p75`, recent errors, and active alerts |
| `POST` | `/api/telemetry/client` | Public (`telemetryLimiter`) | Async beacon ingesting `type: "web-vital" \| "error"` (`202 Accepted`) |

#### `GET /api/metrics` Query Parameters
- `action` *(optional string)*: Filter recent audit logs by action (`ADMIN_LOGIN`, `LOGIN_FAILED`, `MEMBER_CREATED`, `MEMBER_UPDATED`, `MEMBER_DELETED`, `ROLE_CHANGED`, `BRANCH_CREATED`, `BRANCH_UPDATED`).
- `limit` *(optional integer, default `25`)*: Max audit log entries returned (scoped by `branchId` / global `SUPER_ADMIN` view).

- **cURL Examples:**
  ```bash
  # Inspect readiness & pool status
  curl http://localhost:5000/api/health

  # Inspect APM, Redis status & branch-scoped Audit Logs
  curl -H "Authorization: Bearer <admin_token>" \
    "http://localhost:5000/api/metrics?action=MEMBER_CREATED&limit=20"

  # Emit client Web Vital telemetry beacon
  curl -X POST http://localhost:5000/api/telemetry/client \
    -H "Content-Type: application/json" \
    -d '{"type":"web-vital","name":"LCP","value":842.5,"rating":"good","route":"/admin/members"}'
  ```
