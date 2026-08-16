import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { query, withTransaction } from "@/lib/db";
import type { VerificationStatus } from "@/lib/auth/session";

export type VerificationProvider = "MANUAL_ADMIN" | string;

export type VerificationRecord = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  provider: VerificationProvider;
  providerReference: string;
  status: Exclude<VerificationStatus, "UNVERIFIED">;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  metadata: Record<string, unknown>;
};

export class VerificationWorkflowError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    public readonly code:
      | "ALREADY_VERIFIED"
      | "VERIFICATION_PENDING"
      | "VERIFICATION_NOT_FOUND"
      | "VERIFICATION_ALREADY_REVIEWED"
      | "REJECTION_REASON_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "VerificationWorkflowError";
  }
}

type VerificationRow = QueryResultRow & {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  provider: string;
  provider_reference: string;
  status: Exclude<VerificationStatus, "UNVERIFIED">;
  submitted_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  metadata: Record<string, unknown>;
};

function mapVerification(row: VerificationRow): VerificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    provider: row.provider,
    providerReference: row.provider_reference,
    status: row.status,
    submittedAt: row.submitted_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    reviewedBy: row.reviewed_by,
    rejectionReason: row.rejection_reason,
    metadata: row.metadata ?? {},
  };
}

const verificationSelect = `
  SELECT
    iv.id,
    iv.user_id,
    u.email,
    u.display_name,
    iv.provider,
    iv.provider_reference,
    iv.status,
    iv.submitted_at,
    iv.reviewed_at,
    iv.reviewed_by,
    iv.rejection_reason,
    iv.metadata
  FROM identity_verifications iv
  JOIN users u ON u.id = iv.user_id
`;

export async function getVerificationOverview(userId: string): Promise<{
  verificationStatus: VerificationStatus;
  latest: VerificationRecord | null;
}> {
  const userResult = await query<QueryResultRow & { verification_status: VerificationStatus }>(
    `SELECT verification_status FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new VerificationWorkflowError(404, "VERIFICATION_NOT_FOUND", "User not found");
  }

  const verificationResult = await query<VerificationRow>(
    `${verificationSelect}
     WHERE iv.user_id = $1
     ORDER BY iv.submitted_at DESC
     LIMIT 1`,
    [userId],
  );

  return {
    verificationStatus: user.verification_status,
    latest: verificationResult.rows[0] ? mapVerification(verificationResult.rows[0]) : null,
  };
}

export async function submitManualVerification(userId: string): Promise<VerificationRecord> {
  return withTransaction(async (client) => {
    const userResult = await client.query<
      QueryResultRow & { verification_status: VerificationStatus }
    >(
      `SELECT verification_status
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId],
    );

    const user = userResult.rows[0];
    if (!user) {
      throw new VerificationWorkflowError(404, "VERIFICATION_NOT_FOUND", "User not found");
    }
    if (user.verification_status === "VERIFIED") {
      throw new VerificationWorkflowError(409, "ALREADY_VERIFIED", "Identity is already verified");
    }

    const pendingResult = await client.query<VerificationRow>(
      `${verificationSelect}
       WHERE iv.user_id = $1 AND iv.status = 'PENDING'
       ORDER BY iv.submitted_at DESC
       LIMIT 1`,
      [userId],
    );

    if (pendingResult.rows[0]) {
      throw new VerificationWorkflowError(
        409,
        "VERIFICATION_PENDING",
        "A verification request is already pending",
      );
    }

    const providerReference = `manual:${randomUUID()}`;
    const insertResult = await client.query<VerificationRow>(
      `WITH inserted AS (
         INSERT INTO identity_verifications (
           user_id,
           provider,
           provider_reference,
           status,
           metadata
         ) VALUES ($1, 'MANUAL_ADMIN', $2, 'PENDING', $3::jsonb)
         RETURNING *
       )
       SELECT
         inserted.id,
         inserted.user_id,
         u.email,
         u.display_name,
         inserted.provider,
         inserted.provider_reference,
         inserted.status,
         inserted.submitted_at,
         inserted.reviewed_at,
         inserted.reviewed_by,
         inserted.rejection_reason,
         inserted.metadata
       FROM inserted
       JOIN users u ON u.id = inserted.user_id`,
      [
        userId,
        providerReference,
        JSON.stringify({
          mode: "manual-admin",
          rawIdentityStored: false,
          rawBiometricStored: false,
        }),
      ],
    );

    await client.query(
      `UPDATE users
       SET verification_status = 'PENDING'
       WHERE id = $1`,
      [userId],
    );

    return mapVerification(insertResult.rows[0]);
  });
}

