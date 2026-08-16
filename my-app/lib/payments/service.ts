import type { PoolClient, QueryResultRow } from "pg";
import { query, withTransaction } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";
import { getPaymentProviderState } from "@/lib/payments/registry";
import { sandboxPaymentsEnabled } from "@/lib/payments/sandbox";

export type PaymentType = "RENTAL" | "DEPOSIT" | "URGENT_RESERVATION_FEE" | "PLATFORM_FEE" | "REFUND";
export type PaymentStatus = "PENDING" | "REQUIRES_ACTION" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "PARTIALLY_REFUNDED" | "REFUNDED";
export type DepositStatus = "PENDING" | "HELD" | "RELEASED" | "PARTIALLY_RELEASED" | "FORFEITED" | "REFUNDED";

export type PaymentSummary = {
  id: string;
  rentalRequestId: string;
  originalPaymentId: string | null;
  type: PaymentType;
  provider: string;
  providerReference: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  succeededAt: string | null;
  failedAt: string | null;
  action: { kind: "NONE" | "SANDBOX" | "REDIRECT" | "QR"; url?: string; imageUrl?: string; confirmPath?: string };
  createdAt: string;
};

export type CheckoutSummary = {
  rentalRequestId: string;
  item: { id: string; title: string };
  borrowerId: string;
  lenderId: string;
  status: string;
  isUrgent: boolean;
  reservationExpiresAt: string | null;
  currency: string;
  collectionPolicy: "STANDARD_FULL" | "URGENT_PLATFORM_ONLY";
  requiredAmount: string;
  payments: PaymentSummary[];
  deposit: { amount: string; status: DepositStatus } | null;
  provider: { mode: string; configured: boolean; reason: string | null };
};

type PaymentErrorCode =
  | "VALIDATION_ERROR"
  | "PAYMENT_NOT_FOUND"
  | "RENTAL_NOT_FOUND"
  | "FORBIDDEN"
  | "PAYMENT_NOT_REQUIRED"
  | "PAYMENT_EXPIRED"
  | "PAYMENT_NOT_CONFIRMABLE"
  | "PAYMENT_NOT_REFUNDABLE"
  | "SANDBOX_DISABLED"
  | "PROVIDER_ERROR";

export class PaymentError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 503,
    public readonly code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, field = "id"): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) throw new PaymentError(400, "VALIDATION_ERROR", `${field} is invalid`);
  return text;
}

function toMinor(amount: string): number {
  return Math.round(Number(amount) * 100);
}

function fromMinor(amount: number): string {
  return (amount / 100).toFixed(2);
}

type RentalPaymentRow = QueryResultRow & {
  id: string;
  item_id: string;
  item_title: string;
  borrower_id: string;
  borrower_email: string;
  lender_id: string;
  status: string;
  is_urgent: boolean;
  reservation_expires_at: Date | null;
  rental_amount: string;
  deposit_amount: string;
  platform_fee_amount: string;
  urgent_reservation_fee_amount: string;
  currency: string;
};

type PaymentRow = QueryResultRow & {
  id: string;
  rental_request_id: string;
  original_payment_id: string | null;
  payer_id: string;
  type: PaymentType;
  provider: string;
  provider_reference: string | null;
  idempotency_key: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  metadata: Record<string, unknown> | null;
  succeeded_at: Date | null;
  failed_at: Date | null;
  created_at: Date;
};

type DepositRow = QueryResultRow & {
  amount: string;
  status: DepositStatus;
};

const rentalSelect = `
  SELECT
    r.id,
    r.item_id,
    i.title AS item_title,
    r.borrower_id,
    borrower.email AS borrower_email,
    r.lender_id,
    r.status::text AS status,
    r.is_urgent,
    r.reservation_expires_at,
    r.rental_amount,
    r.deposit_amount,
    r.platform_fee_amount,
    r.urgent_reservation_fee_amount,
    r.currency
  FROM rental_requests r
  JOIN rental_items i ON i.id = r.item_id
  JOIN users borrower ON borrower.id = r.borrower_id
`;

