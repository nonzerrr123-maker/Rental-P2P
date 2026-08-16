# Rental-P2P / Borow Borow — MVP Scope

Status: **LOCKED FOR MVP IMPLEMENTATION**

This document is the product-scope source of truth for the first production-ready MVP. New features should not be added to the implementation roadmap until the core rental flow below works end-to-end with real persistence, authorization, and production-style integrations.

## 1. Product Goal

Build a peer-to-peer item rental platform where a verified user can act as both a lender and a borrower.

The MVP must support the complete journey:

`Register -> Login -> Identity Verification -> Discover/List Item -> Rental Request -> Accept/Reject -> Payment -> Chat -> Pickup -> Rental -> Return -> Deposit/Settlement -> Review`

The initial pilot is intended for a limited local rollout before broader expansion.

## 2. MVP Product Principles

1. **Rental first.** The production backend and database are optimized for item rental, not general e-commerce.
2. **One user can be both borrower and lender.** No separate borrower/lender account type is required.
3. **Identity verification is required before transactions.** Public visitors may browse, but listing an item or requesting a rental requires a verified account.
4. **Server-side rules are authoritative.** Pricing, permissions, availability, rental state transitions, and payment status must not depend on browser-only state.
5. **PostgreSQL becomes the application source of truth.** Mock data may remain temporarily during migration but must not drive the completed MVP.
6. **Mobile web is a first-class client.** The MVP must be usable on common phone widths without horizontal scrolling or desktop-only interactions.

## 3. In-Scope MVP Features

### 3.1 Accounts and Authentication

- User registration with email and password.
- Secure password hashing.
- Login/logout and persistent server-managed session.
- Roles: `USER`, `ADMIN`, `SUPERADMIN`.
- Current-user/session endpoint.
- Server-side route and API authorization.
- Admin account can also use normal rental features for testing/operations where permissions allow.

### 3.2 Identity Verification / KYC

- Verification states use one canonical vocabulary across frontend, backend, and database:
  - `UNVERIFIED`
  - `PENDING`
  - `VERIFIED`
  - `REJECTED`
- National ID verification through an appropriate external KYC provider.
- Face matching / liveness through an appropriate external provider.
- The main application database must not store raw biometric images or raw identity-document images unless a later security/privacy design explicitly requires it.
- Admin/provider workflow can approve or reject verification and retain only necessary provider/audit references.

### 3.3 Rental Listings

A verified user can create and manage a rental listing with:

- Title.
- Description.
- Category.
- Condition.
- Images.
- Daily price.
- Hourly price.
- Minimum rental hours for hourly rental.
- Deposit amount.
- Location.
- Availability.
- Urgent-rental availability toggle.
- Listing status such as active/paused/unavailable.

### 3.4 Rental Pricing

MVP pricing supports:

- Hourly rental.
- Daily rental.
- Deposit.
- Platform/reservation fees where applicable.

Weekly pricing is not required for the first MVP and may be added later.

All totals shown to the user must be recalculated and validated on the server before a rental/payment is created.

### 3.5 Discovery and Search

Users can discover available rental items by:

- Text search.
- Category.
- Price-related filters where useful.
- Availability.
- Hourly/daily support.
- Urgent availability.
- Province.
- District/subdistrict where available.
- Nearby radius based on latitude/longitude.

Search must eventually query persisted listings rather than hardcoded arrays.

### 3.6 Nearby / Location

MVP supports location-based discovery including:

- Browser location permission.
- Latitude/longitude for distance calculation.
- Nearby radius search.
- Province filter.
- Subdistrict/tambon filter.
- A fallback area when the user does not grant precise location permission.

Exact private addresses should not be publicly exposed unless required for a confirmed handover flow.

### 3.7 Rental Availability and Booking

- Listing availability calendar/periods.
- Server-side overlap checks.
- Prevention of double booking using database transactions/constraints/locking as appropriate.
- Hourly and daily rental windows.
- Rental request creation.
- Owner accept/reject.

The browser may preview availability, but the final booking decision must be validated by the server.

### 3.8 Rental Lifecycle

Use one canonical rental state machine across the application. The exact database enum may be finalized in the schema task, but it must cover at least:

`REQUESTED -> ACCEPTED -> WAITING_PAYMENT -> PAID -> WAITING_PICKUP -> RENTING -> RETURNING -> RETURNED -> COMPLETED`

Terminal/alternate states include:

- `REJECTED`
- `CANCELLED`
- `DISPUTED`

Invalid state transitions must be rejected by the server.

### 3.9 Urgent Rental / ยืมด่วน

Owners can mark eligible listings as available for urgent rental.

MVP urgent flow includes:

- Urgent availability on/off.
- Nearby discovery.
- Hourly pricing support.
- Minimum hours.
- Fast reservation.
- Reservation expiry to prevent abandoned locks.
- Platform-collected reservation fee.
- Reservation fee percentage must be configurable; the current product target is approximately 5%, not a hardcoded business rule.
- Prevent two users from reserving the same item/time window concurrently.

### 3.10 Chat

- A conversation is associated with a rental/request context.
- Only authorized participants may read/send messages.
- Persisted message history.
- Read/unread state.
- Realtime delivery for the production MVP or a provider-backed equivalent.
- Mobile-friendly full-height chat experience.

### 3.11 Payments and Deposit Handling

