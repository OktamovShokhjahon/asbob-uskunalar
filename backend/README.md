# Asbob-uskunalar ijarasi — API

REST API for the tool rental site. Spec: [`../backend-tz.md`](../backend-tz.md).

## Requirements

- Node.js 20+ and npm

## Run locally

```bash
cd backend
npm install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
npm run db:migrate          # applies prisma/migrations to prisma/dev.db
npm run db:seed             # superadmin + the 6 task tools (safe to re-run)
npm run dev                 # http://localhost:4000/api/v1
```

Superadmin: username `admin`. Password = `SUPERADMIN_PASSWORD` from `.env`; if empty (development only), the same demo password the frontend mock uses. Seeding never overwrites an existing superadmin password unless `SUPERADMIN_PASSWORD` is set.

## Authentication

`POST /auth/register` and `POST /auth/login` return `{ user, token, expiresAt }`. Send the token on later requests:

```
Authorization: Bearer <token>
```

Sessions last `SESSION_TTL_DAYS` (default 30). Only a SHA-256 of the token is stored; passwords are hashed with scrypt.

## Endpoints (`/api/v1`)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/register` | anyone | Create account (role `user`) and log in |
| POST | `/auth/login` | anyone | Log in |
| POST | `/auth/logout` | user | End current session |
| GET | `/auth/me` | user | Current user |
| GET | `/listings` (`?q=`) | anyone | Catalog: approved eʼlonlar, A01–A06 first, then newest |
| GET | `/listings/:id` | anyone | One approved eʼlon |
| POST | `/listings` | user | Post an eʼlon → `pending` (superadmin's own → `approved`) |
| GET | `/me/listings` | user | My eʼlonlar, every status (kabinet) |
| GET | `/admin/stats` | superadmin | Counts by status + number of users |
| GET | `/admin/listings?status=` | superadmin | Review queue (`pending` default / `approved` / `rejected`) |
| POST | `/admin/listings/:id/review` | superadmin | `{ decision: "approve" \| "reject", reason? }` |
| GET | `/admin/users` | superadmin | Accounts with eʼlon counts |
| POST | `/admin/reset-demo` | superadmin | Wipe users, user eʼlonlar, rentals, sessions; re-seed |
| GET | `/tools` (`?q=`), `/tools/:id` | anyone | Original task API: approved eʼlonlar in tool shape |
| POST | `/quotes` | anyone | `{ toolId, days }` → total, nothing saved |
| POST | `/rental-requests` | anyone | `{ toolId, days, customerName }` → saved request (201) |
| GET | `/rental-requests/:id` | anyone | Saved request for the confirmation page |
| GET | `/rental-requests` | superadmin | All rental requests, paged |
| GET | `/health` | anyone | API + DB status |

Only approved eʼlonlar can be quoted or rented. API contract: `GET /api/docs` returns [`openapi.yaml`](openapi.yaml).

## Tests

```bash
npm test
```

Each run starts from a fresh `prisma/test.db` (dev.db is never touched). 65 tests: acceptance checks B1–B13 from the spec plus accounts, eʼlonlar, review flow, permissions and demo reset.

## Notes

- Totals are computed only on the server. Server-owned fields sent by a client (e.g. `total`, `status`) are ignored; any other unknown field is rejected with `UNKNOWN_FIELD` (so `role` can't be self-assigned at registration).
- `customerName`, passwords and bearer tokens are never written to logs.
- Rate limits: 20 POST/min/IP generally, 10/min for login and register.
- The `Listing` model is stored in the original `Tool` table (`@@map("Tool")`, `title` → column `name`) so the upgrade migration kept existing data.
- For PostgreSQL: set `provider = "postgresql"` in `prisma/schema.prisma`, point `DATABASE_URL` at the database, regenerate migrations for that provider and run `npm run db:deploy`.
