import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { AuthUser } from "@/lib/auth/session";
import { query, withTransaction } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";
import { deleteObject, getObject, putObject } from "@/lib/storage/s3";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMS_VERSION = "mvp-2026-08-17";
const MAX_EVIDENCE_FILES = 4;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

type RentalStatus =
  | "REQUESTED" | "ACCEPTED" | "REJECTED" | "WAITING_PAYMENT" | "PAID" | "WAITING_PICKUP"
  | "RENTING" | "RETURNING" | "RETURNED" | "COMPLETED" | "DISPUTED" | "CANCELLED" | "EXPIRED";
export type HandoverEventType = "PICKUP" | "RETURN";

type RentalRow = QueryResultRow & {
  id: string;
  item_id: string;
  item_title: string;
  item_condition: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  location_label: string | null;
  borrower_id: string;
  borrower_name: string;
  lender_id: string;
  lender_name: string;
  pricing_mode: "HOUR" | "DAY";
  starts_at: Date;
  ends_at: Date;
  unit_rate: string;
  duration_units: string;
  rental_amount: string;
  deposit_amount: string;
  platform_fee_amount: string;
  urgent_reservation_fee_amount: string;
  currency: string;
  is_urgent: boolean;
  status: RentalStatus;
  completed_at: Date | null;
};

type ContractRow = QueryResultRow & {
  id: string;
  terms_version: string;
  terms_snapshot: Record<string, unknown>;
  lender_confirmed_at: Date | null;
  borrower_confirmed_at: Date | null;
  agreed_at: Date | null;
};

type HandoverRow = QueryResultRow & {
  id: string;
  event_type: HandoverEventType;
  confirmed_by: string;
  display_name: string;
  condition_notes: string | null;
  evidence_storage_keys: string[];
  created_at: Date;
};

type DepositRow = QueryResultRow & {
  id: string;
  amount: string;
  status: string;
  payment_id: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_metadata: Record<string, unknown> | null;
};

type SettlementRow = QueryResultRow & {
  payment_id: string;
  metadata: Record<string, unknown>;
};

export class FulfillmentError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "FulfillmentError";
  }
}

export type RentalFulfillmentSummary = {
  id: string;
  status: RentalStatus;
  item: { id: string; title: string; condition: string };
  borrower: { id: string; displayName: string };
  lender: { id: string; displayName: string };
  schedule: { startsAt: string; endsAt: string };
  pricing: {
    mode: "HOUR" | "DAY";
    unitRate: string;
    durationUnits: string;
    rentalAmount: string;
    depositAmount: string;
    platformFeeAmount: string;
    urgentReservationFeeAmount: string;
    currency: string;
    isUrgent: boolean;
  };
  approximateLocation: { province: string; district: string | null; subdistrict: string | null; label: string | null };
  contract: null | {
    id: string;
    termsVersion: string;
    lenderConfirmedAt: string | null;
    borrowerConfirmedAt: string | null;
    agreedAt: string | null;
  };
  handovers: Array<{
    id: string;
    type: HandoverEventType;
    confirmedBy: { id: string; displayName: string };
    conditionNotes: string | null;
    evidenceCount: number;
    createdAt: string;
  }>;
  deposit: null | {
    amount: string;
    status: string;
    provider: string | null;
    resolution: string | null;
  };
  settlement: null | {
    status: string;
    payoutMode: string;
    payoutAmount: string | null;
    provider: string | null;
    providerTransferReference: string | null;
  };
  openDisputeCount: number;
  completedAt: string | null;
};

function requireUuid(value: unknown, field = "rentalId"): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) throw new FulfillmentError(400, "VALIDATION_ERROR", "Invalid rental identifier", { [field]: "รหัสรายการไม่ถูกต้อง" });
  return text;
}

function isAdmin(user: AuthUser): boolean {
  return user.role === "ADMIN" || user.role === "SUPERADMIN";
}

function assertParticipant(user: AuthUser, rental: RentalRow, allowAdminRead = true): void {
  if (user.id === rental.borrower_id || user.id === rental.lender_id) return;
  if (allowAdminRead && isAdmin(user)) return;
  throw new FulfillmentError(403, "FORBIDDEN", "You are not a participant in this rental");
}

function assertDirectParticipant(user: AuthUser, rental: RentalRow): "BORROWER" | "LENDER" {
  if (user.id === rental.borrower_id) return "BORROWER";
  if (user.id === rental.lender_id) return "LENDER";
  throw new FulfillmentError(403, "FORBIDDEN", "Only the borrower or lender can confirm this step");
}