The MVP includes real payment-provider integration for platform-collected charges.

The payment model must be able to represent:

- Rental payment.
- Deposit.
- Urgent reservation/platform fee.
- Refund.
- Payment failure.
- Provider transaction reference.
- Webhook-confirmed payment status.

Payment status must never be considered successful only because the frontend says it succeeded.

### 3.12 Pickup and Return

- Pickup/handover confirmation.
- Return workflow.
- Timestamps for important handover events.
- Item-condition/evidence hooks where required.
- Deposit release/refund after a successful return or admin decision.

### 3.13 Reviews and Reputation

- Reviews are allowed only for eligible completed rentals.
- Borrower can review lender.
- Lender can review borrower.
- One review per reviewer per rental.
- Rating displayed on user/listing experience where useful.

### 3.14 Disputes

- Rental participant can open a dispute.
- Reason and details are persisted.
- Evidence support may be added to the workflow.
- Admin can review and resolve disputes.
- Payment/deposit handling can be held while a dispute is active where the payment design requires it.

### 3.15 Notifications

Persisted in-app notifications for important events including:

- Verification updates.
- New rental request.
- Accept/reject.
- Payment required/completed/failed.
- Pickup/return reminders.
- New chat activity.
- Dispute updates.

Push notifications are not required to consider the first web MVP complete.

### 3.16 Community Requests / คอมมูหาของ

A verified user can post an item they want to borrow when a suitable listing is not available.

The MVP model should support:

- Requested item/title.
- Category.
- Location.
- Needed date/time.
- Optional target price.
- Urgent flag.
- Request status.
- Offers/responses from potential lenders.
- Conversion of an accepted offer into the normal rental workflow.

### 3.17 Admin

Admin capabilities include:

- User management.
- Verification review/status.
- Listing visibility/management.
- Rental monitoring.
- Payment monitoring.
- Dispute management.
- Basic platform metrics.
- Server-side admin authorization.
- Audit trail for sensitive admin actions where appropriate.

## 4. Mobile / Responsive Scope

The first release is a responsive web application.

Required:

- Common phone widths approximately 320-430 px.
- Tablet layouts.
- Desktop layouts.
- No horizontal page overflow during normal use.
- Touch-friendly controls.
- Mobile navigation.
- Mobile search/filter experience.
- Mobile booking actions.
- Mobile chat experience.
- Responsive admin views for essential operations.

A native iOS/Android application is **not** part of this MVP. The web architecture should remain API-driven so a native client can be added later without redesigning the core backend.

PWA/install-to-home-screen support is a post-core enhancement unless it is inexpensive to add after the responsive web flow is stable.

## 5. Explicitly Deferred / Out of Scope for Core MVP

The following existing prototype areas are not part of the core backend integration unless this document is intentionally revised:

### General Buy/Sell Marketplace

Routes such as `/products`, `/sell`, and `/cart` currently demonstrate a general product buy/sell flow. They are **deferred** while the rental MVP is built.

For the MVP:

- Do not add e-commerce product/order/cart tables solely to support these prototype pages.
- Do not let buy/sell requirements expand the rental schema.
- Existing pages may remain as prototype code temporarily, but they are not considered production-complete features.

### Other Deferred Features

- Native iOS application.
- Native Android application.
- Weekly rental pricing.
- Complex shipping/logistics network.
- Multi-country rollout.
- Multi-currency support.
- Advanced recommendation/ML system.
- Full seller-store/B2B commerce system.
- Loyalty points/reward program.
- Advertising platform.

## 6. Source-of-Truth Rules During Migration

Until migration is complete, the repository contains prototype/hardcoded/mock data. The migration rule is:

1. `docs/database-schema.sql` becomes the canonical persisted data model after TASK 2.
2. Server/API code owns business validation.
3. Frontend consumes APIs/server data.
4. `lib/mock-db.ts`, `lib/nosql/mock.ts`, hardcoded listing arrays, seed chat arrays, and browser-only status changes are temporary.
5. Mock sources are removed after their corresponding real backend feature is verified.

## 7. MVP Completion Criteria

The MVP is considered functionally complete only when two separate real user accounts can complete this scenario with persisted data:

1. User A registers and logs in.
2. User A becomes verified.
3. User A creates a rental listing.
4. User B registers, logs in, and becomes verified.
5. User B finds the listing through persisted search/nearby discovery.
6. User B selects a valid rental period.
7. User B creates a rental request.
8. User A receives and accepts the request.
9. Required payment succeeds through the configured payment integration.
10. User A and User B can chat in the rental conversation.
11. Pickup is confirmed.
12. Rental enters active state.
13. Return is confirmed.
14. Deposit/payment settlement is completed according to the rental outcome.
15. Rental reaches `COMPLETED`.
16. Both parties can leave eligible reviews.
17. Admin can inspect the relevant user, verification, rental, payment, and dispute data.
18. Refreshing/restarting the browser does not erase the transaction because PostgreSQL/server persistence is authoritative.
19. The core flow works on supported mobile and desktop layouts.

## 8. Change-Control Rule

Before the MVP completion criteria above are met, any proposed new feature should be classified as one of:

- Required to complete an existing MVP flow.
- Security/privacy/reliability requirement.
- Deferred until after MVP.

If a feature does not fit the first two categories, it should normally be deferred rather than added to the implementation path.
