# Backend Technical Specification (TZ) — "Asbob-uskunalar ijarasi"

> Source: `shartlar.jpg` (competition task "Eng yaxshi veb-sayt | Viloyat bosqichi", page 5/11).
> Companion to [`tz.md`](tz.md) (frontend / UI spec).
> This document defines the **backend API** that replaces the frontend's hard-coded seed data and stores rental requests.

---

## 1. Goal

Provide a small REST API that:

1. Serves the catalog of 6 tools (ID, name, short description, daily price).
2. Calculates the rental total on the server: **Jami = kunlar soni × kunlik narx**.
3. Accepts and validates a **rental request** (tool, number of days, name), saves it, and returns the data the confirmation screen needs: **tool name, days, total, name**.
4. Rejects invalid requests (days 0, 8, fractional, missing; empty name) with clear error messages — an invalid request is **never saved and never confirmed**.

The backend is the **single source of truth** for prices and totals. The frontend may show a live preview, but the confirmed total always comes from the server.

---

## 2. Scope

### 2.1 In scope
- Read-only tool catalog API.
- Price quote endpoint (calculation without saving).
- Create a rental request + read it back by ID (for the confirmation page).
- Input validation, unified error format, Uzbek error messages.
- Database with migrations and a seed script containing the 6 tools.
- Automated tests covering the acceptance checks from the task.

### 2.2 Out of scope ("Vazifa chegarasi")
Do **not** implement:
- Deposit (garov), payment (toʻlov), contract (shartnoma), delivery (yetkazish)
- Availability calendar / stock / booking conflicts (mavjudlik kalendari)
- Chat with the owner (egasi bilan chat)
- Sending SMS, email, Telegram or any other message
- User accounts, login, admin panel (an optional read-only admin list is allowed — see §6.6)

> The task states this is a test project: no real purchase, booking or messaging happens. Saving a request in the database is only a record of the demo submission.

> General requirements are on page 1 of the competition document (not in `shartlar.jpg`). Apply them once available.

---

## 3. Tech stack

| Item | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 LTS+ | Same language as the Next.js frontend |
| Language | TypeScript (strict) | Shared types with frontend |
| Framework | Express 5 (or Fastify 5) | Small, well-known, enough for 5 endpoints |
| Validation | Zod | Same rules can be reused in the frontend |
| ORM | Prisma | Migrations + seed out of the box |
| Database | SQLite for local dev, PostgreSQL for deployment | Zero-setup locally, real DB in production |
| Tests | Vitest + Supertest | Fast API tests |
| Logging | pino | Structured logs |
| Docs | OpenAPI 3 (`openapi.yaml`) served at `/api/docs` | Contract for the frontend |

Project folder: `backend/` (sibling of `frontend/`).

---

## 4. Data model

### 4.1 `Tool`

| Field | Type | Constraints | Example |
|---|---|---|---|
| `id` | string | PK, pattern `^A\d{2}$` | `"A01"` |
| `name` | string | required, ≤ 60 chars | `"Drel"` |
| `description` | string | required, ≤ 120 chars | `"Teshish ishlari uchun"` |
| `pricePerDay` | integer | > 0, in soʻm (no tiyin, no floats) | `30000` |
| `createdAt` | datetime | default now | |
| `updatedAt` | datetime | auto | |

### 4.2 `RentalRequest`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | string | PK, cuid/uuid | returned to client |
| `toolId` | string | FK → `Tool.id` | |
| `toolName` | string | snapshot | name at the time of the request |
| `days` | integer | 1 ≤ days ≤ 7 | |
| `pricePerDay` | integer | snapshot | price at the time of the request |
| `total` | integer | = `days × pricePerDay` | computed **on the server** |
| `customerName` | string | trimmed, 1–50 chars | |
| `status` | enum | `CONFIRMED` (only value for now) | room for future states |
| `createdAt` | datetime | default now | |

Snapshots (`toolName`, `pricePerDay`) ensure an old request still shows the correct total even if prices change later.

### 4.3 Prisma schema (reference)

```prisma
model Tool {
  id          String          @id
  name        String
  description String
  pricePerDay Int
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  requests    RentalRequest[]
}

enum RentalStatus {
  CONFIRMED
}

model RentalRequest {
  id           String       @id @default(cuid())
  tool         Tool         @relation(fields: [toolId], references: [id])
  toolId       String
  toolName     String
  days         Int
  pricePerDay  Int
  total        Int
  customerName String
  status       RentalStatus @default(CONFIRMED)
  createdAt    DateTime     @default(now())

  @@index([toolId])
  @@index([createdAt])
}
```

