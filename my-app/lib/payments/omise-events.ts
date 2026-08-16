import { createHash } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { withTransaction } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";
import { parseOmiseWebhookEvent, retrieveOmiseCharge, type OmiseCharge } from "@/lib/payments/omise";

type PaymentRow = QueryResultRow & {
  id: string;
  rental_request_id: string;
  payer_id: string;
  type: "RENTAL" | "DEPOSIT" | "URGENT_RESERVATION_FEE" | "PLATFORM_FEE" | "REFUND";
  amount: string;
  currency: string;
  status: string;
  provider_reference: string | null;
};

type RentalRow = QueryResultRow & {
  id: string;
  borrower_id: string;
  lender_id: string;
  item_title: string;
  status: string;
  is_urgent: boolean;
  rental_amount: string;
  deposit_amount: string;
  platform_fee_amount: string;
  urgent_reservation_fee_amount: string;
  currency: string;
};

export type OmiseEventOutcome = {
  outcome: "PROCESSED" | "DUPLICATE" | "IGNORED";
  eventId: string;
  paymentId: string | null;
  paymentStatus?: string;
  rentalStatus?: string;
  reason?: string;
};

function toMinor(amount: string): number {
  return Math.round(Number(amount) * 100);
}

async function lockPaymentByCharge(client: PoolClient, chargeId: string): Promise<PaymentRow | null> {
  const result = await client.query<PaymentRow>(
    `SELECT id, rental_request_id, payer_id, type, amount, currency, status, provider_reference
     FROM payments
     WHERE provider = 'OMISE' AND provider_reference = $1
     LIMIT 1
     FOR UPDATE`,
    [chargeId],
  );
  return result.rows[0] ?? null;
}

async function lockRental(client: PoolClient, rentalRequestId: string): Promise<RentalRow | null> {
  const result = await client.query<RentalRow>(
    `SELECT r.id, r.borrower_id, r.lender_id, i.title AS item_title, r.status::text AS status,
            r.is_urgent, r.rental_amount, r.deposit_amount, r.platform_fee_amount,
            r.urgent_reservation_fee_amount, r.currency
     FROM rental_requests r
     JOIN rental_items i ON i.id = r.item_id
     WHERE r.id = $1
     LIMIT 1
     FOR UPDATE OF r`,
    [rentalRequestId],
  );
  return result.rows[0] ?? null;
}

async function hasSucceededPayment(
  client: PoolClient,
  rentalRequestId: string,
  type: "RENTAL" | "DEPOSIT" | "URGENT_RESERVATION_FEE",
  amount: string,
  currency: string,
): Promise<boolean> {
  if (toMinor(amount) <= 0) return true;
  const result = await client.query(
    `SELECT 1 FROM payments
     WHERE rental_request_id = $1 AND type = $2 AND amount = $3 AND currency = $4 AND status = 'SUCCEEDED'
     LIMIT 1`,
    [rentalRequestId, type, amount, currency],
  );
  return Boolean(result.rowCount);
}

async function requiredPaymentsSatisfied(client: PoolClient, rental: RentalRow): Promise<boolean> {
  const primary = rental.is_urgent
    ? await hasSucceededPayment(client, rental.id, "URGENT_RESERVATION_FEE", rental.urgent_reservation_fee_amount, rental.currency)
    : await hasSucceededPayment(client, rental.id, "RENTAL", rental.rental_amount, rental.currency);
  if (!primary) return false;
  return hasSucceededPayment(client, rental.id, "DEPOSIT", rental.deposit_amount, rental.currency);
}