async function loadRental(client: PoolClient, rentalId: string, lock = false): Promise<RentalRow> {
  const result = await client.query<RentalRow>(
    `SELECT r.id, r.item_id, i.title AS item_title, i.condition::text AS item_condition,
            i.province, i.district, i.subdistrict, i.location_label,
            r.borrower_id, borrower.display_name AS borrower_name,
            r.lender_id, lender.display_name AS lender_name,
            r.pricing_mode, r.starts_at, r.ends_at, r.unit_rate, r.duration_units,
            r.rental_amount, r.deposit_amount, r.platform_fee_amount, r.urgent_reservation_fee_amount,
            r.currency, r.is_urgent, r.status::text AS status, r.completed_at
     FROM rental_requests r
     JOIN rental_items i ON i.id = r.item_id
     JOIN users borrower ON borrower.id = r.borrower_id
     JOIN users lender ON lender.id = r.lender_id
     WHERE r.id = $1
     LIMIT 1${lock ? " FOR UPDATE OF r" : ""}`,
    [rentalId],
  );
  const rental = result.rows[0];
  if (!rental) throw new FulfillmentError(404, "RENTAL_NOT_FOUND", "Rental not found");
  return rental;
}

async function notifyParticipants(client: PoolClient, rental: RentalRow, type: string, title: string, body: string): Promise<void> {
  for (const userId of [rental.borrower_id, rental.lender_id]) {
    await createNotification(client, {
      userId,
      type,
      title,
      body,
      relatedEntityType: "RENTAL_REQUEST",
      relatedEntityId: rental.id,
      idempotent: true,
    });
  }
}

function settlementObject(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const settlement = metadata?.settlement;
  return settlement && typeof settlement === "object" ? settlement as Record<string, unknown> : {};
}

