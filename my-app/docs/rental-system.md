# Rental P2P — System Architecture

## Product rule
A user may browse publicly, but may not create a rental listing or submit a rental request until identity verification is complete.

## Identity verification

States: `UNVERIFIED -> PENDING -> VERIFIED` or `REJECTED`.

Verification is intentionally provider-agnostic. Production implementation should use a compliant identity/KYC provider for ID document verification and liveness/face matching rather than storing raw identity documents in the application database.

Store only provider reference, status, timestamps, and audit metadata in the main database. Encrypt any unavoidable sensitive data, restrict access, define retention/deletion rules, and obtain appropriate consent/privacy notices before launch.

## Rental lifecycle

`REQUESTED -> ACCEPTED -> PAID -> PICKUP -> RENTING -> RETURNING -> RETURNED -> COMPLETED`

Alternative terminal states: `REJECTED`, `CANCELLED`, `DISPUTED`.

## Core entities

- users
- identity_verifications
- rental_items
- rental_images
- availability
- rental_requests
- rental_contracts
- payments
- deposits
- conversations
- messages
- reviews
- disputes
- notifications

## Access rules

- Unverified users: browse and read public listings.
- Verified users: create listings, request rentals, message rental counterparties, and manage active rentals.
- A conversation belongs to a rental request; users outside the request cannot access it.
- Only participants of a rental can review one another after completion.
- Admin-only actions must be protected by server-side authorization.