> SQLite has no native enums in Prisma; for local SQLite use `status String @default("CONFIRMED")`.

### 4.4 Seed data (`prisma/seed.ts`)

Idempotent (`upsert` by `id`):

| ID | Name | Description | Price / day |
|---|---|---|---|
| A01 | Drel | Teshish ishlari uchun | 30 000 |
| A02 | Narvon | Uy ichidagi ishlar uchun | 20 000 |
| A03 | Proyektor | Taqdimot uchun | 100 000 |
| A04 | Mikrofon | Kichik tadbir uchun | 40 000 |
| A05 | Tikuv mashinasi | Oddiy tikish ishlari uchun | 60 000 |
| A06 | Gilam tozalagich | Gilam tozalash uchun | 80 000 |

---

## 5. Business rules

| # | Rule |
|---|---|
| BR-1 | `days` must be a JSON **integer** from 1 to 7 inclusive. `0`, `8`, `-1`, `2.5`, `"3"`, `null`, missing → error. |
| BR-2 | `customerName` is required. It is trimmed; empty or whitespace-only → error. Max 50 characters after trim. Control characters are rejected. |
| BR-3 | `toolId` must exist in the database. Unknown ID → `404 TOOL_NOT_FOUND`. ID matching is case-insensitive (`a01` → `A01`). |
| BR-4 | `total = days × tool.pricePerDay`, integer arithmetic, computed on the server. Any `total`/`price` sent by the client is **ignored**. |
| BR-5 | An invalid request is not saved and returns no confirmation data. |
| BR-6 | Unknown extra fields in the body are rejected (`strict` schema) to avoid silent mistakes. |

### Error messages (Uzbek, same as frontend)

| Code | Field | Message |
|---|---|---|
| `DAYS_REQUIRED` | days | Kunlar sonini kiriting |
| `DAYS_NOT_INTEGER` | days | Kunlar soni butun son boʻlishi kerak |
| `DAYS_OUT_OF_RANGE` | days | Kunlar soni 1 dan 7 gacha boʻlishi kerak |
| `NAME_REQUIRED` | customerName | Ismni kiriting |
| `NAME_TOO_LONG` | customerName | Ism 50 belgidan oshmasin |
| `TOOL_REQUIRED` | toolId | Asbobni tanlang |
| `TOOL_NOT_FOUND` | toolId | Bunday asbob topilmadi |
| `REQUEST_NOT_FOUND` | — | Soʻrov topilmadi |
| `INVALID_JSON` | — | Soʻrov maʼlumotlari notoʻgʻri formatda |
| `RATE_LIMITED` | — | Juda koʻp soʻrov. Birozdan soʻng qayta urinib koʻring |
| `INTERNAL_ERROR` | — | Serverda xatolik yuz berdi |

---

## 6. API

Base URL: `/api/v1`. All requests and responses are `application/json; charset=utf-8`.

### 6.1 Response envelope

Success:
```json
{ "data": { ... } }
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Maʼlumotlar notoʻgʻri",
    "fields": {
      "days": { "code": "DAYS_OUT_OF_RANGE", "message": "Kunlar soni 1 dan 7 gacha boʻlishi kerak" },
      "customerName": { "code": "NAME_REQUIRED", "message": "Ismni kiriting" }
    }
  }
}
```
All field errors are returned at once (not only the first), so the form can show every message.

### 6.2 `GET /api/v1/tools`

Returns all tools ordered by `id`.

`200 OK`
```json
{
  "data": [
    { "id": "A01", "name": "Drel", "description": "Teshish ishlari uchun", "pricePerDay": 30000 },
    { "id": "A02", "name": "Narvon", "description": "Uy ichidagi ishlar uchun", "pricePerDay": 20000 }
  ]
}
```
Optional query: `?q=dre` — case-insensitive search by name (for the optional catalog filter).

### 6.3 `GET /api/v1/tools/:id`

`200 OK` → `{ "data": { "id": "A03", "name": "Proyektor", "description": "Taqdimot uchun", "pricePerDay": 100000 } }`
`404` → `TOOL_NOT_FOUND`

### 6.4 `POST /api/v1/quotes`

Calculates the total without saving anything (used for the live "Jami" preview if the frontend wants server-confirmed numbers).

Request:
```json
{ "toolId": "A01", "days": 3 }
```
`200 OK`
```json
{ "data": { "toolId": "A01", "toolName": "Drel", "days": 3, "pricePerDay": 30000, "total": 90000 } }
```
`400` → validation errors for `days` / `toolId`; `404` → `TOOL_NOT_FOUND`.

