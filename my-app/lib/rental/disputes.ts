import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { AuthUser } from "@/lib/auth/session";
import { query, withTransaction } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";
import { deleteObject, getObject, putObject } from "@/lib/storage/s3";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPENABLE_RENTAL_STATUSES = ["PAID", "WAITING_PICKUP", "RENTING", "RETURNING", "RETURNED"] as const;
const MAX_EVIDENCE_FILES = 6;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
export type DisputeResolution = "NO_FAULT" | "REFUND_DEPOSIT_FULL" | "FORFEIT_DEPOSIT_FULL" | "PARTIAL_DEPOSIT_REFUND" | "REJECT_DISPUTE";

export class DisputeError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "DisputeError";
  }
}

type RentalRow = QueryResultRow & {
  id: string;
  item_title: string;
  borrower_id: string;
  borrower_name: string;
  lender_id: string;
  lender_name: string;
  status: string;
  deposit_amount: string;
  currency: string;
  is_urgent: boolean;
};

type DisputeRow = QueryResultRow & {
  id: string;
  rental_request_id: string;
  item_title: string;
  borrower_id: string;
  borrower_name: string;
  lender_id: string;
  lender_name: string;
  opened_by: string;
  opened_by_name: string;
  reason: string;
  details: string | null;
  status: DisputeStatus;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolution_notes: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
};

type EvidenceRow = QueryResultRow & {
  id: string;
  submitted_by: string;
  submitted_by_name: string;
  storage_key: string;
  description: string | null;
  created_at: Date;
};

type DepositRow = QueryResultRow & {
  id: string;
  payment_id: string | null;
  amount: string;
  status: string;
  payment_provider: string | null;
};

type SettlementRow = QueryResultRow & {
  payment_id: string;
  metadata: Record<string, unknown>;
};