function requiredObligations(rental: RentalPaymentRow): Array<{ type: Exclude<PaymentType, "REFUND">; amount: string }> {
  const obligations: Array<{ type: Exclude<PaymentType, "REFUND">; amount: string }> = [];
  if (rental.is_urgent) {
    if (toMinor(rental.urgent_reservation_fee_amount) > 0) {
      obligations.push({ type: "URGENT_RESERVATION_FEE", amount: rental.urgent_reservation_fee_amount });
    }
  } else if (toMinor(rental.rental_amount) > 0) {
    obligations.push({ type: "RENTAL", amount: rental.rental_amount });
  }
  if (toMinor(rental.deposit_amount) > 0) obligations.push({ type: "DEPOSIT", amount: rental.deposit_amount });
  return obligations;
}

function providerAction(row: PaymentRow): PaymentSummary["action"] {
  if (row.status === "SUCCEEDED" || row.status === "REFUNDED" || row.status === "CANCELLED" || row.status === "FAILED") {
    return { kind: "NONE" };
  }
  if (row.provider === "SANDBOX") {
    return { kind: "SANDBOX", confirmPath: `/api/payments/sandbox/${row.id}/confirm` };
  }
  const action = row.metadata?.providerAction;
  if (action && typeof action === "object") {
    const value = action as Record<string, unknown>;
    if (value.kind === "REDIRECT" && typeof value.url === "string") return { kind: "REDIRECT", url: value.url };
    if (value.kind === "QR" && typeof value.imageUrl === "string") return { kind: "QR", imageUrl: value.imageUrl };
  }
  return { kind: "NONE" };
}

function mapPayment(row: PaymentRow): PaymentSummary {
  return {
    id: row.id,
    rentalRequestId: row.rental_request_id,
    originalPaymentId: row.original_payment_id,
    type: row.type,
    provider: row.provider,
    providerReference: row.provider_reference,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    succeededAt: row.succeeded_at?.toISOString() ?? null,
    failedAt: row.failed_at?.toISOString() ?? null,
    action: providerAction(row),
    createdAt: row.created_at.toISOString(),
  };
}

async function lockRental(client: PoolClient, rentalRequestId: string): Promise<RentalPaymentRow> {
  const result = await client.query<RentalPaymentRow>(`${rentalSelect} WHERE r.id = $1 FOR UPDATE OF r`, [rentalRequestId]);
  const rental = result.rows[0];
  if (!rental) throw new PaymentError(404, "RENTAL_NOT_FOUND", "Rental request not found");
  return rental;
}

async function assertRentalPayable(client: PoolClient, rental: RentalPaymentRow, userId: string): Promise<void> {
  if (rental.borrower_id !== userId) throw new PaymentError(403, "FORBIDDEN", "Only the borrower can pay this rental");
  if (rental.is_urgent && rental.status === "WAITING_PAYMENT" && rental.reservation_expires_at && rental.reservation_expires_at <= new Date()) {
    await client.query(
      `UPDATE rental_requests SET status = 'EXPIRED', updated_at = now() WHERE id = $1 AND status = 'WAITING_PAYMENT'`,
      [rental.id],
    );
    throw new PaymentError(409, "PAYMENT_EXPIRED", "Urgent reservation payment window has expired");
  }
  if (rental.status !== "WAITING_PAYMENT" && rental.status !== "PAID") {
    throw new PaymentError(409, "PAYMENT_NOT_REQUIRED", "Rental is not waiting for payment");
  }
}

async function loadPayments(client: PoolClient, rentalRequestId: string): Promise<PaymentRow[]> {
  const result = await client.query<PaymentRow>(
    `SELECT id, rental_request_id, original_payment_id, payer_id, type, provider, provider_reference,
            idempotency_key, amount, currency, status, metadata, succeeded_at, failed_at, created_at
     FROM payments
     WHERE rental_request_id = $1
     ORDER BY created_at ASC`,
    [rentalRequestId],
  );
  return result.rows;
}

async function loadDeposit(client: PoolClient, rentalRequestId: string): Promise<DepositRow | null> {
  const result = await client.query<DepositRow>(`SELECT amount, status FROM deposits WHERE rental_request_id = $1 LIMIT 1`, [rentalRequestId]);
  return result.rows[0] ?? null;
}