function depositResolution(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.depositResolution;
  if (!value || typeof value !== "object") return null;
  const status = (value as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}

async function getSummaryWithClient(client: PoolClient, actor: AuthUser, rentalId: string): Promise<RentalFulfillmentSummary> {
  const rental = await loadRental(client, rentalId);
  assertParticipant(actor, rental, true);
  const [contractResult, handoverResult, depositResult, settlementResult, disputeResult] = await Promise.all([
    client.query<ContractRow>(
      `SELECT id, terms_version, terms_snapshot, lender_confirmed_at, borrower_confirmed_at, agreed_at
       FROM rental_contracts WHERE rental_request_id = $1 LIMIT 1`, [rentalId]),
    client.query<HandoverRow>(
      `SELECT h.id, h.event_type, h.confirmed_by, u.display_name, h.condition_notes, h.evidence_storage_keys, h.created_at
       FROM rental_handover_events h JOIN users u ON u.id = h.confirmed_by
       WHERE h.rental_request_id = $1 ORDER BY h.created_at ASC, h.id ASC`, [rentalId]),
    client.query<DepositRow>(
      `SELECT d.id, d.amount, d.status::text AS status, d.payment_id,
              p.provider AS payment_provider, p.provider_reference AS payment_reference, p.metadata AS payment_metadata
       FROM deposits d LEFT JOIN payments p ON p.id = d.payment_id
       WHERE d.rental_request_id = $1 LIMIT 1`, [rentalId]),
    client.query<SettlementRow>(
      `SELECT id AS payment_id, metadata FROM payments
       WHERE rental_request_id = $1 AND type = 'RENTAL' AND status = 'SUCCEEDED' AND metadata ? 'settlement'
       ORDER BY created_at DESC LIMIT 1`, [rentalId]),
    client.query<{ count: string } & QueryResultRow>(
      `SELECT count(*)::text AS count FROM disputes WHERE rental_request_id = $1 AND status IN ('OPEN','UNDER_REVIEW')`, [rentalId]),
  ]);
  const contract = contractResult.rows[0] ?? null;
  const deposit = depositResult.rows[0] ?? null;
  const settlementRow = settlementResult.rows[0] ?? null;
  const settlement = settlementObject(settlementRow?.metadata);
  return {
    id: rental.id,
    status: rental.status,
    item: { id: rental.item_id, title: rental.item_title, condition: rental.item_condition },
    borrower: { id: rental.borrower_id, displayName: rental.borrower_name },
    lender: { id: rental.lender_id, displayName: rental.lender_name },
    schedule: { startsAt: rental.starts_at.toISOString(), endsAt: rental.ends_at.toISOString() },
    pricing: {
      mode: rental.pricing_mode,
      unitRate: rental.unit_rate,
      durationUnits: rental.duration_units,
      rentalAmount: rental.rental_amount,
      depositAmount: rental.deposit_amount,
      platformFeeAmount: rental.platform_fee_amount,
      urgentReservationFeeAmount: rental.urgent_reservation_fee_amount,
      currency: rental.currency,
      isUrgent: rental.is_urgent,
    },
    approximateLocation: { province: rental.province, district: rental.district, subdistrict: rental.subdistrict, label: rental.location_label },
    contract: contract ? {
      id: contract.id,
      termsVersion: contract.terms_version,
      lenderConfirmedAt: contract.lender_confirmed_at?.toISOString() ?? null,
      borrowerConfirmedAt: contract.borrower_confirmed_at?.toISOString() ?? null,
      agreedAt: contract.agreed_at?.toISOString() ?? null,
    } : null,
    handovers: handoverResult.rows.map((row) => ({
      id: row.id,
      type: row.event_type,
      confirmedBy: { id: row.confirmed_by, displayName: row.display_name },
      conditionNotes: row.condition_notes,
      evidenceCount: row.evidence_storage_keys.length,
      createdAt: row.created_at.toISOString(),
    })),
    deposit: deposit ? {
      amount: deposit.amount,
      status: deposit.status,
      provider: deposit.payment_provider,
      resolution: depositResolution(deposit.payment_metadata),
    } : null,
    settlement: settlementRow ? {
      status: typeof settlement.status === "string" ? settlement.status : "PLATFORM_HELD",
      payoutMode: typeof settlement.payoutMode === "string" ? settlement.payoutMode : "MANUAL_REQUIRED",
      payoutAmount: typeof settlement.payoutAmount === "string" ? settlement.payoutAmount : null,
      provider: typeof settlement.payoutProvider === "string" ? settlement.payoutProvider : null,
      providerTransferReference: typeof settlement.providerTransferReference === "string" ? settlement.providerTransferReference : null,
    } : null,
    openDisputeCount: Number(disputeResult.rows[0]?.count ?? 0),
    completedAt: rental.completed_at?.toISOString() ?? null,
  };
}

export async function getRentalFulfillment(actor: AuthUser, rentalIdInput: unknown): Promise<RentalFulfillmentSummary> {
  const rentalId = requireUuid(rentalIdInput);
  return withTransaction((client) => getSummaryWithClient(client, actor, rentalId));
}

function contractSnapshot(rental: RentalRow): Record<string, unknown> {
  return {
    version: TERMS_VERSION,
    rentalRequestId: rental.id,
    item: { id: rental.item_id, title: rental.item_title, condition: rental.item_condition },
    parties: { borrowerId: rental.borrower_id, lenderId: rental.lender_id },
    schedule: { startsAt: rental.starts_at.toISOString(), endsAt: rental.ends_at.toISOString() },
    pricing: {
      mode: rental.pricing_mode,
      unitRate: rental.unit_rate,
      durationUnits: rental.duration_units,
      rentalAmount: rental.rental_amount,
      depositAmount: rental.deposit_amount,
      platformFeeAmount: rental.platform_fee_amount,
      urgentReservationFeeAmount: rental.urgent_reservation_fee_amount,
      currency: rental.currency,
      isUrgent: rental.is_urgent,
    },
    location: { province: rental.province, district: rental.district, subdistrict: rental.subdistrict, label: rental.location_label },
    rules: {
      handoverRequiresBothParties: true,
      returnRequiresBothParties: true,
      depositHeldUntilReturnResolution: true,
      disputesFreezeCompletionAndPayout: true,
    },
  };
}

export async function confirmRentalContract(actor: AuthUser, rentalIdInput: unknown): Promise<RentalFulfillmentSummary> {
  const rentalId = requireUuid(rentalIdInput);
  return withTransaction(async (client) => {
    const rental = await loadRental(client, rentalId, true);
    const perspective = assertDirectParticipant(actor, rental);
    if (rental.status !== "PAID" && rental.status !== "WAITING_PICKUP") {
      throw new FulfillmentError(409, "CONTRACT_NOT_CONFIRMABLE", "Contract can only be confirmed after payment and before pickup");
    }
    await client.query(
      `INSERT INTO rental_contracts (rental_request_id, terms_version, terms_snapshot)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (rental_request_id) DO NOTHING`,
      [rental.id, TERMS_VERSION, JSON.stringify(contractSnapshot(rental))],
    );
    const column = perspective === "BORROWER" ? "borrower_confirmed_at" : "lender_confirmed_at";
    await client.query(`UPDATE rental_contracts SET ${column} = COALESCE(${column}, now()) WHERE rental_request_id = $1`, [rental.id]);
    const contract = await client.query<ContractRow>(
      `SELECT id, terms_version, terms_snapshot, lender_confirmed_at, borrower_confirmed_at, agreed_at
       FROM rental_contracts WHERE rental_request_id = $1 FOR UPDATE`, [rental.id]);
    const row = contract.rows[0];
    if (row.lender_confirmed_at && row.borrower_confirmed_at && !row.agreed_at) {
      await client.query(`UPDATE rental_contracts SET agreed_at = now() WHERE id = $1 AND agreed_at IS NULL`, [row.id]);
      if (rental.status === "PAID") {
        await client.query(`UPDATE rental_requests SET status = 'WAITING_PICKUP', updated_at = now() WHERE id = $1 AND status = 'PAID'`, [rental.id]);
        rental.status = "WAITING_PICKUP";
      }
      await notifyParticipants(client, rental, "CONTRACT_AGREED", "ยืนยันสัญญาครบแล้ว", `${rental.item_title}: ทั้งสองฝ่ายยืนยันเงื่อนไขแล้ว เตรียมนัดรับของได้`);
    } else {
      await createNotification(client, {
        userId: perspective === "BORROWER" ? rental.lender_id : rental.borrower_id,
        type: "CONTRACT_CONFIRMATION_REQUIRED",
        title: "รอยืนยันสัญญาจากคุณ",
        body: `${rental.item_title}: อีกฝ่ายยืนยันสัญญาแล้ว กรุณาตรวจสอบและยืนยัน`,
        relatedEntityType: "RENTAL_REQUEST",
        relatedEntityId: rental.id,
        idempotent: true,
      });
    }
    return getSummaryWithClient(client, actor, rental.id);
  });
}

function normalizeNotes(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > 1000) throw new FulfillmentError(400, "VALIDATION_ERROR", "Condition notes are too long", { conditionNotes: "รายละเอียดต้องไม่เกิน 1,000 ตัวอักษร" });
  return text;
}