export type DisputeSummary = {
  id: string;
  rentalRequestId: string;
  itemTitle: string;
  borrower: { id: string; displayName: string };
  lender: { id: string; displayName: string };
  openedBy: { id: string; displayName: string };
  reason: string;
  details: string | null;
  status: DisputeStatus;
  resolvedBy: null | { id: string; displayName: string };
  resolutionNotes: string | null;
  evidence: Array<{
    id: string;
    submittedBy: { id: string; displayName: string };
    description: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type AdminDisputeDetail = DisputeSummary & {
  rentalStatus: string;
  previousRentalStatus: string | null;
  deposit: null | { amount: string; status: string; provider: string | null };
  settlement: null | { status: string; payoutAmount: string | null; payoutMode: string | null };
};

function requireUuid(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) throw new DisputeError(400, "VALIDATION_ERROR", "Invalid identifier", { [field]: "รหัสไม่ถูกต้อง" });
  return text;
}

function isAdmin(user: AuthUser): boolean {
  return user.role === "ADMIN" || user.role === "SUPERADMIN";
}

function assertParticipant(actor: AuthUser, rental: RentalRow, allowAdmin = false): void {
  if (actor.id === rental.borrower_id || actor.id === rental.lender_id) return;
  if (allowAdmin && isAdmin(actor)) return;
  throw new DisputeError(403, "FORBIDDEN", "You are not a participant in this rental");
}

async function loadRental(client: PoolClient, rentalRequestId: string, lock = false): Promise<RentalRow> {
  const result = await client.query<RentalRow>(
    `SELECT r.id, i.title AS item_title, r.borrower_id, borrower.display_name AS borrower_name,
            r.lender_id, lender.display_name AS lender_name, r.status::text AS status,
            r.deposit_amount, r.currency, r.is_urgent
     FROM rental_requests r
     JOIN rental_items i ON i.id=r.item_id
     JOIN users borrower ON borrower.id=r.borrower_id
     JOIN users lender ON lender.id=r.lender_id
     WHERE r.id=$1 LIMIT 1${lock ? " FOR UPDATE OF r" : ""}`,
    [rentalRequestId],
  );
  const rental = result.rows[0];
  if (!rental) throw new DisputeError(404, "RENTAL_NOT_FOUND", "Rental not found");
  return rental;
}

async function loadDisputeRow(client: PoolClient, disputeId: string, lock = false): Promise<DisputeRow> {
  const result = await client.query<DisputeRow>(
    `SELECT d.id, d.rental_request_id, i.title AS item_title,
            r.borrower_id, borrower.display_name AS borrower_name,
            r.lender_id, lender.display_name AS lender_name,
            d.opened_by, opener.display_name AS opened_by_name,
            d.reason, d.details, d.status::text AS status,
            d.resolved_by, resolver.display_name AS resolved_by_name,
            d.resolution_notes, d.created_at, d.updated_at, d.resolved_at
     FROM disputes d
     JOIN rental_requests r ON r.id=d.rental_request_id
     JOIN rental_items i ON i.id=r.item_id
     JOIN users borrower ON borrower.id=r.borrower_id
     JOIN users lender ON lender.id=r.lender_id
     JOIN users opener ON opener.id=d.opened_by
     LEFT JOIN users resolver ON resolver.id=d.resolved_by
     WHERE d.id=$1 LIMIT 1${lock ? " FOR UPDATE OF d" : ""}`,
    [disputeId],
  );
  const row = result.rows[0];
  if (!row) throw new DisputeError(404, "DISPUTE_NOT_FOUND", "Dispute not found");
  return row;
}

async function evidenceForDispute(client: PoolClient, disputeId: string): Promise<EvidenceRow[]> {
  const result = await client.query<EvidenceRow>(
    `SELECT e.id, e.submitted_by, u.display_name AS submitted_by_name, e.storage_key, e.description, e.created_at
     FROM dispute_evidence e JOIN users u ON u.id=e.submitted_by
     WHERE e.dispute_id=$1 ORDER BY e.created_at ASC, e.id ASC`,
    [disputeId],
  );
  return result.rows;
}

function mapDispute(row: DisputeRow, evidence: EvidenceRow[]): DisputeSummary {
  return {
    id: row.id,
    rentalRequestId: row.rental_request_id,
    itemTitle: row.item_title,
    borrower: { id: row.borrower_id, displayName: row.borrower_name },
    lender: { id: row.lender_id, displayName: row.lender_name },
    openedBy: { id: row.opened_by, displayName: row.opened_by_name },
    reason: row.reason,
    details: row.details,
    status: row.status,
    resolvedBy: row.resolved_by && row.resolved_by_name ? { id: row.resolved_by, displayName: row.resolved_by_name } : null,
    resolutionNotes: row.resolution_notes,
    evidence: evidence.map((item) => ({
      id: item.id,
      submittedBy: { id: item.submitted_by, displayName: item.submitted_by_name },
      description: item.description,
      createdAt: item.created_at.toISOString(),
    })),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
  };
}

function validateReason(value: unknown): string {
  const text = String(value ?? "").trim();
  if (text.length < 3 || text.length > 120) throw new DisputeError(400, "VALIDATION_ERROR", "Dispute reason is invalid", { reason: "สาเหตุต้องมี 3–120 ตัวอักษร" });
  return text;
}

function validateDetails(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > 3000) throw new DisputeError(400, "VALIDATION_ERROR", "Dispute details are too long", { details: "รายละเอียดต้องไม่เกิน 3,000 ตัวอักษร" });
  return text;
}