async function buildCheckout(client: PoolClient, rental: RentalPaymentRow): Promise<CheckoutSummary> {
  const payments = await loadPayments(client, rental.id);
  const deposit = await loadDeposit(client, rental.id);
  const required = requiredObligations(rental).reduce((sum, item) => sum + toMinor(item.amount), 0);
  const providerState = getPaymentProviderState();
  return {
    rentalRequestId: rental.id,
    item: { id: rental.item_id, title: rental.item_title },
    borrowerId: rental.borrower_id,
    lenderId: rental.lender_id,
    status: rental.status,
    isUrgent: rental.is_urgent,
    reservationExpiresAt: rental.reservation_expires_at?.toISOString() ?? null,
    currency: rental.currency,
    collectionPolicy: rental.is_urgent ? "URGENT_PLATFORM_ONLY" : "STANDARD_FULL",
    requiredAmount: fromMinor(required),
    payments: payments.map(mapPayment),
    deposit: deposit ? { amount: deposit.amount, status: deposit.status } : null,
    provider: { mode: providerState.mode, configured: providerState.configured, reason: providerState.reason },
  };
}

export async function getCheckoutForUser(userId: string, rentalRequestIdInput: unknown): Promise<CheckoutSummary> {
  const rentalRequestId = requireUuid(rentalRequestIdInput, "rentalRequestId");
  return withTransaction(async (client) => {
    const rental = await lockRental(client, rentalRequestId);
    await assertRentalPayable(client, rental, userId);
    return buildCheckout(client, rental);
  });
}

