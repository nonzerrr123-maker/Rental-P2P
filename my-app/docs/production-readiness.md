# Borow Borow production readiness

This runbook is the release gate for the Borow Borow MVP. It focuses on the two failure modes that are easiest to miss during a Vercel deployment: application code being newer than the PostgreSQL schema, and production secrets/configuration still using development defaults.

## 1. Database migrations

The canonical empty-database baseline remains `docs/database-schema.sql`. Incremental production changes live in `docs/migrations/*.sql` and are applied in filename order.

Commands:

```bash
# Brand-new, empty PostgreSQL database only
npm run db:bootstrap

# Existing database during every release
npm run db:migrate

# Read-only migration status
npm run db:status
```

`db:migrate` creates `schema_migrations`, records a SHA-256 checksum for each migration, and takes a PostgreSQL advisory lock so two deployments cannot migrate the same database concurrently. Re-running the command is safe. If an already-applied file changes, the runner fails instead of silently accepting migration drift.

Do not edit an applied migration. Add a new timestamped SQL migration instead.

## 2. Production environment preflight

Run this with the same environment variables used by the production deployment:

```bash
npm run preflight:production
```

The strict preflight fails when critical production settings are missing or unsafe. It checks the database connection shape, superadmin bootstrap credentials, public HTTPS base URL, Resend email configuration, email-verification enforcement, KYC mode, real-payment mode, Omise server credential presence, the payout safety switch, and S3-compatible object storage.

The preflight never prints secret values.

For the Chonburi MVP, `KYC_PROVIDER=manual` is allowed, but it produces a warning because approval capacity becomes an operational dependency. `OMISE_ENABLE_LIVE_PAYOUTS` must remain `false` until lender payout operations and recipient verification are ready.

## 3. Safe release order

1. Take a database backup or confirm point-in-time recovery is available.
2. Run `npm run db:status` against production.
3. Run `npm run db:migrate` against production.
4. Run `npm run preflight:production` with the production environment.
5. Deploy the exact commit that passed the production-readiness GitHub Action.
6. Confirm `/api/health/db` returns success.
7. Execute one controlled rental journey with test users: register and verify email, complete KYC approval, create a listing, book, pay through the configured Omise test/live mode, confirm pickup and return, verify deposit resolution, and submit reviews.
8. Check admin settlement and dispute screens before inviting external pilot users.

## 4. Rollback rules

Application rollback and database rollback are different operations. If a deploy must be reverted, first redeploy the previous application commit. Do not manually delete rows from `schema_migrations` and do not reverse SQL blindly.

When a database change needs to be undone, create a forward corrective migration. This preserves the migration history and makes every environment converge on the same schema.

## 5. Production launch blockers

Do not open the MVP to public users while any of these are true:

- `npm run db:status` reports pending migrations.
- `npm run preflight:production` fails.
- `EMAIL_REQUIRE_VERIFICATION` is false.
- `EMAIL_FROM` still uses `onboarding@resend.dev`.
- `PAYMENT_PROVIDER` is still `sandbox` when real payments are expected.
- `SANDBOX_PAYMENT_ENABLED` is true.
- Object storage credentials are missing.
- `OMISE_ENABLE_LIVE_PAYOUTS` is true without an approved lender-payout process.
- The end-to-end controlled rental journey has not completed successfully on the release candidate.