async function recordSettlementBoundary(client: PoolClient, rental: RentalRow): Promise<void> {
  if (rental.is_urgent) return;
  const payoutMinor = Math.max(0, toMinor(rental.rental_amount) - toMinor(rental.platform_fee_amount));
  const settlement = {
    status: "PLATFORM_HELD",
    payeeUserId: rental.lender_id,
    grossRentalAmount: rental.rental_amount,
    platformFeeAmount: rental.platform_fee_amount,
    payoutAmount: (payoutMinor / 100).toFixed(2),
    currency: rental.currency,
    payoutProvider: "OMISE_TRANSFER",
    payoutMode: "MANUAL_REQUIRED",
    recipientProviderReference: null,
    providerTransferReference: null,
    reason: "Recipient onboarding and live bank payout are intentionally disabled until provider verification is completed",
  };
  await client.query(
    `UPDATE payments
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{settlement}', $2::jsonb, true), updated_at = now()
     WHERE rental_request_id = $1 AND type = 'RENTAL' AND status = 'SUCCEEDED'`,
    [rental.id, JSON.stringify(settlement)],
  );
}

async function finalizeRentalIfPaid(client: PoolClient, rental: RentalRow): Promise<string> {
  if (rental.status === "PAID") {
    await recordSettlementBoundary(client, rental);
    return rental.status;
  }
  if (rental.status !== "WAITING_PAYMENT" || !(await requiredPaymentsSatisfied(client, rental))) return rental.status;

  await client.query(
    `UPDATE rental_requests
     SET status = 'PAID', reservation_expires_at = NULL, updated_at = now()
     WHERE id = $1 AND status = 'WAITING_PAYMENT'`,
    [rental.id],
  );
  rental.status = "PAID";
  await recordSettlementBoundary(client, rental);

  const body = rental.is_urgent
    ? `${rental.item_title}: ค่าจองด่วนและเงินประกันได้รับการยืนยันจาก Omise แล้ว`
    : `${rental.item_title}: ค่าเช่าและเงินประกันได้รับการยืนยันจาก Omise แล้ว`;
  for (const userId of [rental.borrower_id, rental.lender_id]) {
    await createNotification(client, {
      userId,
      type: "RENTAL_PAID",
      title: "Omise ยืนยันการชำระครบแล้ว",
      body,
      relatedEntityType: "RENTAL_REQUEST",
      relatedEntityId: rental.id,
      idempotent: true,
    });
  }
  return rental.status;
}

async function markSucceeded(client: PoolClient, payment: PaymentRow, rental: RentalRow): Promise<string> {
  if (payment.status !== "SUCCEEDED") {
    await client.query(
      `UPDATE payments
       SET status = 'SUCCEEDED', succeeded_at = COALESCE(succeeded_at, now()), failed_at = NULL, updated_at = now()
       WHERE id = $1 AND status IN ('PENDING', 'REQUIRES_ACTION', 'FAILED')`,
      [payment.id],
    );
    payment.status = "SUCCEEDED";
  }
  if (payment.type === "DEPOSIT") {
    await client.query(
      `UPDATE deposits
       SET status = 'HELD', held_at = COALESCE(held_at, now()), updated_at = now()
       WHERE rental_request_id = $1 AND payment_id = $2 AND status IN ('PENDING', 'HELD')`,
      [rental.id, payment.id],
    );
    await createNotification(client, {
      userId: rental.borrower_id,
      type: "DEPOSIT_HELD",
      title: "เงินประกันถูกพักไว้แล้ว",
      body: `Omise ยืนยันเงินประกัน ฿${payment.amount}; ระบบจะถือยอดไว้จนถึงขั้นคืนของ/ระงับข้อพิพาท`,
      relatedEntityType: "PAYMENT",
      relatedEntityId: payment.id,
      idempotent: true,
    });
  }
  await createNotification(client, {
    userId: rental.borrower_id,
    type: "PAYMENT_SUCCEEDED",
    title: "Omise ยืนยันการชำระเงินแล้ว",
    body: `รับชำระ ${payment.type} ฿${payment.amount} แล้ว`,
    relatedEntityType: "PAYMENT",
    relatedEntityId: payment.id,
    idempotent: true,
  });
  return finalizeRentalIfPaid(client, rental);
}