async function ensureLocalPayment(
  client: PoolClient,
  rental: RentalPaymentRow,
  obligation: { type: Exclude<PaymentType, "REFUND">; amount: string },
  providerName: string,
): Promise<PaymentRow> {
  const idempotencyKey = `rental:${rental.id}:${obligation.type}:v1`;
  await client.query(
    `INSERT INTO payments (rental_request_id, payer_id, type, provider, idempotency_key, amount, currency, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', '{"source":"server-snapshot"}'::jsonb)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [rental.id, rental.borrower_id, obligation.type, providerName, idempotencyKey, obligation.amount, rental.currency],
  );
  const result = await client.query<PaymentRow>(
    `SELECT id, rental_request_id, original_payment_id, payer_id, type, provider, provider_reference,
            idempotency_key, amount, currency, status, metadata, succeeded_at, failed_at, created_at
     FROM payments WHERE idempotency_key = $1 LIMIT 1`,
    [idempotencyKey],
  );
  const payment = result.rows[0];
  if (!payment) throw new Error("Failed to create payment obligation");
  if (obligation.type === "DEPOSIT") {
    await client.query(
      `INSERT INTO deposits (rental_request_id, payment_id, amount, status)
       VALUES ($1, $2, $3, 'PENDING')
       ON CONFLICT (rental_request_id) DO UPDATE SET payment_id = EXCLUDED.payment_id, amount = EXCLUDED.amount, updated_at = now()`,
      [rental.id, payment.id, obligation.amount],
    );
  }
  return payment;
}

export async function startCheckout(
  userId: string,
  rentalRequestIdInput: unknown,
  returnUrl?: string | null,
): Promise<CheckoutSummary> {
  const rentalRequestId = requireUuid(rentalRequestIdInput, "rentalRequestId");
  const providerState = getPaymentProviderState();
  const local = await withTransaction(async (client) => {
    const rental = await lockRental(client, rentalRequestId);
    await assertRentalPayable(client, rental, userId);
    if (rental.status === "PAID") return { rental, payments: await loadPayments(client, rental.id) };
    const obligations = requiredObligations(rental);
    if (obligations.length === 0) throw new PaymentError(409, "PAYMENT_NOT_REQUIRED", "No payment obligation exists for this rental");
    const payments: PaymentRow[] = [];
    for (const obligation of obligations) {
      payments.push(await ensureLocalPayment(client, rental, obligation, providerState.provider.name));
    }
    return { rental, payments };
  });

  for (const payment of local.payments) {
    if (payment.provider_reference || payment.status === "SUCCEEDED" || payment.status === "REFUNDED") continue;
    try {
      const created = await providerState.provider.createPayment({
        paymentId: payment.id,
        rentalRequestId: payment.rental_request_id,
        type: payment.type as Exclude<PaymentType, "REFUND">,
        amountMinor: toMinor(payment.amount),
        currency: payment.currency,
        idempotencyKey: payment.idempotency_key ?? `payment:${payment.id}`,
        payerEmail: local.rental.borrower_email,
        returnUrl: returnUrl ?? null,
      });
      const providerAction = created.action.kind === "REDIRECT"
        ? { kind: "REDIRECT", url: created.action.url }
        : created.action.kind === "QR"
          ? { kind: "QR", imageUrl: created.action.imageUrl }
          : { kind: created.action.kind };
      await query(
        `UPDATE payments
         SET provider = $2, provider_reference = $3, status = $4,
             metadata = metadata || $5::jsonb, updated_at = now()
         WHERE id = $1 AND provider_reference IS NULL`,
        [payment.id, created.provider, created.providerReference, created.state, JSON.stringify({ providerAction, ...(created.metadata ?? {}) })],
      );
    } catch (error) {
      console.error("Payment provider create failed", error);
      throw new PaymentError(503, "PROVIDER_ERROR", "Payment provider is temporarily unavailable");
    }
  }

  return getCheckoutForUser(userId, rentalRequestId);
}

async function requiredPaymentsSatisfied(client: PoolClient, rental: RentalPaymentRow): Promise<boolean> {
  for (const obligation of requiredObligations(rental)) {
    const result = await client.query(
      `SELECT 1 FROM payments
       WHERE rental_request_id = $1 AND type = $2 AND amount = $3 AND currency = $4 AND status = 'SUCCEEDED'
       LIMIT 1`,
      [rental.id, obligation.type, obligation.amount, rental.currency],
    );
    if (!result.rowCount) return false;
  }
  return true;
}

export async function confirmSandboxPayment(userId: string, paymentIdInput: unknown): Promise<CheckoutSummary> {
  if (!sandboxPaymentsEnabled()) throw new PaymentError(403, "SANDBOX_DISABLED", "Sandbox payment confirmation is disabled");
  const paymentId = requireUuid(paymentIdInput, "paymentId");
  return withTransaction(async (client) => {
    const result = await client.query<PaymentRow & { borrower_id: string }>(
      `SELECT p.id, p.rental_request_id, p.original_payment_id, p.payer_id, p.type, p.provider,
              p.provider_reference, p.idempotency_key, p.amount, p.currency, p.status, p.metadata,
              p.succeeded_at, p.failed_at, p.created_at, r.borrower_id
       FROM payments p
       JOIN rental_requests r ON r.id = p.rental_request_id
       WHERE p.id = $1
       FOR UPDATE OF p, r`,
      [paymentId],
    );
    const payment = result.rows[0];
    if (!payment) throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    if (payment.borrower_id !== userId || payment.payer_id !== userId) throw new PaymentError(403, "FORBIDDEN", "You cannot confirm this payment");
    if (payment.provider !== "SANDBOX") throw new PaymentError(409, "PAYMENT_NOT_CONFIRMABLE", "Only sandbox payments can use this endpoint");

    const rental = await lockRental(client, payment.rental_request_id);
    await assertRentalPayable(client, rental, userId);
    if (payment.status !== "SUCCEEDED") {
      if (payment.status !== "PENDING" && payment.status !== "REQUIRES_ACTION") {
        throw new PaymentError(409, "PAYMENT_NOT_CONFIRMABLE", "Payment is not confirmable in its current state");
      }
      await client.query(`UPDATE payments SET status = 'SUCCEEDED', succeeded_at = now(), updated_at = now() WHERE id = $1`, [payment.id]);
      await client.query(
        `INSERT INTO payment_events (payment_id, provider, provider_event_id, event_type, payload, processed_at)
         VALUES ($1, 'SANDBOX', $2, 'payment.succeeded', $3::jsonb, now())
         ON CONFLICT (provider, provider_event_id) DO NOTHING`,
        [payment.id, `sandbox:${payment.id}:succeeded`, JSON.stringify({ paymentId: payment.id, amount: payment.amount, currency: payment.currency })],
      );
      if (payment.type === "DEPOSIT") {
        await client.query(
          `UPDATE deposits SET status = 'HELD', held_at = COALESCE(held_at, now()), updated_at = now()
           WHERE rental_request_id = $1 AND payment_id = $2`,
          [rental.id, payment.id],
        );
        await createNotification(client, {
          userId: rental.borrower_id,
          type: "DEPOSIT_HELD",
          title: "เงินประกันถูกพักไว้แล้ว",
          body: `เงินประกัน ฿${payment.amount} ถูกเก็บไว้ในระบบจนกว่ารายการยืมจะสิ้นสุด`,
          relatedEntityType: "PAYMENT",
          relatedEntityId: payment.id,
          idempotent: true,
        });
      }
      await createNotification(client, {
        userId: rental.borrower_id,
        type: "PAYMENT_SUCCEEDED",
        title: "รับชำระเงินแล้ว",
        body: `ระบบยืนยันการชำระ ${payment.type} ฿${payment.amount} แล้ว`,
        relatedEntityType: "PAYMENT",
        relatedEntityId: payment.id,
        idempotent: true,
      });
    }

    if (rental.status === "WAITING_PAYMENT" && await requiredPaymentsSatisfied(client, rental)) {
      await client.query(
        `UPDATE rental_requests
         SET status = 'PAID', reservation_expires_at = NULL, updated_at = now()
         WHERE id = $1 AND status = 'WAITING_PAYMENT'`,
        [rental.id],
      );
      rental.status = "PAID";
      rental.reservation_expires_at = null;
      const common = {
        type: "RENTAL_PAID",
        title: "รายการชำระครบแล้ว",
        body: rental.is_urgent
          ? `${rental.item_title}: ค่าจองด่วนและเงินประกันที่แพลตฟอร์มเรียกเก็บครบแล้ว`
          : `${rental.item_title}: ค่าเช่าและเงินประกันชำระครบแล้ว`,
        relatedEntityType: "RENTAL_REQUEST",
        relatedEntityId: rental.id,
        idempotent: true,
      } as const;
      await createNotification(client, { ...common, userId: rental.borrower_id });
      await createNotification(client, { ...common, userId: rental.lender_id });
    }
    return buildCheckout(client, rental);
  });
}

export async function refundPayment(actorId: string, paymentIdInput: unknown): Promise<PaymentSummary> {
  const paymentId = requireUuid(paymentIdInput, "paymentId");
  const initial = await withTransaction(async (client) => {
    const result = await client.query<PaymentRow>(
      `SELECT id, rental_request_id, original_payment_id, payer_id, type, provider, provider_reference,
              idempotency_key, amount, currency, status, metadata, succeeded_at, failed_at, created_at
       FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId],
    );
    const payment = result.rows[0];
    if (!payment) throw new PaymentError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    if (payment.type === "REFUND" || (payment.status !== "SUCCEEDED" && payment.status !== "REFUNDED")) {
      throw new PaymentError(409, "PAYMENT_NOT_REFUNDABLE", "Payment is not refundable");
    }
    const existing = await client.query<PaymentRow>(
      `SELECT id, rental_request_id, original_payment_id, payer_id, type, provider, provider_reference,
              idempotency_key, amount, currency, status, metadata, succeeded_at, failed_at, created_at
       FROM payments WHERE original_payment_id = $1 AND type = 'REFUND' ORDER BY created_at DESC LIMIT 1`,
      [payment.id],
    );
    if (existing.rows[0]?.status === "SUCCEEDED") return { original: payment, refund: existing.rows[0], alreadyDone: true };
    const idempotencyKey = `refund:${payment.id}:full:v1`;
    await client.query(
      `INSERT INTO payments (rental_request_id, original_payment_id, payer_id, type, provider, idempotency_key, amount, currency, status, metadata)
       VALUES ($1, $2, $3, 'REFUND', $4, $5, $6, $7, 'PENDING', $8::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [payment.rental_request_id, payment.id, payment.payer_id, payment.provider, idempotencyKey, payment.amount, payment.currency, JSON.stringify({ requestedBy: actorId })],
    );
    const refundResult = await client.query<PaymentRow>(
      `SELECT id, rental_request_id, original_payment_id, payer_id, type, provider, provider_reference,
              idempotency_key, amount, currency, status, metadata, succeeded_at, failed_at, created_at
       FROM payments WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    );
    return { original: payment, refund: refundResult.rows[0], alreadyDone: false };
  });
  if (initial.alreadyDone) return mapPayment(initial.refund);

  const providerState = getPaymentProviderState();
  if (initial.original.provider !== providerState.provider.name) {
    throw new PaymentError(503, "PROVIDER_ERROR", `Provider ${initial.original.provider} is not available for refund`);
  }
  let providerRefund;
  try {
    providerRefund = await providerState.provider.refundPayment({
      paymentId: initial.refund.id,
      providerReference: initial.original.provider_reference ?? initial.original.id,
      amountMinor: toMinor(initial.original.amount),
      currency: initial.original.currency,
      idempotencyKey: initial.refund.idempotency_key ?? `refund:${initial.refund.id}`,
    });
  } catch (error) {
    console.error("Payment provider refund failed", error);
    throw new PaymentError(503, "PROVIDER_ERROR", "Payment provider refund failed");
  }

  return withTransaction(async (client) => {
    await client.query(
      `UPDATE payments SET provider_reference = $2, status = 'SUCCEEDED', succeeded_at = now(), updated_at = now() WHERE id = $1`,
      [initial.refund.id, providerRefund.providerReference],
    );
    await client.query(`UPDATE payments SET status = 'REFUNDED', updated_at = now() WHERE id = $1`, [initial.original.id]);
    await client.query(
      `INSERT INTO payment_events (payment_id, provider, provider_event_id, event_type, payload, processed_at)
       VALUES ($1, $2, $3, 'refund.succeeded', $4::jsonb, now())
       ON CONFLICT (provider, provider_event_id) DO NOTHING`,
      [initial.refund.id, initial.original.provider, providerRefund.providerReference, JSON.stringify({ originalPaymentId: initial.original.id, amount: initial.original.amount })],
    );
    if (initial.original.type === "DEPOSIT") {
      await client.query(
        `UPDATE deposits SET status = 'REFUNDED', refunded_at = now(), updated_at = now() WHERE rental_request_id = $1`,
        [initial.original.rental_request_id],
      );
    }
    await createNotification(client, {
      userId: initial.original.payer_id,
      type: "PAYMENT_REFUNDED",
      title: "คืนเงินแล้ว",
      body: `คืนเงิน ฿${initial.original.amount} สำหรับ ${initial.original.type} แล้ว`,
      relatedEntityType: "PAYMENT",
      relatedEntityId: initial.refund.id,
      idempotent: true,
    });
    await client.query(
      `INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, details)
       VALUES ($1, 'REFUND_PAYMENT', 'PAYMENT', $2, $3::jsonb)`,
      [actorId, initial.original.id, JSON.stringify({ refundPaymentId: initial.refund.id, amount: initial.original.amount })],
    );
    const result = await client.query<PaymentRow>(
      `SELECT id, rental_request_id, original_payment_id, payer_id, type, provider, provider_reference,
              idempotency_key, amount, currency, status, metadata, succeeded_at, failed_at, created_at
       FROM payments WHERE id = $1`,
      [initial.refund.id],
    );
    return mapPayment(result.rows[0]);
  });
}

export async function listPaymentsForAdmin(): Promise<PaymentSummary[]> {
  const result = await query<PaymentRow>(
    `SELECT id, rental_request_id, original_payment_id, payer_id, type, provider, provider_reference,
            idempotency_key, amount, currency, status, metadata, succeeded_at, failed_at, created_at
     FROM payments ORDER BY created_at DESC LIMIT 200`,
  );
  return result.rows.map(mapPayment);
}