### 6.5 `POST /api/v1/rental-requests`

Creates a rental request ("Ijara soʻrovi" button).

Request:
```json
{ "toolId": "A03", "days": 2, "customerName": "Ali" }
```

`201 Created` + header `Location: /api/v1/rental-requests/{id}`
```json
{
  "data": {
    "id": "clx9k2…",
    "toolId": "A03",
    "toolName": "Proyektor",
    "days": 2,
    "pricePerDay": 100000,
    "total": 200000,
    "customerName": "Ali",
    "status": "CONFIRMED",
    "createdAt": "2026-11-18T09:30:00.000Z"
  }
}
```

Errors: `400 VALIDATION_ERROR`, `404 TOOL_NOT_FOUND`, `415` wrong content type, `429 RATE_LIMITED`.

Optional: support an `Idempotency-Key` header so a double-click on the button does not create two records (same key within 10 minutes → return the first result).

### 6.6 `GET /api/v1/rental-requests/:id`

Returns one saved request (same shape as §6.5) for the confirmation page, so a page reload still shows the confirmation.
`404` → `REQUEST_NOT_FOUND`.

IDs are unguessable (cuid/uuid), so the confirmation link is not enumerable.

*(Optional, protected)* `GET /api/v1/rental-requests?page=1&limit=20` — list for a demo admin view, guarded by a static `ADMIN_TOKEN` header. Not required by the task.

### 6.7 `GET /api/v1/health`

`200 OK` → `{ "data": { "status": "ok", "db": "ok" } }` — used by hosting / Docker health checks.

---

## 7. Non-functional requirements

### 7.1 Security
- CORS: allow only the frontend origin from env `CORS_ORIGIN` (e.g. `http://localhost:3000`).
- `helmet` default headers.
- Body size limit: 10 KB.
- Rate limit on `POST` endpoints: 20 requests / minute / IP.
- All DB access via Prisma (parameterized) — no raw SQL string building.
- The customer name is stored as plain text and returned as JSON; the frontend renders it as text (React escapes it). The backend never returns HTML.
- Do not log `customerName` at `info` level (it is personal data); log request ID, tool ID, days, total.

### 7.2 Performance
- `GET /tools` p95 < 100 ms locally. Data is tiny; an in-memory cache of the tool list (TTL 60 s) is allowed.

### 7.3 Reliability
- Graceful shutdown (close DB connection on `SIGTERM`).
- Central error handler: unknown errors → `500 INTERNAL_ERROR` without stack traces in the response (stack only in logs).

### 7.4 Configuration (`.env`)

| Variable | Example | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `DATABASE_URL` | `file:./dev.db` / `postgresql://…` | DB connection |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin |
| `LOG_LEVEL` | `info` | pino level |
| `ADMIN_TOKEN` | *(random)* | Only if optional admin list is enabled |

Provide `.env.example`; never commit `.env`.

---

## 8. Project structure

```
backend/
  prisma/
    schema.prisma
    seed.ts
    migrations/
  src/
    app.ts                 # express app: middleware, routes, error handler
    server.ts              # starts HTTP server, graceful shutdown
    config.ts              # reads + validates env with zod
    db.ts                  # PrismaClient singleton
    lib/
      errors.ts            # AppError, error codes + Uzbek messages
      money.ts             # calcTotal(days, pricePerDay)
    modules/
      tools/
        tools.routes.ts
        tools.service.ts
      quotes/
        quotes.routes.ts
        quotes.schema.ts
      rentals/
        rentals.routes.ts
        rentals.schema.ts   # zod: toolId, days (int 1..7), customerName (trim, 1..50)
        rentals.service.ts
    middleware/
      validate.ts
      rateLimit.ts
      errorHandler.ts
  tests/
    tools.test.ts
    quotes.test.ts
    rentals.test.ts
  openapi.yaml
  .env.example
  package.json
  tsconfig.json
```

### npm scripts

| Script | Action |
|---|---|
| `dev` | `tsx watch src/server.ts` |
| `build` | `tsc` |
| `start` | `node dist/server.js` |
| `db:migrate` | `prisma migrate dev` |
| `db:seed` | `prisma db seed` |
| `test` | `vitest run` |

---

## 9. Acceptance tests (from "Tekshirish")

Must be automated in `tests/` and pass with `npm test`:

| # | Request | Expected |
|---|---|---|
| B1 | `POST /quotes` `{toolId:"A01", days:3}` | `200`, `total: 90000` |
| B2 | `POST /rental-requests` `{toolId:"A03", days:2, customerName:"Ali"}` | `201`, `toolName:"Proyektor"`, `total:200000`, `days:2`, `customerName:"Ali"` |
| B3 | same as B2, then `GET /rental-requests/{id}` | `200`, identical data |
| B4 | days = `0` | `400`, `fields.days.code = DAYS_OUT_OF_RANGE`, nothing saved |
| B5 | days = `8` | `400`, `DAYS_OUT_OF_RANGE`, nothing saved |
| B6 | days = `2.5` | `400`, `DAYS_NOT_INTEGER`, nothing saved |
| B7 | days missing | `400`, `DAYS_REQUIRED` |
| B8 | customerName = `""` or `"   "` | `400`, `NAME_REQUIRED`, nothing saved |
| B9 | days = `0` **and** empty name | `400` with **both** field errors |
| B10 | toolId = `"A99"` | `404 TOOL_NOT_FOUND` |
| B11 | body contains `"total": 1` | ignored; server total is correct |
| B12 | `GET /tools` | exactly 6 tools with the seeded data |
| B13 | Every tool × 1 and 7 days via `/quotes` | totals match the table below |

| ID | 1 day | 7 days |
|---|---|---|
| A01 | 30 000 | 210 000 |
| A02 | 20 000 | 140 000 |
| A03 | 100 000 | 700 000 |
| A04 | 40 000 | 280 000 |
| A05 | 60 000 | 420 000 |
| A06 | 80 000 | 560 000 |

"Nothing saved" is verified by counting `RentalRequest` rows before and after.

---

## 10. Frontend integration (changes to `frontend/`)

- Add `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:4000/api/v1`).
- Catalog page and form page load tools from `GET /tools` and `GET /tools/:id` (server components, `revalidate: 60`) instead of `src/data/tools.ts`.
- "Ijara soʻrovi" button → `POST /rental-requests`; on `201`, navigate to `/ijara/{toolId}/tasdiq/{requestId}` which loads `GET /rental-requests/{id}`.
- On `400`, map `error.fields.*.message` to the form's field errors.
- Keep client-side validation for instant feedback; the server remains authoritative.
- Disable the submit button while the request is in flight (prevents double submit).

---

## 11. Deployment (optional)

- `Dockerfile` (multi-stage: build → slim runtime) and `docker-compose.yml` with `postgres:16` + `backend` + `frontend`.
- On container start: `prisma migrate deploy` then `node dist/server.js`; seed runs once via `npm run db:seed`.

---

## 12. Extension: accounts and eʼlonlar (v2)

Added to match the new frontend features (login, "Eʼlon berish", kabinet, superadmin panel). These go beyond `shartlar.jpg`; the original rental flow and checks B1–B13 are unchanged.

- **Accounts:** register / login / logout / me. Roles `user` and `superadmin`. Bearer-token sessions (token hashed with SHA-256, passwords with scrypt). Superadmin is created only by the seed.
- **Eʼlonlar (listings):** the 6 task tools become approved listings A01–A06 owned by the superadmin. Logged-in users post new ones (E001, E002, …) which wait as `pending` until a superadmin approves or rejects them (optional reason shown to the owner). Only approved listings are public, quotable and rentable.
- **Superadmin panel:** stats, review queue by status, users list with eʼlon counts, demo data reset (off in production by default), rental request list.
- **Validation:** same rules and Uzbek messages as the frontend forms (name 2–50, username `^[a-z0-9_]{3,20}$` stored lowercase, password ≥ 6, title 2–40, description 5–80, price 1 000–10 000 000 integer soʻm).

Full endpoint list: [`backend/README.md`](backend/README.md); contract: [`backend/openapi.yaml`](backend/openapi.yaml).

---

## 13. Definition of done

- [ ] `npm run db:migrate && npm run db:seed` creates the DB with exactly 6 tools.
- [ ] `npm run dev` serves all endpoints in §6; `/health` returns `ok`.
- [ ] Totals are computed only on the server; client-sent totals are ignored.
- [ ] Invalid days (0, 8, fraction, missing) or empty name → `400`, nothing saved, no confirmation.
- [ ] Errors use the unified envelope and Uzbek messages from §5.
- [ ] Acceptance tests B1–B13 pass (`npm test`).
- [ ] `openapi.yaml` matches the implemented API.
- [ ] `.env.example` present; CORS, rate limit, helmet, body-size limit enabled.
- [ ] Frontend works end-to-end against the API (catalog → form → confirmation).
