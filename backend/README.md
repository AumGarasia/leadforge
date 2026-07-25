# LeadForge — Backend

A lead management API for a small sales team: public capture form + role-scoped internal API.
Built for Digital Heroes' Full Stack Development qualification task (Role 04, Task A).

## Stack & why

| Choice | Why |
|---|---|
| Express + TypeScript | Small enough surface area to keep the auth/permission logic legible for review, without a heavier framework's abstractions in the way. |
| `node:sqlite` (Node 22 built-in) + hand-written repository layer | Originally spec'd as Postgres + Prisma (see the SRS). Built here against SQLite with a thin, explicit data-access layer instead of an ORM — swapping the `src/lib/db.ts` + `src/lib/repositories.ts` pair for a `pg` Pool is the only change needed to run this against Postgres in production; nothing above that layer touches SQL directly. |
| JWT (access + refresh) | Public form and internal app are logically separate surfaces; stateless auth simplifies deploying frontend and backend independently. |
| Zod | Request validation at the edge, not scattered through handlers. |

## Setup

```bash
cd backend
npm install
cp .env.example .env   # or use the provided .env for local dev
npm run build
npm start               # or `npm run dev` for hot reload
```

Server listens on `PORT` (default 4000). On first boot it seeds one admin user from
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (defaults: `admin@leadforge.dev` / `ChangeMe123!` —
**change these before any real deployment**).

## Demo data

A fresh database has just the one admin user and no leads. To fill it with realistic demo data
(a 4-person team, 12 leads spread across every pipeline stage, notes, and a matching activity
trail) so the app doesn't feel empty on first look:

```bash
npm run seed            # adds demo data; skips if leads already exist
npm run seed -- --reset # wipes users/leads/notes/activity first, then reseeds
```

Prints the demo login for every seeded user (1 admin, 3 members) when it finishes.

## Tests

```bash
npm test
```

14 tests covering: auth (valid/invalid login, missing/malformed tokens), role + ownership
permission enforcement (member blocked from another member's lead and from admin-only routes;
admin allowed), public lead capture + validation, the stage-update → activity-log flow, the
LOST-requires-reason rule, self-claim semantics, and pagination.

## Data model

See `prisma/schema.prisma`-equivalent in `src/lib/db.ts` (SQL DDL) — four tables: `users`,
`leads`, `notes`, `activity_log`. Full rationale for each field is in the project SRS
(`LeadForge_SRS.docx`), section 3.3.

## Authorization

Enforced server-side in `src/middleware/auth.ts` and per-route in `src/routes/leads.ts`
(`canMutate` helper) — **never trust the client**. Rules:

- Admin: full access to all leads and users.
- Member: read access to all leads (pipeline visibility); write access (stage/notes) only to
  leads assigned to them; can self-claim unassigned leads; cannot reassign or manage users.
- Public: can only POST to `/api/public/leads`.

## API contract

Base URL: `http://localhost:4000` (local) — set `VITE_API_URL` in the frontend to match wherever
this is deployed.

All error responses share one shape: `{ "error": { "code": string, "message": string } }`.
Codes used: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `INVALID_CREDENTIALS` (401),
`FORBIDDEN` (403), `NOT_FOUND` (404), `ALREADY_ASSIGNED` (400), `EMAIL_TAKEN` (400).

### Public

| Method & path | Body | Response |
|---|---|---|
| `POST /api/public/leads` | `{ name, email, company?, message?, source? }` | `201 { data: { id } }` — rate-limited 10/min/IP |

### Auth

| Method & path | Body | Response |
|---|---|---|
| `POST /api/auth/login` | `{ email, password }` | `200 { data: { accessToken, refreshToken, user } }` |
| `POST /api/auth/refresh` | `{ refreshToken }` | `200 { data: { accessToken } }` |

### Leads (Bearer token required)

| Method & path | Auth | Body | Response |
|---|---|---|---|
| `GET /api/leads?stage=&assigned_to=&page=&limit=` | Member/Admin | — | `200 { data: [...], pagination: { page, limit, total, total_pages } }` |
| `GET /api/leads/:id` | Member/Admin | — | `200 { data: { ...lead, notes: [...], activity: [...] } }` |
| `PATCH /api/leads/:id/stage` | Member (own)/Admin (any) | `{ stage, lostReason? }` | `200 { data: lead }` — `lostReason` required when `stage: "LOST"` |
| `POST /api/leads/:id/notes` | Member (own)/Admin (any) | `{ body }` | `201 { data: note }` |
| `PATCH /api/leads/:id/assign` | Admin only | `{ userId }` | `200 { data: lead }` |
| `POST /api/leads/:id/claim` | Member/Admin | — | `200 { data: lead }` — fails `400 ALREADY_ASSIGNED` if taken |

### Users (Admin only)

| Method & path | Body | Response |
|---|---|---|
| `GET /api/users` | — | `200 { data: [...] }` (password hashes never returned) |
| `POST /api/users` | `{ name, email, password, role? }` | `201 { data: user }` |
| `PATCH /api/users/:id/deactivate` | — | `200 { data: { id, isActive: false } }` |

## Database driver

`src/lib/db.ts` auto-selects the driver: set `DATABASE_URL` (a Postgres connection string) and
it uses Postgres via `pg`; leave it unset and it falls back to `node:sqlite` using
`DATABASE_PATH`. Both go through the same `db.all/get/run` interface with `?` placeholders, so
nothing in `repositories.ts` or the routes changes between environments — this is genuinely a
zero-code-change swap, not just documented as one.

## Known limitations

- Single-tenant only (one org, many users) — see SRS §2.4 for why.
- Refresh token rotation is not yet revocation-aware (no server-side blocklist) — acceptable for
  this scope, called out as a next step for a real production deployment.
- No email/SMS integration, no multi-tenant support — explicitly out of scope per the SRS.
