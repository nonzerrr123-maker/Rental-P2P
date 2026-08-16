# Rental P2P — System Architecture

> MVP product scope is defined in [`mvp-scope.md`](./mvp-scope.md). The canonical persisted data model is [`database-schema.sql`](./database-schema.sql).

## Product rule

A user may browse public rental listings without verification, but may not create a rental listing, submit a rental request, or post a transactional community offer until identity verification is complete.

PostgreSQL is the persistence source of truth. Browser-only state and prototype mock files are temporary migration aids and must not override server/database state.

## Identity verification

Canonical states:

`UNVERIFIED -> PENDING -> VERIFIED`

Alternative state:

`REJECTED`

Verification is provider-agnostic. Production implementation should use an appropriate identity/KYC provider for document verification and liveness/face matching rather than storing raw national-ID or biometric images in the application database.

The main database stores provider references, verification state, timestamps, reviewer references, rejection information, and minimum audit metadata.

## User roles

Canonical roles:

- `USER`
- `ADMIN`
- `SUPERADMIN`

A normal user can act as both borrower and lender; borrower/lender are transaction roles, not separate account types.

## Rental pricing

Canonical pricing modes:

- `HOUR`
- `DAY`

A listing may offer hourly pricing, daily pricing, or both. Hourly listings can define a minimum number of hours. Pricing copied into `rental_requests` is a transaction snapshot and must be calculated/validated by the server.

Urgent rental uses the same rental workflow with `is_urgent`, a configurable reservation-fee rate on the listing, a snapshotted urgent fee on the request, and an optional reservation expiry.

## Rental lifecycle

Canonical rental states:

`REQUESTED -> ACCEPTED -> WAITING_PAYMENT -> PAID -> WAITING_PICKUP -> RENTING -> RETURNING -> RETURNED -> COMPLETED`

Alternative/terminal states:

- `REJECTED`
- `CANCELLED`
- `EXPIRED`
- `DISPUTED`

Application code must validate legal transitions; clients must not be able to move a rental to an arbitrary state.

For active/committed states, PostgreSQL also prevents overlapping time ranges for the same rental item through an exclusion constraint. Manual owner availability blocks are stored separately and must also be checked by the server when accepting/creating a committed booking.

## Location and privacy

Rental listings and community requests may store:

- province
- district
- subdistrict
- latitude
- longitude
- an optional location label

These fields support nearby/radius discovery. Public discovery should use an appropriate approximate/search location; exact private handover details should not be exposed publicly by default.

## Payments and deposits

Payments are persisted separately from rental status and contain provider references, idempotency keys, payment type, amount, currency, and provider-confirmed status.

Incoming payment-provider events are recorded in `payment_events` so webhook processing can be idempotent and auditable.

Deposits have their own lifecycle and may be held, released, partially released, forfeited, or refunded according to the rental/dispute result.

Frontend success screens are not authoritative payment confirmation.

## Chat

A rental conversation belongs to one rental request. Authorized users are stored as conversation participants.

Messages are persisted, and per-user read state is stored in `message_reads`. Realtime transport can be added above this persistence model without changing the core ownership model.

## Pickup and return

Pickup and return confirmations are stored in `rental_handover_events`. Each participant can confirm an event and optionally attach condition notes/evidence storage references.

## Reviews and disputes

Reviews belong to a rental request and allow one review per reviewer per rental. Server logic must only permit eligible participants to review after the appropriate rental state.

Disputes belong to a rental request, retain resolution/audit metadata, and can have evidence references. Payment/deposit handling may remain held while a dispute is active.

## Community requests

`community_requests` supports users posting an item they want to borrow, including location, required time window, optional target price, and urgent flag.

Potential lenders respond through `community_offers`. An accepted offer should be converted by server logic into the normal rental-request workflow rather than creating a second rental lifecycle.

## Admin audit

Sensitive administrative actions should create an `admin_audit_logs` record containing actor, action, target, timestamps, and minimum contextual details.

## Canonical database entities

TASK 2 defines 23 application tables:

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

## Access rules

- Guests/unverified users may browse public listings.
- Verified active users may create listings and submit rental/community transactions.
- A user may modify only resources they own or are authorized to act on.
- Only rental conversation participants may read/send messages in that conversation.
- Only eligible rental participants may review one another.
- Admin-only actions require server-side role authorization and should be audited.
- Server/database state is authoritative for availability, pricing snapshots, rental state, payment status, and permissions.
