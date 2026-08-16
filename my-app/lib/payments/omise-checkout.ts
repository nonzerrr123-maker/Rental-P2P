import type { PoolClient, QueryResultRow } from "pg";
import { query, withTransaction } from "@/lib/db";
import { getPaymentProviderState } from "@/lib/payments/registry";
import { getCheckoutForUser, PaymentError, type CheckoutSummary, type PaymentType } from "@/lib/payments/service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) throw new PaymentError(400, "VALIDATION_ERROR", "rentalRequestId is invalid");
  return text;
}

function toMinor(amount: string): number {
  return Math.round(Number(amount) * 100);
}

type RentalRow = QueryResultRow & {
  id: string;
  borrower_id: string;
  borrower_email: string;
  status: string;
  is_urgent: boolean;
  reservation_expires_at: Date | null;
  rental_amount: string;
  deposit_amount: string;
  urgent_reservation_fee_amount: string;
  currency: string;
};

type LocalPaymentRow = QueryResultRow & {
  id: string;
  type: Exclude<PaymentType, "REFUND" | "PLATFORM_FEE">;
  provider: string;
  provider_reference: string | null;
  status: string;
  amount: string;
  currency: string;
  idempotency_key: string;
};

type Obligation = { type: LocalPaymentRow["type"]; amount: string };

function obligations(rental: RentalRow): Obligation[] {
  const items: Obligation[] = [];
  if (rental.is_urgent) {
    if (toMinor(rental.urgent_reservation_fee_amount) > 0) items.push({ type: "URGENT_RESERVATION_FEE", amount: rental.urgent_reservation_fee_amount });
  } else if (toMinor(rental.rental_amount) > 0) {
    items.push({ type: "RENTAL", amount: rental.rental_amount });
  }
  if (toMinor(rental.deposit_amount) > 0) items.push({ type: "DEPOSIT", amount: rental.deposit_amount });
  return items;
}

async function ensureOmisePayments(client: PoolClient, rental: RentalRow): Promise<LocalPaymentRow[]> {
  const rows: LocalPaymentRow[] = [];
  for (const obligation of obligations(rental)) {
    const idempotencyKey = `rental:${rental.id}:${obligation.type}:v1`;
    await client.query(
      `INSERT INTO payments (rental_request_id, payer_id, type, provider, idempotency_key, amount, currency, status, metadata)
       VALUES ($1, $2, $3, 'OMISE', $4, $5, $6, 'PENDING', '{"source":"server-snapshot","paymentMethod":"PROMPTPAY"}'::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [rental.id, rental.borrower_id, obligation.type, idempotencyKey, obligation.amount, rental.currency],
    );
    const result = await client.query<LocalPaymentRow>(
      `SELECT id, type, provider, provider_reference, status, amount, currency, idempotency_key
       FROM payments WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    );
    const payment = result.rows[0];
    if (!payment) throw new Error("Failed to create Omise payment allocation");
    if (payment.provider !== "OMISE" && payment.status !== "SUCCEEDED") {
      throw new PaymentError(409, "PAYMENT_NOT_CONFIRMABLE", "This checkout was already started with another payment provider");
    }
    rows.push(payment);
    if (obligation.type === "DEPOSIT") {
      await client.query(
        `INSERT INTO deposits (rental_request_id, payment_id, amount, status)
         VALUES ($1, $2, $3, 'PENDING')
         ON CONFLICT (rental_request_id) DO UPDATE SET payment_id = EXCLUDED.payment_id, amount = EXCLUDED.amount, updated_at = now()`,
        [rental.id, payment.id, obligation.amount],
      );
    }
  }
  return rows;
}

