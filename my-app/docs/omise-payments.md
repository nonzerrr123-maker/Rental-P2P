# Omise / Opn payment integration

TASK 15 adds an Omise PromptPay provider behind the payment abstraction created in TASK 14.

## Operational mode

- `PAYMENT_PROVIDER=sandbox` remains the safe default.
- Set `PAYMENT_PROVIDER=omise` only after Omise test credentials and a webhook signing secret are configured.
- PromptPay checkout uses a server-created Omise charge and QR action.
- The browser never decides the amount or payment status.
- A rental becomes `PAID` only after a signed `charge.complete` webhook is accepted and the charge is independently retrieved from Omise with the expected amount, currency, and `successful` status.
- Raw webhook payloads are not persisted. `payment_events` stores a minimal charge reference and payload SHA-256 hash.

## Bundled checkout allocation

Omise PromptPay has a provider minimum per charge. Borow Borow therefore creates one PromptPay charge for the total platform-collected checkout amount while retaining separate internal payment allocations.

Examples:

- Standard rental: `RENTAL + DEPOSIT` → one PromptPay QR → both allocations become `SUCCEEDED` after verified webhook.
- Urgent rental: `URGENT_RESERVATION_FEE + DEPOSIT` → one PromptPay QR. This allows a reservation fee below the provider minimum to be collected together with the deposit without changing the product fee or overcharging.

## Platform-held settlement boundary

For standard rentals, after the authoritative payment succeeds the `RENTAL` payment receives a `metadata.settlement` snapshot:

- `status: PLATFORM_HELD`
- lender/payee user ID
- gross rental amount
- platform fee amount
- calculated payout amount
- `payoutProvider: OMISE_TRANSFER`
- `payoutMode: MANUAL_REQUIRED`

This represents money collected into the platform merchant balance that is not yet considered paid out to the lender.

Actual bank payout is disabled by default with `OMISE_ENABLE_LIVE_PAYOUTS=false`. The Omise transfer adapter is present, but the application does not invoke it automatically because recipient onboarding, recipient verification, release timing, disputes, and production merchant operations must be completed first.

The admin settlement view is `/admin/settlements`.

## PromptPay refunds

Omise PromptPay does not support provider API refunds. Automated refund attempts are rejected before a local refund record is created with `MANUAL_REFUND_REQUIRED`. The original payment/deposit state remains unchanged until the operational refund has actually occurred and a future reconciliation workflow records that result.

## Secrets

Never commit live keys or webhook secrets. Test and live Omise credentials are separate. Webhook signature verification uses the raw body, `Omise-Signature`, and `Omise-Signature-Timestamp` with HMAC-SHA256 and replay tolerance.