async function markUnsuccessful(client: PoolClient, payment: PaymentRow, rental: RentalRow, charge: OmiseCharge): Promise<void> {
  const status = charge.status === "expired" ? "CANCELLED" : "FAILED";
  await client.query(
    `UPDATE payments
     SET status = $2::payment_status, failed_at = now(), updated_at = now(),
         metadata = metadata || $3::jsonb
     WHERE id = $1 AND status <> 'SUCCEEDED'`,
    [payment.id, status, JSON.stringify({ providerObservedStatus: charge.status })],
  );
  await createNotification(client, {
    userId: rental.borrower_id,
    type: "PAYMENT_FAILED",
    title: "การชำระเงินยังไม่สำเร็จ",
    body: `${payment.type} ฿${payment.amount} มีสถานะ ${charge.status} จาก Omise`,
    relatedEntityType: "PAYMENT",
    relatedEntityId: payment.id,
    idempotent: true,
  });
}

export async function processOmiseWebhook(rawBody: string): Promise<OmiseEventOutcome> {
  const event = parseOmiseWebhookEvent(rawBody);
  if (event.key !== "charge.complete") {
    return { outcome: "IGNORED", eventId: event.id, paymentId: null, reason: `Unsupported event ${event.key}` };
  }

  // The provider retrieval is authoritative. If Omise is unavailable, throw before
  // opening the transaction so their webhook retry can safely try again later.
  const charge = await retrieveOmiseCharge(event.chargeId);
  const payloadHash = createHash("sha256").update(rawBody, "utf8").digest("hex");

  return withTransaction(async (client) => {
    const payment = await lockPaymentByCharge(client, charge.id);
    const eventInsert = await client.query<{ id: string } & QueryResultRow>(
      `INSERT INTO payment_events (payment_id, provider, provider_event_id, event_type, payload)
       VALUES ($1, 'OMISE', $2, $3, $4::jsonb)
       ON CONFLICT (provider, provider_event_id) DO NOTHING
       RETURNING id`,
      [payment?.id ?? null, event.id, event.key, JSON.stringify({ chargeId: charge.id, payloadHash })],
    );
    if (!eventInsert.rowCount) {
      return { outcome: "DUPLICATE", eventId: event.id, paymentId: payment?.id ?? null };
    }

    const finishEvent = async (processingError: string | null) => {
      await client.query(
        `UPDATE payment_events SET processed_at = now(), processing_error = $2 WHERE provider = 'OMISE' AND provider_event_id = $1`,
        [event.id, processingError],
      );
    };

    if (!payment) {
      await finishEvent("UNKNOWN_PAYMENT_REFERENCE");
      return { outcome: "IGNORED", eventId: event.id, paymentId: null, reason: "Unknown Omise charge" };
    }
    if (charge.amount !== toMinor(payment.amount) || charge.currency !== payment.currency.toUpperCase()) {
      await finishEvent("AMOUNT_OR_CURRENCY_MISMATCH");
      return {
        outcome: "IGNORED",
        eventId: event.id,
        paymentId: payment.id,
        paymentStatus: payment.status,
        reason: "Charge amount or currency did not match the server payment snapshot",
      };
    }

    const rental = await lockRental(client, payment.rental_request_id);
    if (!rental) {
      await finishEvent("RENTAL_NOT_FOUND");
      return { outcome: "IGNORED", eventId: event.id, paymentId: payment.id, reason: "Rental not found" };
    }

    let rentalStatus = rental.status;
    if (charge.status === "successful") {
      rentalStatus = await markSucceeded(client, payment, rental);
    } else if (charge.status === "failed" || charge.status === "expired") {
      await markUnsuccessful(client, payment, rental, charge);
    } else {
      await client.query(
        `UPDATE payments SET metadata = metadata || $2::jsonb, updated_at = now() WHERE id = $1`,
        [payment.id, JSON.stringify({ providerObservedStatus: charge.status })],
      );
    }
    await finishEvent(null);
    return {
      outcome: "PROCESSED",
      eventId: event.id,
      paymentId: payment.id,
      paymentStatus: charge.status === "successful" ? "SUCCEEDED" : charge.status,
      rentalStatus,
    };
  });
}
