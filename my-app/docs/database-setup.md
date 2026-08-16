# PostgreSQL Development Setup

This document describes the PostgreSQL foundation and Next.js integration for the Rental-P2P / Borow Borow MVP.

## Requirements

- PostgreSQL 16 or newer.
- Permission to install the trusted `btree_gist` extension in the development database.
- Node.js 20.9 or newer for Next.js 16.
- A local `.env.local` file or deployment secret containing `DATABASE_URL`.

The canonical schema is `docs/database-schema.sql`.

## 1. Create a development database

Example with the default local PostgreSQL port:

```bash
createdb p2p_rental
```

If PostgreSQL runs on a non-default port, pass the port to the PostgreSQL CLI or put it in `DATABASE_URL`.

## 2. Configure the application environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Then set a real development connection string in `.env.local`:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/p2p_rental
DATABASE_POOL_MAX=10
```

`DATABASE_POOL_MAX` is optional and must be an integer from 1 to 50. Never commit `.env.local` or production credentials.

## 3. Apply the schema

From `my-app/`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/database-schema.sql
```

`ON_ERROR_STOP=1` is important: setup must fail immediately if any statement cannot be applied.

The schema creates the required `btree_gist` extension, canonical enums, 23 MVP tables, indexes, overlap-protection constraints, and `updated_at` triggers.

## 4. Verify objects

Useful checks:

```bash
psql "$DATABASE_URL" -c "\dt"
psql "$DATABASE_URL" -c "\dT+"
psql "$DATABASE_URL" -c "\di"
```

Expected application tables:

1. `users`
2. `user_sessions`
3. `identity_verifications`
4. `rental_items`
5. `rental_images`
6. `item_availability_blocks`
7. `rental_requests`
8. `rental_contracts`
9. `rental_handover_events`
10. `payments`
11. `payment_events`
12. `deposits`
13. `conversations`
14. `conversation_participants`
15. `messages`
16. `message_reads`
17. `reviews`
18. `disputes`
19. `dispute_evidence`
20. `notifications`
21. `community_requests`
22. `community_offers`
23. `admin_audit_logs`

## 5. Run the database smoke test

On a disposable development database after applying the schema:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/database-smoke-test.sql
```

The smoke test runs inside a transaction and finishes with `ROLLBACK`, so test rows are not retained. It verifies representative inserts/updates/deletes, foreign keys, chat/payment/community relationships, and the active-rental overlap constraint.

## 6. Next.js database adapter

Runtime database access is centralized in `lib/db.ts` and uses a reusable `pg.Pool`.

Available helpers:

- `getDbPool()` for advanced pool access.
- `query()` for single parameterized queries.
- `withTransaction()` for multi-statement transactions with automatic commit/rollback and client release.

Application code should import these helpers from server-side code only. Browser/client components must call server APIs rather than importing the PostgreSQL adapter directly.

## 7. Database health check

Start the application:

```bash
npm run dev
```

Then request:

```text
GET /api/health/db
```

A healthy response returns HTTP `200` with `status: "ok"` and the connected database name. A database connection failure returns HTTP `503` with a generic error response and does not expose credentials.

The route explicitly uses the Next.js Node.js runtime because `pg` requires Node.js networking APIs.

## 8. Resetting a disposable development database

For a throwaway local database, the safest reset is to drop and recreate the entire database, then re-run the schema. Do not run destructive reset commands against shared, staging, or production databases.

## Automated validation

The repository contains GitHub Actions checks that validate the database schema and the application integration against PostgreSQL 16.

The application integration check performs:

1. `npm ci` from the committed lockfile.
2. Schema creation on a fresh PostgreSQL 16 instance.
3. ESLint on the database integration code.
4. A full Next.js production build/type-check.
5. A production Next.js server startup.
6. A real request to `/api/health/db` and verification that it connects to `p2p_rental`.

The repository still contains prototype/mock feature data. Those mocks are removed feature-by-feature only after the corresponding real API/database implementation is verified; PostgreSQL is the target source of truth for completed MVP flows.