export async function listVerificationQueue(): Promise<{
  counts: { pending: number; verified: number; rejected: number };
  requests: VerificationRecord[];
}> {
  const [countResult, requestResult] = await Promise.all([
    query<
      QueryResultRow & { pending: string; verified: string; rejected: string }
    >(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PENDING')::text AS pending,
         COUNT(*) FILTER (WHERE status = 'VERIFIED')::text AS verified,
         COUNT(*) FILTER (WHERE status = 'REJECTED')::text AS rejected
       FROM identity_verifications`,
    ),
    query<VerificationRow>(
      `${verificationSelect}
       ORDER BY
         CASE iv.status WHEN 'PENDING' THEN 0 ELSE 1 END,
         iv.submitted_at DESC
       LIMIT 100`,
    ),
  ]);

  const counts = countResult.rows[0];
  return {
    counts: {
      pending: Number(counts?.pending ?? 0),
      verified: Number(counts?.verified ?? 0),
      rejected: Number(counts?.rejected ?? 0),
    },
    requests: requestResult.rows.map(mapVerification),
  };
}

async function lockVerification(client: PoolClient, verificationId: string) {
  const result = await client.query<VerificationRow>(
    `${verificationSelect}
     WHERE iv.id = $1
     FOR UPDATE OF iv, u`,
    [verificationId],
  );
  return result.rows[0] ?? null;
}

export async function reviewVerification(input: {
  verificationId: string;
  reviewerId: string;
  decision: "VERIFIED" | "REJECTED";
  rejectionReason?: string;
}): Promise<VerificationRecord> {
  const rejectionReason = input.rejectionReason?.trim() || null;
  if (input.decision === "REJECTED" && !rejectionReason) {
    throw new VerificationWorkflowError(
      400,
      "REJECTION_REASON_REQUIRED",
      "A rejection reason is required",
    );
  }

  return withTransaction(async (client) => {
    const current = await lockVerification(client, input.verificationId);
    if (!current) {
      throw new VerificationWorkflowError(
        404,
        "VERIFICATION_NOT_FOUND",
        "Verification request not found",
      );
    }
    if (current.status !== "PENDING") {
      throw new VerificationWorkflowError(
        409,
        "VERIFICATION_ALREADY_REVIEWED",
        "Verification request has already been reviewed",
      );
    }

    const updatedResult = await client.query<VerificationRow>(
      `WITH updated AS (
         UPDATE identity_verifications
         SET
           status = $2,
           reviewed_at = now(),
           reviewed_by = $3,
           rejection_reason = $4
         WHERE id = $1
         RETURNING *
       )
       SELECT
         updated.id,
         updated.user_id,
         u.email,
         u.display_name,
         updated.provider,
         updated.provider_reference,
         updated.status,
         updated.submitted_at,
         updated.reviewed_at,
         updated.reviewed_by,
         updated.rejection_reason,
         updated.metadata
       FROM updated
       JOIN users u ON u.id = updated.user_id`,
      [input.verificationId, input.decision, input.reviewerId, rejectionReason],
    );

    await client.query(
      `UPDATE users
       SET verification_status = $2
       WHERE id = $1`,
      [current.user_id, input.decision],
    );

    await client.query(
      `INSERT INTO admin_audit_logs (
         actor_user_id,
         action,
         target_type,
         target_id,
         details
       ) VALUES ($1, $2, 'identity_verification', $3, $4::jsonb)`,
      [
        input.reviewerId,
        input.decision === "VERIFIED" ? "VERIFY_IDENTITY" : "REJECT_IDENTITY",
        input.verificationId,
        JSON.stringify({
          userId: current.user_id,
          provider: current.provider,
          previousStatus: current.status,
          nextStatus: input.decision,
          rejectionReason,
        }),
      ],
    );

    return mapVerification(updatedResult.rows[0]);
  });
}
