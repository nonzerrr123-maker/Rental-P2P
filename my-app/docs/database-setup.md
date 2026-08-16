# PostgreSQL Development Setup

This document describes the TASK 2 database setup for the Rental-P2P / Borow Borow MVP.

## Requirements

- PostgreSQL 16 or newer.
- Permission to install the trusted `btree_gist` extension in the development database.
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
```

Never commit `.env.local` or production credentials.

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

## 5. Run the smoke test

On a disposable development database after applying the schema:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/database-smoke-test.sql
```

The smoke test runs inside a transaction and finishes with `ROLLBACK`, so test rows are not retained. It verifies representative inserts/updates/deletes, foreign keys, chat/payment/community relationships, and the active-rental overlap constraint.

## 6. Resetting a disposable development database

For a throwaway local database, the safest reset is to drop and recreate the entire database, then re-run the schema. Do not run destructive reset commands against shared, staging, or production databases.

## TASK 2 completion gate

Before TASK 2 is merged into `main`, verify all of the following against a real PostgreSQL instance:

- `database-schema.sql` applies from an empty database with `ON_ERROR_STOP=1`.
- All 23 tables are present.
- Canonical enums are present.
- Foreign keys and check constraints are active.
- The smoke test completes successfully and rolls back.
- An overlapping active rental for the same item is rejected by PostgreSQL.
- `.env.local` remains untracked and no real credentials are committed.

TASK 3 will add the Next.js database adapter and application-level health check; TASK 2 intentionally does not add a runtime database driver yet.