function extensionFor(bytes: Uint8Array, mime: string): string | null {
  if (mime === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (mime === "image/png" && bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
  if (mime === "image/webp" && bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

async function uploadEvidenceFiles(disputeId: string, userId: string, files: File[]): Promise<string[]> {
  if (files.length > MAX_EVIDENCE_FILES) throw new DisputeError(400, "VALIDATION_ERROR", "Too many evidence files", { files: `แนบได้สูงสุด ${MAX_EVIDENCE_FILES} รูปต่อครั้ง` });
  const uploaded: string[] = [];
  try {
    for (const file of files) {
      if (file.size <= 0 || file.size > MAX_EVIDENCE_BYTES) throw new DisputeError(400, "VALIDATION_ERROR", "Evidence file is too large", { files: "แต่ละรูปต้องไม่เกิน 5 MB" });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = extensionFor(bytes, file.type);
      if (!ext) throw new DisputeError(400, "VALIDATION_ERROR", "Evidence image is invalid", { files: "รองรับ JPEG, PNG และ WebP ที่เป็นไฟล์รูปจริง" });
      const key = `disputes/${disputeId}/${userId}/${randomUUID()}.${ext}`;
      await putObject({ key, bytes, contentType: file.type });
      uploaded.push(key);
    }
    return uploaded;
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => deleteObject(key)));
    throw error;
  }
}

function settlementObject(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const value = metadata?.settlement;
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function settlementForRental(client: PoolClient, rentalRequestId: string, lock = false): Promise<SettlementRow | null> {
  const result = await client.query<SettlementRow>(
    `SELECT id AS payment_id, metadata FROM payments
     WHERE rental_request_id=$1 AND type='RENTAL' AND status='SUCCEEDED' AND metadata ? 'settlement'
     ORDER BY created_at DESC LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [rentalRequestId],
  );
  return result.rows[0] ?? null;
}

async function freezeSettlement(client: PoolClient, rental: RentalRow, disputeId: string): Promise<void> {
  const payment = await settlementForRental(client, rental.id, true);
  if (!payment) return;
  const settlement = settlementObject(payment.metadata);
  const before = typeof settlement.status === "string" ? settlement.status : "PLATFORM_HELD";
  const next = {
    ...settlement,
    statusBeforeDispute: before === "DISPUTE_HELD" ? settlement.statusBeforeDispute ?? "PLATFORM_HELD" : before,
    status: "DISPUTE_HELD",
    disputeId,
    disputeHeldAt: new Date().toISOString(),
  };
  await client.query(`UPDATE payments SET metadata=jsonb_set(metadata,'{settlement}',$2::jsonb,true), updated_at=now() WHERE id=$1`, [payment.payment_id, JSON.stringify(next)]);
}

async function notifyAdmins(client: PoolClient, type: string, title: string, body: string, disputeId: string): Promise<void> {
  const admins = await client.query<{ id: string } & QueryResultRow>(`SELECT id FROM users WHERE role IN ('ADMIN','SUPERADMIN') AND is_active=true`);
  for (const admin of admins.rows) {
    await createNotification(client, { userId: admin.id, type, title, body, relatedEntityType: "DISPUTE", relatedEntityId: disputeId, idempotent: true });
  }
}

export async function openDispute(
  actor: AuthUser,
  input: { rentalRequestId?: unknown; reason?: unknown; details?: unknown; files?: File[] },
): Promise<DisputeSummary> {
  const rentalRequestId = requireUuid(input.rentalRequestId, "rentalRequestId");
  const reason = validateReason(input.reason);
  const details = validateDetails(input.details);
  const files = input.files ?? [];
  const disputeId = randomUUID();

  const preflight = await withTransaction(async (client) => {
    const rental = await loadRental(client, rentalRequestId);
    assertParticipant(actor, rental);
    if (!OPENABLE_RENTAL_STATUSES.includes(rental.status as (typeof OPENABLE_RENTAL_STATUSES)[number])) {
      throw new DisputeError(409, "DISPUTE_NOT_ALLOWED", "This rental cannot enter dispute in its current state");
    }
    const active = await client.query(`SELECT 1 FROM disputes WHERE rental_request_id=$1 AND status IN ('OPEN','UNDER_REVIEW') LIMIT 1`, [rental.id]);
    if (active.rowCount) throw new DisputeError(409, "DISPUTE_ALREADY_OPEN", "This rental already has an active dispute");
    return rental;
  });

  const uploaded = await uploadEvidenceFiles(disputeId, actor.id, files);
  try {
    return await withTransaction(async (client) => {
      const rental = await loadRental(client, preflight.id, true);
      assertParticipant(actor, rental);
      if (!OPENABLE_RENTAL_STATUSES.includes(rental.status as (typeof OPENABLE_RENTAL_STATUSES)[number])) throw new DisputeError(409, "DISPUTE_NOT_ALLOWED", "Rental state changed before dispute creation");
      const active = await client.query(`SELECT 1 FROM disputes WHERE rental_request_id=$1 AND status IN ('OPEN','UNDER_REVIEW') LIMIT 1`, [rental.id]);
      if (active.rowCount) throw new DisputeError(409, "DISPUTE_ALREADY_OPEN", "This rental already has an active dispute");
      const settlement = await settlementForRental(client, rental.id, true);
      const settlementStatus = settlement ? String(settlementObject(settlement.metadata).status ?? "PLATFORM_HELD") : null;
      await client.query(
        `INSERT INTO disputes (id,rental_request_id,opened_by,reason,details,status) VALUES ($1,$2,$3,$4,$5,'OPEN')`,
        [disputeId, rental.id, actor.id, reason, details],
      );
      for (const key of uploaded) {
        await client.query(`INSERT INTO dispute_evidence (dispute_id,submitted_by,storage_key,description) VALUES ($1,$2,$3,$4)`, [disputeId, actor.id, key, details ? details.slice(0, 500) : null]);
      }
      await client.query(
        `INSERT INTO admin_audit_logs (actor_user_id,action,target_type,target_id,details)
         VALUES ($1,'DISPUTE_OPENED_SNAPSHOT','DISPUTE',$2,$3::jsonb)`,
        [actor.id, disputeId, JSON.stringify({ previousRentalStatus: rental.status, settlementStatusBeforeDispute: settlementStatus })],
      );
      await freezeSettlement(client, rental, disputeId);
      await client.query(`UPDATE rental_requests SET status='DISPUTED', updated_at=now() WHERE id=$1`, [rental.id]);
      const otherUserId = actor.id === rental.borrower_id ? rental.lender_id : rental.borrower_id;
      await createNotification(client, {
        userId: otherUserId, type: "DISPUTE_OPENED", title: "มีการเปิดข้อพิพาท",
        body: `${rental.item_title}: ${actor.displayName} เปิดข้อพิพาท “${reason}” ระบบระงับ completion/settlement จนกว่าจะมีผลตรวจสอบ`,
        relatedEntityType: "DISPUTE", relatedEntityId: disputeId, idempotent: true,
      });
      await notifyAdmins(client, "ADMIN_DISPUTE_OPENED", "มีข้อพิพาทใหม่", `${rental.item_title}: ${reason}`, disputeId);
      const row = await loadDisputeRow(client, disputeId);
      return mapDispute(row, await evidenceForDispute(client, disputeId));
    });
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => deleteObject(key)));
    throw error;
  }
}

export async function addDisputeEvidence(
  actor: AuthUser,
  disputeIdInput: unknown,
  descriptionInput: unknown,
  files: File[],
): Promise<DisputeSummary> {
  const disputeId = requireUuid(disputeIdInput, "disputeId");
  const description = validateDetails(descriptionInput);
  if (files.length === 0) throw new DisputeError(400, "VALIDATION_ERROR", "At least one evidence file is required", { files: "กรุณาแนบรูปหลักฐาน" });
  const preflight = await withTransaction(async (client) => {
    const dispute = await loadDisputeRow(client, disputeId);
    const rental = await loadRental(client, dispute.rental_request_id);
    assertParticipant(actor, rental);
    if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) throw new DisputeError(409, "EVIDENCE_CLOSED", "Evidence can only be added to an active dispute");
    return dispute;
  });
  const uploaded = await uploadEvidenceFiles(disputeId, actor.id, files);
  try {
    return await withTransaction(async (client) => {
      const dispute = await loadDisputeRow(client, preflight.id, true);
      const rental = await loadRental(client, dispute.rental_request_id);
      assertParticipant(actor, rental);
      if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) throw new DisputeError(409, "EVIDENCE_CLOSED", "Dispute was closed before evidence upload completed");
      for (const key of uploaded) {
        await client.query(`INSERT INTO dispute_evidence (dispute_id,submitted_by,storage_key,description) VALUES ($1,$2,$3,$4)`, [dispute.id, actor.id, key, description]);
      }
      const row = await loadDisputeRow(client, dispute.id);
      return mapDispute(row, await evidenceForDispute(client, dispute.id));
    });
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => deleteObject(key)));
    throw error;
  }
}

export async function getDispute(actor: AuthUser, disputeIdInput: unknown): Promise<DisputeSummary> {
  const disputeId = requireUuid(disputeIdInput, "disputeId");
  return withTransaction(async (client) => {
    const dispute = await loadDisputeRow(client, disputeId);
    const rental = await loadRental(client, dispute.rental_request_id);
    assertParticipant(actor, rental, true);
    return mapDispute(dispute, await evidenceForDispute(client, dispute.id));
  });
}

export async function listDisputesForUser(actor: AuthUser): Promise<DisputeSummary[]> {
  const result = await query<{ id: string } & QueryResultRow>(
    `SELECT d.id FROM disputes d JOIN rental_requests r ON r.id=d.rental_request_id
     WHERE r.borrower_id=$1 OR r.lender_id=$1 ORDER BY d.created_at DESC LIMIT 100`, [actor.id]);
  const items: DisputeSummary[] = [];
  for (const row of result.rows) items.push(await getDispute(actor, row.id));
  return items;
}

export async function getDisputeEvidence(actor: AuthUser, disputeIdInput: unknown, evidenceIdInput: unknown): Promise<Response> {
  const disputeId = requireUuid(disputeIdInput, "disputeId");
  const evidenceId = requireUuid(evidenceIdInput, "evidenceId");
  const result = await query<RentalRow & { storage_key: string }>(
    `SELECT r.id, i.title AS item_title, r.borrower_id, borrower.display_name AS borrower_name,
            r.lender_id, lender.display_name AS lender_name, r.status::text AS status, r.deposit_amount, r.currency, r.is_urgent,
            e.storage_key
     FROM dispute_evidence e JOIN disputes d ON d.id=e.dispute_id JOIN rental_requests r ON r.id=d.rental_request_id
     JOIN rental_items i ON i.id=r.item_id JOIN users borrower ON borrower.id=r.borrower_id JOIN users lender ON lender.id=r.lender_id
     WHERE d.id=$1 AND e.id=$2 LIMIT 1`, [disputeId, evidenceId]);
  const row = result.rows[0];
  if (!row) throw new DisputeError(404, "EVIDENCE_NOT_FOUND", "Evidence not found");
  assertParticipant(actor, row, true);
  return getObject(row.storage_key);
}

async function previousRentalStatus(client: PoolClient, disputeId: string): Promise<string> {
  const result = await client.query<{ details: Record<string, unknown> } & QueryResultRow>(
    `SELECT details FROM admin_audit_logs WHERE action='DISPUTE_OPENED_SNAPSHOT' AND target_type='DISPUTE' AND target_id=$1 ORDER BY created_at ASC LIMIT 1`, [disputeId]);
  const value = result.rows[0]?.details?.previousRentalStatus;
  if (typeof value !== "string" || !OPENABLE_RENTAL_STATUSES.includes(value as (typeof OPENABLE_RENTAL_STATUSES)[number])) {
    throw new DisputeError(409, "DISPUTE_SNAPSHOT_MISSING", "Dispute lifecycle snapshot is missing or invalid");
  }
  return value;
}

async function loadDeposit(client: PoolClient, rentalRequestId: string): Promise<DepositRow | null> {
  const result = await client.query<DepositRow>(
    `SELECT d.id,d.payment_id,d.amount,d.status::text AS status,p.provider AS payment_provider
     FROM deposits d LEFT JOIN payments p ON p.id=d.payment_id
     WHERE d.rental_request_id=$1 LIMIT 1 FOR UPDATE OF d`, [rentalRequestId]);
  return result.rows[0] ?? null;
}

function minor(value: string | number): number {
  return Math.round(Number(value) * 100);
}

function moneyFromMinor(value: number): string {
  return (value / 100).toFixed(2);
}

function validateResolution(value: unknown): DisputeResolution {
  const resolution = String(value ?? "").trim().toUpperCase();
  const allowed: DisputeResolution[] = ["NO_FAULT", "REFUND_DEPOSIT_FULL", "FORFEIT_DEPOSIT_FULL", "PARTIAL_DEPOSIT_REFUND", "REJECT_DISPUTE"];
  if (!allowed.includes(resolution as DisputeResolution)) throw new DisputeError(400, "VALIDATION_ERROR", "Resolution is invalid", { resolution: "resolution ไม่ถูกต้อง" });
  return resolution as DisputeResolution;
}

function validateResolutionNotes(value: unknown): string {
  const notes = String(value ?? "").trim();
  if (notes.length < 8 || notes.length > 2000) throw new DisputeError(400, "VALIDATION_ERROR", "Resolution notes are required", { notes: "กรุณาระบุเหตุผลการตัดสินอย่างน้อย 8 ตัวอักษร และไม่เกิน 2,000" });
  return notes;
}

async function createRefund(
  client: PoolClient,
  rental: RentalRow,
  deposit: DepositRow,
  amountMinor: number,
  manualReference: string | null,
  admin: AuthUser,
  resolution: DisputeResolution,
): Promise<void> {
  if (amountMinor <= 0 || !deposit.payment_id) return;
  const amount = moneyFromMinor(amountMinor);
  const provider = deposit.payment_provider ?? "UNKNOWN";
  if (provider !== "SANDBOX" && !manualReference) {
    throw new DisputeError(409, "MANUAL_REFUND_REQUIRED", "This payment rail requires a real refund reference before financial resolution can be recorded", { manualRefundReference: "กรุณาคืนเงินจริงก่อน แล้วระบุเลขอ้างอิงธุรกรรม" });
  }
  const refundProvider = provider === "SANDBOX" ? "SANDBOX" : "MANUAL_BANK";
  const providerReference = provider === "SANDBOX" ? `sandbox-dispute-refund-${rental.id}-${amountMinor}` : manualReference!;
  const idempotencyKey = `dispute-deposit-refund:${rental.id}:${amountMinor}:v1`;
  await client.query(
    `INSERT INTO payments (rental_request_id,original_payment_id,payer_id,type,provider,provider_reference,idempotency_key,amount,currency,status,metadata,succeeded_at)
     VALUES ($1,$2,$3,'REFUND',$4,$5,$6,$7,$8,'SUCCEEDED',$9::jsonb,now())
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [rental.id, deposit.payment_id, rental.borrower_id, refundProvider, providerReference, idempotencyKey, amount, rental.currency,
      JSON.stringify({ source: "DISPUTE_RESOLUTION", resolution, confirmedByAdminId: admin.id, originalProvider: provider })],
  );
}

async function resolveDeposit(
  client: PoolClient,
  rental: RentalRow,
  admin: AuthUser,
  resolution: DisputeResolution,
  partialRefundInput: unknown,
  manualReferenceInput: unknown,
): Promise<{ status: string | null; refundAmount: string; forfeitedAmount: string }> {
  const deposit = await loadDeposit(client, rental.id);
  if (!deposit || minor(deposit.amount) <= 0) return { status: null, refundAmount: "0.00", forfeitedAmount: "0.00" };
  if (["REFUNDED", "FORFEITED", "PARTIALLY_RELEASED", "RELEASED"].includes(deposit.status)) {
    return { status: deposit.status, refundAmount: "0.00", forfeitedAmount: "0.00" };
  }
  if (deposit.status !== "HELD") throw new DisputeError(409, "DEPOSIT_NOT_RESOLVABLE", "Deposit is not held and cannot be resolved by this dispute");
  const totalMinor = minor(deposit.amount);
  let refundMinor = 0;
  if (resolution === "NO_FAULT" || resolution === "REFUND_DEPOSIT_FULL" || resolution === "REJECT_DISPUTE") refundMinor = totalMinor;
  if (resolution === "PARTIAL_DEPOSIT_REFUND") {
    const requested = Number(partialRefundInput);
    refundMinor = Math.round(requested * 100);
    if (!Number.isFinite(requested) || refundMinor <= 0 || refundMinor >= totalMinor) {
      throw new DisputeError(400, "VALIDATION_ERROR", "Partial refund must be greater than zero and lower than the held deposit", { partialRefundAmount: `ยอดคืนบางส่วนต้องมากกว่า 0 และน้อยกว่า ฿${deposit.amount}` });
    }
  }
  const manualReferenceRaw = String(manualReferenceInput ?? "").trim();
  const manualReference = manualReferenceRaw || null;
  if (manualReference && (manualReference.length < 4 || manualReference.length > 120)) throw new DisputeError(400, "VALIDATION_ERROR", "Manual refund reference is invalid", { manualRefundReference: "เลขอ้างอิงต้องมี 4–120 ตัวอักษร" });
  await createRefund(client, rental, deposit, refundMinor, manualReference, admin, resolution);
  const forfeitedMinor = totalMinor - refundMinor;
  const nextStatus = refundMinor === totalMinor ? "REFUNDED" : refundMinor === 0 ? "FORFEITED" : "PARTIALLY_RELEASED";
  const timestampColumn = nextStatus === "REFUNDED" ? "refunded_at" : nextStatus === "FORFEITED" ? "released_at" : "released_at";
  await client.query(`UPDATE deposits SET status=$2::deposit_status, ${timestampColumn}=COALESCE(${timestampColumn},now()), updated_at=now() WHERE id=$1 AND status='HELD'`, [deposit.id, nextStatus]);
  if (deposit.payment_id) {
    await client.query(
      `UPDATE payments SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{depositResolution}',$2::jsonb,true), updated_at=now() WHERE id=$1`,
      [deposit.payment_id, JSON.stringify({ status: nextStatus, resolution, refundAmount: moneyFromMinor(refundMinor), forfeitedAmount: moneyFromMinor(forfeitedMinor), resolvedAt: new Date().toISOString(), resolvedByAdminId: admin.id })],
    );
  }
  return { status: nextStatus, refundAmount: moneyFromMinor(refundMinor), forfeitedAmount: moneyFromMinor(forfeitedMinor) };
}

async function unfreezeSettlement(client: PoolClient, rental: RentalRow, resolution: DisputeResolution): Promise<string | null> {
  const payment = await settlementForRental(client, rental.id, true);
  if (!payment) return null;
  const settlement = settlementObject(payment.metadata);
  const before = typeof settlement.statusBeforeDispute === "string" ? settlement.statusBeforeDispute : "PLATFORM_HELD";
  const nextStatus = rental.status === "RETURNED" ? "READY_FOR_PAYOUT" : before === "DISPUTE_HELD" ? "PLATFORM_HELD" : before;
  const next = { ...settlement, status: nextStatus, disputeResolvedAt: new Date().toISOString(), lastDisputeResolution: resolution };
  await client.query(`UPDATE payments SET metadata=jsonb_set(metadata,'{settlement}',$2::jsonb,true), updated_at=now() WHERE id=$1`, [payment.payment_id, JSON.stringify(next)]);
  return nextStatus;
}

function depositStateResolved(status: string | null): boolean {
  return status == null || ["REFUNDED", "RELEASED", "PARTIALLY_RELEASED", "FORFEITED"].includes(status);
}

export async function startDisputeReview(admin: AuthUser, disputeIdInput: unknown): Promise<DisputeSummary> {
  if (!isAdmin(admin)) throw new DisputeError(403, "FORBIDDEN", "Administrator access required");
  const disputeId = requireUuid(disputeIdInput, "disputeId");
  return withTransaction(async (client) => {
    const dispute = await loadDisputeRow(client, disputeId, true);
    if (dispute.status === "UNDER_REVIEW") return mapDispute(dispute, await evidenceForDispute(client, dispute.id));
    if (dispute.status !== "OPEN") throw new DisputeError(409, "DISPUTE_NOT_REVIEWABLE", "Only open disputes can enter review");
    await client.query(`UPDATE disputes SET status='UNDER_REVIEW', updated_at=now() WHERE id=$1 AND status='OPEN'`, [dispute.id]);
    await client.query(`INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,details) VALUES ($1,'START_DISPUTE_REVIEW','DISPUTE',$2,'{}'::jsonb)`, [admin.id, dispute.id]);
    const updated = await loadDisputeRow(client, dispute.id);
    return mapDispute(updated, await evidenceForDispute(client, dispute.id));
  });
}

export async function resolveDispute(
  admin: AuthUser,
  disputeIdInput: unknown,
  input: { resolution?: unknown; notes?: unknown; partialRefundAmount?: unknown; manualRefundReference?: unknown },
): Promise<AdminDisputeDetail> {
  if (!isAdmin(admin)) throw new DisputeError(403, "FORBIDDEN", "Administrator access required");
  const disputeId = requireUuid(disputeIdInput, "disputeId");
  const resolution = validateResolution(input.resolution);
  const notes = validateResolutionNotes(input.notes);

  return withTransaction(async (client) => {
    const dispute = await loadDisputeRow(client, disputeId, true);
    if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) throw new DisputeError(409, "DISPUTE_ALREADY_RESOLVED", "This dispute is already closed");
    const rental = await loadRental(client, dispute.rental_request_id, true);
    if (rental.status !== "DISPUTED") throw new DisputeError(409, "RENTAL_STATE_MISMATCH", "Rental is no longer in disputed state");
    const previousStatus = await previousRentalStatus(client, dispute.id);
    rental.status = previousStatus;
    const depositResolution = await resolveDeposit(client, rental, admin, resolution, input.partialRefundAmount, input.manualRefundReference);
    const settlementStatus = await unfreezeSettlement(client, rental, resolution);
    const canComplete = previousStatus === "RETURNED" && depositStateResolved(depositResolution.status) && (rental.is_urgent || ["READY_FOR_PAYOUT", "PAID_OUT"].includes(settlementStatus ?? ""));
    const restoredStatus = canComplete ? "COMPLETED" : previousStatus;
    await client.query(
      `UPDATE rental_requests SET status=$2::rental_status, completed_at=CASE WHEN $2='COMPLETED' THEN COALESCE(completed_at,now()) ELSE completed_at END, updated_at=now() WHERE id=$1 AND status='DISPUTED'`,
      [rental.id, restoredStatus],
    );
    const disputeStatus: DisputeStatus = resolution === "REJECT_DISPUTE" ? "REJECTED" : "RESOLVED";
    const resolutionNotes = `${resolution}: ${notes}`;
    await client.query(
      `UPDATE disputes SET status=$2::dispute_status,resolved_by=$3,resolution_notes=$4,resolved_at=now(),updated_at=now() WHERE id=$1`,
      [dispute.id, disputeStatus, admin.id, resolutionNotes],
    );
    await client.query(
      `INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,details)
       VALUES ($1,'RESOLVE_DISPUTE','DISPUTE',$2,$3::jsonb)`,
      [admin.id, dispute.id, JSON.stringify({ resolution, previousRentalStatus: previousStatus, restoredRentalStatus: restoredStatus, depositResolution, settlementStatus, notes, manualRefundReference: String(input.manualRefundReference ?? "").trim() || null })],
    );
    for (const userId of [rental.borrower_id, rental.lender_id]) {
      await createNotification(client, {
        userId, type: "DISPUTE_RESOLVED", title: "ข้อพิพาทได้รับการตัดสินแล้ว",
        body: `${rental.item_title}: ผล ${resolution} · ${notes}`,
        relatedEntityType: "DISPUTE", relatedEntityId: dispute.id, idempotent: true,
      });
    }
    return getAdminDisputeDetailWithClient(client, admin, dispute.id);
  });
}

async function getAdminDisputeDetailWithClient(client: PoolClient, admin: AuthUser, disputeId: string): Promise<AdminDisputeDetail> {
  if (!isAdmin(admin)) throw new DisputeError(403, "FORBIDDEN", "Administrator access required");
  const dispute = await loadDisputeRow(client, disputeId);
  const rental = await loadRental(client, dispute.rental_request_id);
  const previous = await client.query<{ details: Record<string, unknown> } & QueryResultRow>(
    `SELECT details FROM admin_audit_logs WHERE action='DISPUTE_OPENED_SNAPSHOT' AND target_id=$1 ORDER BY created_at ASC LIMIT 1`, [dispute.id]);
  const previousStatusValue = previous.rows[0]?.details?.previousRentalStatus;
  const deposit = await loadDeposit(client, rental.id);
  const settlementRow = await settlementForRental(client, rental.id);
  const settlement = settlementObject(settlementRow?.metadata);
  return {
    ...mapDispute(dispute, await evidenceForDispute(client, dispute.id)),
    rentalStatus: rental.status,
    previousRentalStatus: typeof previousStatusValue === "string" ? previousStatusValue : null,
    deposit: deposit ? { amount: deposit.amount, status: deposit.status, provider: deposit.payment_provider } : null,
    settlement: settlementRow ? {
      status: typeof settlement.status === "string" ? settlement.status : "PLATFORM_HELD",
      payoutAmount: typeof settlement.payoutAmount === "string" ? settlement.payoutAmount : null,
      payoutMode: typeof settlement.payoutMode === "string" ? settlement.payoutMode : null,
    } : null,
  };
}

export async function getAdminDisputeDetail(admin: AuthUser, disputeIdInput: unknown): Promise<AdminDisputeDetail> {
  const disputeId = requireUuid(disputeIdInput, "disputeId");
  return withTransaction((client) => getAdminDisputeDetailWithClient(client, admin, disputeId));
}

export async function listDisputesForAdmin(admin: AuthUser): Promise<AdminDisputeDetail[]> {
  if (!isAdmin(admin)) throw new DisputeError(403, "FORBIDDEN", "Administrator access required");
  const result = await query<{ id: string } & QueryResultRow>(`SELECT id FROM disputes ORDER BY created_at DESC LIMIT 200`);
  const items: AdminDisputeDetail[] = [];
  for (const row of result.rows) items.push(await getAdminDisputeDetail(admin, row.id));
  return items;
}