export async function startOmiseCheckout(userId: string, rentalRequestIdInput: unknown, returnUrl?: string | null): Promise<CheckoutSummary> {
  const rentalRequestId = requireUuid(rentalRequestIdInput);
  const providerState = getPaymentProviderState();
  if (providerState.mode !== "OMISE" || !providerState.configured) {
    throw new PaymentError(503, "PROVIDER_ERROR", providerState.reason ?? "Omise is not configured");
  }

  const prepared = await withTransaction(async (client) => {
    const result = await client.query<RentalRow>(
      `SELECT r.id, r.borrower_id, borrower.email AS borrower_email, r.status::text AS status,
              r.is_urgent, r.reservation_expires_at, r.rental_amount, r.deposit_amount,
              r.urgent_reservation_fee_amount, r.currency
       FROM rental_requests r
       JOIN users borrower ON borrower.id = r.borrower_id
       WHERE r.id = $1
       LIMIT 1
       FOR UPDATE OF r`,
      [rentalRequestId],
    );
    const rental = result.rows[0];
    if (!rental) throw new PaymentError(404, "RENTAL_NOT_FOUND", "Rental request not found");
    if (rental.borrower_id !== userId) throw new PaymentError(403, "FORBIDDEN", "Only the borrower can pay this rental");
    if (rental.is_urgent && rental.status === "WAITING_PAYMENT" && rental.reservation_expires_at && rental.reservation_expires_at <= new Date()) {
      await client.query(`UPDATE rental_requests SET status='EXPIRED', updated_at=now() WHERE id=$1 AND status='WAITING_PAYMENT'`, [rental.id]);
      throw new PaymentError(409, "PAYMENT_EXPIRED", "Urgent reservation payment window has expired");
    }
    if (rental.status === "PAID") return { rental, payments: [] as LocalPaymentRow[], alreadyPaid: true };
    if (rental.status !== "WAITING_PAYMENT") throw new PaymentError(409, "PAYMENT_NOT_REQUIRED", "Rental is not waiting for payment");

    const payments = await ensureOmisePayments(client, rental);
    if (payments.length === 0) throw new PaymentError(409, "PAYMENT_NOT_REQUIRED", "No payment obligation exists for this rental");
    return { rental, payments, alreadyPaid: false };
  });

  if (prepared.alreadyPaid) return getCheckoutForUser(userId, rentalRequestId);
  const anchor = prepared.payments.find((payment) => payment.type === (prepared.rental.is_urgent ? "URGENT_RESERVATION_FEE" : "RENTAL")) ?? prepared.payments[0];
  const totalMinor = prepared.payments.reduce((sum, payment) => sum + toMinor(payment.amount), 0);
  if (totalMinor < 2_000) {
    throw new PaymentError(409, "PAYMENT_NOT_CONFIRMABLE", "PromptPay checkout total is below the provider minimum of THB 20");
  }

  if (!anchor.provider_reference) {
    try {
      const created = await providerState.provider.createPayment({
        paymentId: anchor.id,
        rentalRequestId,
        type: anchor.type,
        amountMinor: totalMinor,
        currency: prepared.rental.currency,
        idempotencyKey: `omise-checkout:${rentalRequestId}:v1`,
        payerEmail: prepared.rental.borrower_email,
        returnUrl: returnUrl ?? null,
      });
      if (created.action.kind !== "QR") throw new Error("Omise PromptPay checkout did not return a QR action");
      const allocationIds = prepared.payments.map((payment) => payment.id);
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE payments
           SET provider_reference=$2, status='REQUIRES_ACTION',
               metadata = metadata || $3::jsonb, updated_at=now()
           WHERE id=$1 AND provider_reference IS NULL`,
          [anchor.id, created.providerReference, JSON.stringify({
            providerAction: { kind: "QR", imageUrl: created.action.imageUrl },
            providerChargeAmountMinor: totalMinor,
            providerAllocationPaymentIds: allocationIds,
            providerObservedStatus: created.metadata?.providerObservedStatus ?? "pending",
            bundledCheckout: true,
          })],
        );
        await client.query(
          `UPDATE payments
           SET status='REQUIRES_ACTION',
               metadata = metadata || $3::jsonb, updated_at=now()
           WHERE rental_request_id=$1 AND id <> $2 AND id = ANY($4::uuid[]) AND status='PENDING'`,
          [rentalRequestId, anchor.id, JSON.stringify({ providerParentPaymentId: anchor.id, bundledCheckout: true }), allocationIds],
        );
      });
    } catch (error) {
      console.error("Omise checkout create failed", error);
      throw new PaymentError(503, "PROVIDER_ERROR", "Omise PromptPay is temporarily unavailable");
    }
  }

  return getCheckoutForUser(userId, rentalRequestId);
}