function extensionFor(bytes: Uint8Array, mime: string): string | null {
  if (mime === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (mime === "image/png" && bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
  if (mime === "image/webp" && bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

async function uploadEvidence(rentalId: string, eventType: HandoverEventType, actorId: string, files: File[]): Promise<string[]> {
  if (files.length > MAX_EVIDENCE_FILES) throw new FulfillmentError(400, "VALIDATION_ERROR", "Too many evidence files", { files: `แนบรูปได้สูงสุด ${MAX_EVIDENCE_FILES} รูป` });
  const uploaded: string[] = [];
  try {
    for (const file of files) {
      if (file.size <= 0 || file.size > MAX_EVIDENCE_BYTES) throw new FulfillmentError(400, "VALIDATION_ERROR", "Evidence file size is invalid", { files: "แต่ละรูปต้องมีขนาดไม่เกิน 5 MB" });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = extensionFor(bytes, file.type);
      if (!ext) throw new FulfillmentError(400, "VALIDATION_ERROR", "Evidence image content is invalid", { files: "รองรับเฉพาะ JPEG, PNG และ WebP ที่เป็นไฟล์รูปจริง" });
      const key = `rental-handover/${rentalId}/${eventType.toLowerCase()}/${actorId}/${randomUUID()}.${ext}`;
      await putObject({ key, bytes, contentType: file.type });
      uploaded.push(key);
    }
    return uploaded;
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => deleteObject(key)));
    throw error;
  }
}

async function prepareReturnFinances(client: PoolClient, rental: RentalRow): Promise<void> {
  const open = await client.query(`SELECT 1 FROM disputes WHERE rental_request_id = $1 AND status IN ('OPEN','UNDER_REVIEW') LIMIT 1`, [rental.id]);
  if (open.rowCount) return;

  const depositResult = await client.query<DepositRow>(
    `SELECT d.id, d.amount, d.status::text AS status, d.payment_id,
            p.provider AS payment_provider, p.provider_reference AS payment_reference, p.metadata AS payment_metadata
     FROM deposits d LEFT JOIN payments p ON p.id = d.payment_id
     WHERE d.rental_request_id = $1 LIMIT 1 FOR UPDATE OF d`, [rental.id]);
  const deposit = depositResult.rows[0] ?? null;
  if (deposit && deposit.status === "HELD" && deposit.payment_id) {
    if (deposit.payment_provider === "SANDBOX") {
      await client.query(
        `INSERT INTO payments (rental_request_id, original_payment_id, payer_id, type, provider, provider_reference, idempotency_key, amount, currency, status, metadata, succeeded_at)
         SELECT r.id, $2, r.borrower_id, 'REFUND', 'SANDBOX', $3, $4, $5, r.currency, 'SUCCEEDED', $6::jsonb, now()
         FROM rental_requests r WHERE r.id = $1
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [rental.id, deposit.payment_id, `sandbox-return-refund-${rental.id}`, `clean-return-deposit:${rental.id}:v1`, deposit.amount, JSON.stringify({ reason: "CLEAN_RETURN", source: "TASK16_AUTOMATIC_RESOLUTION" })],
      );
      await client.query(`UPDATE deposits SET status = 'REFUNDED', refunded_at = COALESCE(refunded_at, now()), updated_at = now() WHERE id = $1 AND status = 'HELD'`, [deposit.id]);
      await createNotification(client, {
        userId: rental.borrower_id, type: "DEPOSIT_REFUNDED", title: "คืนเงินประกันแล้ว",
        body: `${rental.item_title}: ระบบ Sandbox ยืนยันการคืนเงินประกัน ฿${deposit.amount} แล้ว`,
        relatedEntityType: "RENTAL_REQUEST", relatedEntityId: rental.id, idempotent: true,
      });
    } else {
      await client.query(
        `UPDATE payments SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{depositResolution}', $2::jsonb, true), updated_at = now() WHERE id = $1`,
        [deposit.payment_id, JSON.stringify({ status: "MANUAL_REFUND_REQUIRED", reason: "PromptPay/manual rail requires operational refund confirmation", requestedAt: new Date().toISOString() })],
      );
      await createNotification(client, {
        userId: rental.borrower_id, type: "DEPOSIT_REFUND_REQUIRED", title: "กำลังดำเนินการคืนเงินประกัน",
        body: `${rental.item_title}: คืนของเรียบร้อยแล้ว เงินประกันยังถูกถือไว้จนกว่าฝ่ายปฏิบัติการจะยืนยันการคืนเงินจริง`,
        relatedEntityType: "RENTAL_REQUEST", relatedEntityId: rental.id, idempotent: true,
      });
    }
  }

  if (!rental.is_urgent) {
    const paymentResult = await client.query<SettlementRow>(
      `SELECT id AS payment_id, metadata FROM payments
       WHERE rental_request_id = $1 AND type = 'RENTAL' AND status = 'SUCCEEDED' AND metadata ? 'settlement'
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [rental.id]);
    const payment = paymentResult.rows[0];
    if (payment) {
      const settlement = settlementObject(payment.metadata);
      const next = {
        ...settlement,
        status: settlement.status === "PAID_OUT" ? "PAID_OUT" : "READY_FOR_PAYOUT",
        payoutMode: settlement.payoutMode ?? "MANUAL_REQUIRED",
        releaseReason: "RETURN_CONFIRMED_NO_OPEN_DISPUTE",
        readyAt: new Date().toISOString(),
      };
      await client.query(`UPDATE payments SET metadata = jsonb_set(metadata, '{settlement}', $2::jsonb, true), updated_at = now() WHERE id = $1`, [payment.payment_id, JSON.stringify(next)]);
      await createNotification(client, {
        userId: rental.lender_id, type: "SETTLEMENT_READY", title: "ยอดค่าเช่าพร้อมสำหรับ settlement",
        body: `${rental.item_title}: คืนของครบแล้ว ยอดผู้ให้ยืมถูกปลดล็อกเป็น READY_FOR_PAYOUT โดยยังไม่มีการอ้างว่าโอนธนาคารสำเร็จ`,
        relatedEntityType: "RENTAL_REQUEST", relatedEntityId: rental.id, idempotent: true,
      });
    }
  }
}

async function tryCompleteRental(client: PoolClient, rental: RentalRow): Promise<void> {
  if (rental.status !== "RETURNED") return;
  const dispute = await client.query(`SELECT 1 FROM disputes WHERE rental_request_id = $1 AND status IN ('OPEN','UNDER_REVIEW') LIMIT 1`, [rental.id]);
  if (dispute.rowCount) return;
  const depositResolved = Number(rental.deposit_amount) <= 0 || Boolean((await client.query(
    `SELECT 1 FROM deposits WHERE rental_request_id = $1 AND status IN ('REFUNDED','RELEASED') LIMIT 1`, [rental.id])).rowCount);
  if (!depositResolved) return;
  let settlementSafe = rental.is_urgent;
  if (!settlementSafe) {
    const result = await client.query<{ status: string | null } & QueryResultRow>(
      `SELECT metadata #>> '{settlement,status}' AS status FROM payments
       WHERE rental_request_id = $1 AND type = 'RENTAL' AND status = 'SUCCEEDED' AND metadata ? 'settlement'
       ORDER BY created_at DESC LIMIT 1`, [rental.id]);
    settlementSafe = ["READY_FOR_PAYOUT", "PAID_OUT"].includes(result.rows[0]?.status ?? "");
  }
  if (!settlementSafe) return;
  await client.query(`UPDATE rental_requests SET status = 'COMPLETED', completed_at = COALESCE(completed_at, now()), updated_at = now() WHERE id = $1 AND status = 'RETURNED'`, [rental.id]);
  rental.status = "COMPLETED";
  await notifyParticipants(client, rental, "RENTAL_COMPLETED", "รายการยืมเสร็จสมบูรณ์", `${rental.item_title}: การรับ-คืนและการจัดการเงินที่จำเป็นเสร็จตามเงื่อนไขแล้ว`);
}

export async function confirmHandover(
  actor: AuthUser,
  rentalIdInput: unknown,
  eventTypeInput: unknown,
  conditionNotesInput: unknown,
  files: File[] = [],
): Promise<RentalFulfillmentSummary> {
  const rentalId = requireUuid(rentalIdInput);
  const eventType = String(eventTypeInput ?? "").trim().toUpperCase();
  if (eventType !== "PICKUP" && eventType !== "RETURN") throw new FulfillmentError(400, "VALIDATION_ERROR", "eventType must be PICKUP or RETURN");
  const notes = normalizeNotes(conditionNotesInput);

  const preflight = await withTransaction(async (client) => {
    const rental = await loadRental(client, rentalId);
    assertDirectParticipant(actor, rental);
    const existing = await client.query(`SELECT 1 FROM rental_handover_events WHERE rental_request_id = $1 AND event_type = $2 AND confirmed_by = $3 LIMIT 1`, [rental.id, eventType, actor.id]);
    return { rental, alreadyConfirmed: Boolean(existing.rowCount) };
  });
  if (preflight.alreadyConfirmed) return getRentalFulfillment(actor, rentalId);
  if (eventType === "PICKUP" && preflight.rental.status !== "WAITING_PICKUP") throw new FulfillmentError(409, "HANDOVER_NOT_CONFIRMABLE", "Pickup can only be confirmed while waiting for pickup");
  if (eventType === "RETURN" && !["RENTING", "RETURNING"].includes(preflight.rental.status)) throw new FulfillmentError(409, "HANDOVER_NOT_CONFIRMABLE", "Return can only be confirmed during an active rental");

  const uploaded = await uploadEvidence(rentalId, eventType, actor.id, files);
  try {
    return await withTransaction(async (client) => {
      const rental = await loadRental(client, rentalId, true);
      assertDirectParticipant(actor, rental);
      const allowed = eventType === "PICKUP" ? rental.status === "WAITING_PICKUP" : ["RENTING", "RETURNING"].includes(rental.status);
      if (!allowed) throw new FulfillmentError(409, "HANDOVER_NOT_CONFIRMABLE", "Rental status changed before confirmation");
      if (eventType === "RETURN" && rental.status === "RENTING") {
        await client.query(`UPDATE rental_requests SET status = 'RETURNING', updated_at = now() WHERE id = $1 AND status = 'RENTING'`, [rental.id]);
        rental.status = "RETURNING";
        await notifyParticipants(client, rental, "RETURN_REQUESTED", "เริ่มขั้นตอนคืนของ", `${rental.item_title}: มีการเริ่มยืนยันการคืนของแล้ว`);
      }
      const insert = await client.query<{ id: string } & QueryResultRow>(
        `INSERT INTO rental_handover_events (rental_request_id, event_type, confirmed_by, condition_notes, evidence_storage_keys)
         VALUES ($1, $2, $3, $4, $5::text[])
         ON CONFLICT (rental_request_id, event_type, confirmed_by) DO NOTHING RETURNING id`,
        [rental.id, eventType, actor.id, notes, uploaded],
      );
      if (!insert.rowCount) {
        await Promise.allSettled(uploaded.map((key) => deleteObject(key)));
        return getSummaryWithClient(client, actor, rental.id);
      }
      const confirmations = await client.query<{ count: string } & QueryResultRow>(
        `SELECT count(DISTINCT confirmed_by)::text AS count FROM rental_handover_events WHERE rental_request_id = $1 AND event_type = $2`, [rental.id, eventType]);
      if (Number(confirmations.rows[0]?.count ?? 0) >= 2) {
        if (eventType === "PICKUP" && rental.status === "WAITING_PICKUP") {
          await client.query(`UPDATE rental_requests SET status = 'RENTING', updated_at = now() WHERE id = $1 AND status = 'WAITING_PICKUP'`, [rental.id]);
          rental.status = "RENTING";
          await notifyParticipants(client, rental, "RENTAL_STARTED", "เริ่มการยืมแล้ว", `${rental.item_title}: ทั้งสองฝ่ายยืนยันการส่งมอบแล้ว`);
        }
        if (eventType === "RETURN" && rental.status === "RETURNING") {
          await client.query(`UPDATE rental_requests SET status = 'RETURNED', updated_at = now() WHERE id = $1 AND status = 'RETURNING'`, [rental.id]);
          rental.status = "RETURNED";
          await notifyParticipants(client, rental, "RETURN_CONFIRMED", "ยืนยันคืนของครบแล้ว", `${rental.item_title}: ทั้งสองฝ่ายยืนยันการคืนของแล้ว`);
          await prepareReturnFinances(client, rental);
          await tryCompleteRental(client, rental);
        }
      }
      return getSummaryWithClient(client, actor, rental.id);
    });
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => deleteObject(key)));
    throw error;
  }
}

export async function getHandoverEvidence(
  actor: AuthUser,
  rentalIdInput: unknown,
  eventIdInput: unknown,
  indexInput: unknown,
): Promise<Response> {
  const rentalId = requireUuid(rentalIdInput);
  const eventId = requireUuid(eventIdInput, "eventId");
  const index = Number(indexInput);
  if (!Number.isInteger(index) || index < 0 || index >= MAX_EVIDENCE_FILES) throw new FulfillmentError(400, "VALIDATION_ERROR", "Evidence index is invalid");
  const result = await query<RentalRow & { evidence_storage_keys: string[] }>(
    `SELECT r.id, r.item_id, i.title AS item_title, i.condition::text AS item_condition, i.province, i.district, i.subdistrict, i.location_label,
            r.borrower_id, borrower.display_name AS borrower_name, r.lender_id, lender.display_name AS lender_name,
            r.pricing_mode, r.starts_at, r.ends_at, r.unit_rate, r.duration_units, r.rental_amount, r.deposit_amount,
            r.platform_fee_amount, r.urgent_reservation_fee_amount, r.currency, r.is_urgent, r.status::text AS status, r.completed_at,
            h.evidence_storage_keys
     FROM rental_requests r JOIN rental_items i ON i.id=r.item_id JOIN users borrower ON borrower.id=r.borrower_id JOIN users lender ON lender.id=r.lender_id
     JOIN rental_handover_events h ON h.rental_request_id=r.id
     WHERE r.id=$1 AND h.id=$2 LIMIT 1`, [rentalId, eventId]);
  const row = result.rows[0];
  if (!row) throw new FulfillmentError(404, "EVIDENCE_NOT_FOUND", "Evidence not found");
  assertParticipant(actor, row, true);
  const key = row.evidence_storage_keys[index];
  if (!key) throw new FulfillmentError(404, "EVIDENCE_NOT_FOUND", "Evidence not found");
  return getObject(key);
}

export async function confirmManualDepositRefund(
  admin: AuthUser,
  rentalIdInput: unknown,
  providerReferenceInput: unknown,
  notesInput: unknown,
): Promise<RentalFulfillmentSummary> {
  if (!isAdmin(admin)) throw new FulfillmentError(403, "FORBIDDEN", "Administrator access required");
  const rentalId = requireUuid(rentalIdInput);
  const providerReference = String(providerReferenceInput ?? "").trim();
  const notes = String(notesInput ?? "").trim();
  if (providerReference.length < 4 || providerReference.length > 120) throw new FulfillmentError(400, "VALIDATION_ERROR", "A real refund reference is required", { providerReference: "กรุณาระบุเลขอ้างอิงการคืนเงินจริง" });
  if (notes.length < 8 || notes.length > 1000) throw new FulfillmentError(400, "VALIDATION_ERROR", "Refund notes are required", { notes: "กรุณาระบุรายละเอียดการคืนเงินจริง" });
  return withTransaction(async (client) => {
    const rental = await loadRental(client, rentalId, true);
    if (rental.status !== "RETURNED") throw new FulfillmentError(409, "REFUND_NOT_CONFIRMABLE", "Manual deposit refund can only be reconciled after return");
    const depositResult = await client.query<DepositRow>(
      `SELECT d.id, d.amount, d.status::text AS status, d.payment_id, p.provider AS payment_provider,
              p.provider_reference AS payment_reference, p.metadata AS payment_metadata
       FROM deposits d JOIN payments p ON p.id=d.payment_id WHERE d.rental_request_id=$1 LIMIT 1 FOR UPDATE OF d`, [rental.id]);
    const deposit = depositResult.rows[0];
    if (!deposit || !deposit.payment_id) throw new FulfillmentError(404, "DEPOSIT_NOT_FOUND", "Deposit payment not found");
    if (deposit.status === "REFUNDED") return getSummaryWithClient(client, admin, rental.id);
    if (deposit.status !== "HELD") throw new FulfillmentError(409, "REFUND_NOT_CONFIRMABLE", "Deposit is not currently held");
    await client.query(
      `INSERT INTO payments (rental_request_id, original_payment_id, payer_id, type, provider, provider_reference, idempotency_key, amount, currency, status, metadata, succeeded_at)
       VALUES ($1,$2,$3,'REFUND','MANUAL_BANK',$4,$5,$6,$7,'SUCCEEDED',$8::jsonb,now())
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [rental.id, deposit.payment_id, rental.borrower_id, providerReference, `manual-deposit-refund:${rental.id}:v1`, deposit.amount, rental.currency, JSON.stringify({ notes, confirmedByAdminId: admin.id, sourceProvider: deposit.payment_provider })],
    );
    await client.query(`UPDATE deposits SET status='REFUNDED', refunded_at=COALESCE(refunded_at,now()), updated_at=now() WHERE id=$1 AND status='HELD'`, [deposit.id]);
    await client.query(
      `UPDATE payments SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{depositResolution}',$2::jsonb,true), updated_at=now() WHERE id=$1`,
      [deposit.payment_id, JSON.stringify({ status: "REFUNDED_MANUALLY", providerReference, notes, confirmedAt: new Date().toISOString(), confirmedByAdminId: admin.id })],
    );
    await client.query(
      `INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, details)
       VALUES ($1,'CONFIRM_MANUAL_DEPOSIT_REFUND','RENTAL_REQUEST',$2,$3::jsonb)`,
      [admin.id, rental.id, JSON.stringify({ providerReference, amount: deposit.amount, notes })],
    );
    await createNotification(client, {
      userId: rental.borrower_id, type: "DEPOSIT_REFUNDED", title: "ยืนยันการคืนเงินประกันแล้ว",
      body: `${rental.item_title}: ฝ่ายปฏิบัติการยืนยันการคืนเงินประกัน ฿${deposit.amount} แล้ว อ้างอิง ${providerReference}`,
      relatedEntityType: "RENTAL_REQUEST", relatedEntityId: rental.id, idempotent: true,
    });
    await tryCompleteRental(client, rental);
    return getSummaryWithClient(client, admin, rental.id);
  });
}

export async function listRentalsForAdmin(): Promise<Array<{ id: string; itemTitle: string; borrowerName: string; lenderName: string; status: string; rentalAmount: string; depositAmount: string; startsAt: string; endsAt: string }>> {
  const result = await query<QueryResultRow & { id: string; item_title: string; borrower_name: string; lender_name: string; status: string; rental_amount: string; deposit_amount: string; starts_at: Date; ends_at: Date }>(
    `SELECT r.id, i.title AS item_title, borrower.display_name AS borrower_name, lender.display_name AS lender_name,
            r.status::text AS status, r.rental_amount, r.deposit_amount, r.starts_at, r.ends_at
     FROM rental_requests r JOIN rental_items i ON i.id=r.item_id JOIN users borrower ON borrower.id=r.borrower_id JOIN users lender ON lender.id=r.lender_id
     ORDER BY r.created_at DESC LIMIT 250`,
  );
  return result.rows.map((row) => ({ id: row.id, itemTitle: row.item_title, borrowerName: row.borrower_name, lenderName: row.lender_name, status: row.status, rentalAmount: row.rental_amount, depositAmount: row.deposit_amount, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString() }));
}
