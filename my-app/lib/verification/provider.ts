import { createHash, randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import { query, withTransaction } from "@/lib/db";
import type { VerificationStatus } from "@/lib/auth/session";
import {
  getVerificationOverview,
  submitManualVerification,
  VerificationWorkflowError,
  type VerificationRecord,
} from "@/lib/verification/service";
import {
  createPersonaInquiry,
  generatePersonaOneTimeLink,
  getPersonaConfiguration,
  type PersonaWebhookEvent,
} from "@/lib/verification/persona";

export type KycProviderState = {
  mode: "PERSONA" | "MANUAL_ADMIN";
  ready: boolean;
  reason: "CONFIGURED" | "MANUAL_MODE" | "PERSONA_CONFIG_INCOMPLETE";
};

export type KycStartResult = {
  mode: "PERSONA" | "MANUAL_ADMIN";
  verification: VerificationRecord;
  redirectUrl?: string;
  fallbackReason?: "PERSONA_CONFIG_INCOMPLETE" | "PERSONA_START_FAILED";
};

export class KycProviderWorkflowError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 502,
    public readonly code:
      | "CONSENT_REQUIRED"
      | "PERSONA_NOT_CONFIGURED"
      | "PERSONA_RESUME_UNAVAILABLE"
      | "PERSONA_RESUME_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "KycProviderWorkflowError";
  }
}

type UserStatusRow = QueryResultRow & {
  verification_status: VerificationStatus;
};

type VerificationIdRow = QueryResultRow & {
  id: string;
  user_id: string;
  status: Exclude<VerificationStatus, "UNVERIFIED">;
  provider: string;
  provider_reference: string;
};

export function getKycProviderState(): KycProviderState {
  const requested = process.env.KYC_PROVIDER?.trim().toLowerCase() || "manual";
  if (requested !== "persona") {
    return { mode: "MANUAL_ADMIN", ready: true, reason: "MANUAL_MODE" };
  }

  const config = getPersonaConfiguration();
  if (!config) {
    return { mode: "MANUAL_ADMIN", ready: true, reason: "PERSONA_CONFIG_INCOMPLETE" };
  }

  return { mode: "PERSONA", ready: true, reason: "CONFIGURED" };
}

async function reservePersonaVerification(userId: string): Promise<{ verificationId: string; idempotencyKey: string }> {
  return withTransaction(async (client) => {
    const userResult = await client.query<UserStatusRow>(
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

    const pending = await client.query<VerificationIdRow>(
      `SELECT id, user_id, status, provider, provider_reference
       FROM identity_verifications
       WHERE user_id = $1 AND status = 'PENDING'
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [userId],
    );
    if (pending.rows[0]) {
      throw new VerificationWorkflowError(
        409,
        "VERIFICATION_PENDING",
        "A verification request is already pending",
      );
    }

    const verificationId = randomUUID();
    const startingReference = `persona:starting:${randomUUID()}`;
    await client.query(
      `INSERT INTO identity_verifications (
         id,
         user_id,
         provider,
         provider_reference,
         status,
         metadata
       ) VALUES ($1, $2, 'PERSONA', $3, 'PENDING', $4::jsonb)`,
      [
        verificationId,
        userId,
        startingReference,
        JSON.stringify({
          mode: "hosted-flow",
          providerState: "STARTING",
          consentRecordedAt: new Date().toISOString(),
          rawIdentityStored: false,
          rawBiometricStored: false,
        }),
      ],
    );
    await client.query(
      `UPDATE users SET verification_status = 'PENDING' WHERE id = $1`,
      [userId],
    );

    return { verificationId, idempotencyKey: `kyc-${verificationId}` };
  });
}

async function activatePersonaReservation(input: {
  verificationId: string;
  inquiryId: string;
}): Promise<void> {
  await query(
    `UPDATE identity_verifications
     SET
       provider_reference = $2,
       metadata = metadata || $3::jsonb
     WHERE id = $1 AND provider = 'PERSONA' AND status = 'PENDING'`,
    [
      input.verificationId,
      input.inquiryId,
      JSON.stringify({
        providerState: "HOSTED_FLOW_READY",
        providerStartedAt: new Date().toISOString(),
      }),
    ],
  );
}

async function fallbackPersonaReservation(input: {
  verificationId: string;
  providerStatus?: number;
}): Promise<void> {
  await query(
    `UPDATE identity_verifications
     SET
       provider = 'MANUAL_ADMIN',
       provider_reference = $2,
       metadata = metadata || $3::jsonb
     WHERE id = $1 AND status = 'PENDING'`,
    [
      input.verificationId,
      `manual:fallback:${randomUUID()}`,
      JSON.stringify({
        mode: "manual-admin",
        providerState: "FALLBACK",
        fallbackReason: "PERSONA_START_FAILED",
        providerHttpStatus: input.providerStatus ?? null,
        fallbackAt: new Date().toISOString(),
        rawIdentityStored: false,
        rawBiometricStored: false,
      }),
    ],
  );
}

export async function startConfiguredVerification(input: {
  userId: string;
  consent: boolean;
}): Promise<KycStartResult> {
  const requestedPersona = (process.env.KYC_PROVIDER?.trim().toLowerCase() || "manual") === "persona";
  const config = getPersonaConfiguration();

  if (!requestedPersona || !config) {
    const verification = await submitManualVerification(input.userId);
    return {
      mode: "MANUAL_ADMIN",
      verification,
      ...(requestedPersona ? { fallbackReason: "PERSONA_CONFIG_INCOMPLETE" as const } : {}),
    };
  }

  if (!input.consent) {
    throw new KycProviderWorkflowError(
      400,
      "CONSENT_REQUIRED",
      "Consent is required before starting external identity verification",
    );
  }

  const reservation = await reservePersonaVerification(input.userId);
  try {
    const inquiry = await createPersonaInquiry({
      config,
      userId: input.userId,
      idempotencyKey: reservation.idempotencyKey,
    });
    await activatePersonaReservation({
      verificationId: reservation.verificationId,
      inquiryId: inquiry.inquiryId,
    });
    const overview = await getVerificationOverview(input.userId);
    if (!overview.latest) {
      throw new Error("Verification reservation disappeared after Persona start");
    }
    return {
      mode: "PERSONA",
      verification: overview.latest,
      redirectUrl: inquiry.redirectUrl,
    };
  } catch (error) {
    const providerStatus =
      error && typeof error === "object" && "status" in error && typeof error.status === "number"
        ? error.status
        : undefined;
    await fallbackPersonaReservation({
      verificationId: reservation.verificationId,
      providerStatus,
    });
    const overview = await getVerificationOverview(input.userId);
    if (!overview.latest) throw error;
    return {
      mode: "MANUAL_ADMIN",
      verification: overview.latest,
      fallbackReason: "PERSONA_START_FAILED",
    };
  }
}

export async function resumePersonaVerification(userId: string): Promise<string> {
  const config = getPersonaConfiguration();
  if (!config) {
    throw new KycProviderWorkflowError(
      409,
      "PERSONA_NOT_CONFIGURED",
      "Persona is not fully configured",
    );
  }

  const overview = await getVerificationOverview(userId);
  const latest = overview.latest;
  if (!latest || latest.status !== "PENDING" || latest.provider !== "PERSONA") {
    throw new KycProviderWorkflowError(
      409,
      "PERSONA_RESUME_UNAVAILABLE",
      "There is no pending Persona verification to resume",
    );
  }

  try {
    return await generatePersonaOneTimeLink({
      config,
      inquiryId: latest.providerReference,
      idempotencyKey: `resume-${latest.id}`,
    });
  } catch {
    throw new KycProviderWorkflowError(
      502,
      "PERSONA_RESUME_FAILED",
      "Unable to resume Persona verification; an administrator can still review the pending request",
    );
  }
}

function eventDecision(eventName: string): {
  nextStatus: "VERIFIED" | "REJECTED" | null;
  reason: string | null;
} {
  if (eventName === "inquiry.approved") {
    return { nextStatus: "VERIFIED", reason: null };
  }
  if (eventName === "inquiry.declined") {
    return { nextStatus: "REJECTED", reason: "Identity provider declined the verification" };
  }
  if (eventName === "inquiry.failed") {
    return { nextStatus: "REJECTED", reason: "Identity provider verification attempts were exhausted" };
  }
  if (eventName === "inquiry.expired") {
    return { nextStatus: "REJECTED", reason: "Identity provider verification expired" };
  }
  return { nextStatus: null, reason: null };
}

export async function processPersonaWebhook(input: {
  event: PersonaWebhookEvent;
  rawBody: string;
}): Promise<{ duplicate: boolean; outcome: string; verificationStatus?: VerificationStatus }> {
  const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");

  return withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [input.event.eventId]);

    const priorEvent = await client.query<QueryResultRow & { id: string }>(
      `SELECT id
       FROM admin_audit_logs
       WHERE action = 'KYC_PROVIDER_EVENT'
         AND details->>'eventId' = $1
       LIMIT 1`,
      [input.event.eventId],
    );
    if (priorEvent.rows[0]) {
      return { duplicate: true, outcome: "DUPLICATE" };
    }

    const verificationResult = await client.query<VerificationIdRow>(
      `SELECT id, user_id, status, provider, provider_reference
       FROM identity_verifications
       WHERE provider = 'PERSONA' AND provider_reference = $1
       FOR UPDATE`,
      [input.event.inquiryId],
    );
    const verification = verificationResult.rows[0];

    if (!verification) {
      await client.query(
        `INSERT INTO admin_audit_logs (action, target_type, details)
         VALUES ('KYC_PROVIDER_EVENT', 'identity_verification', $1::jsonb)`,
        [
          JSON.stringify({
            eventId: input.event.eventId,
            eventName: input.event.eventName,
            inquiryId: input.event.inquiryId,
            payloadHash,
            outcome: "IGNORED_UNKNOWN_INQUIRY",
          }),
        ],
      );
      return { duplicate: false, outcome: "IGNORED_UNKNOWN_INQUIRY" };
    }

    if (input.event.referenceId && input.event.referenceId !== verification.user_id) {
      await client.query(
        `INSERT INTO admin_audit_logs (action, target_type, target_id, details)
         VALUES ('KYC_PROVIDER_EVENT', 'identity_verification', $1, $2::jsonb)`,
        [
          verification.id,
          JSON.stringify({
            eventId: input.event.eventId,
            eventName: input.event.eventName,
            inquiryId: input.event.inquiryId,
            payloadHash,
            outcome: "IGNORED_REFERENCE_MISMATCH",
          }),
        ],
      );
      return { duplicate: false, outcome: "IGNORED_REFERENCE_MISMATCH" };
    }

    const decision = eventDecision(input.event.eventName);
    let outcome = "RECORDED_NON_TERMINAL";
    let verificationStatus: VerificationStatus = verification.status;

    if (decision.nextStatus && verification.status === "PENDING") {
      await client.query(
        `UPDATE identity_verifications
         SET
           status = $2,
           reviewed_at = now(),
           reviewed_by = NULL,
           rejection_reason = $3,
           metadata = metadata || $4::jsonb
         WHERE id = $1`,
        [
          verification.id,
          decision.nextStatus,
          decision.reason,
          JSON.stringify({
            providerState: input.event.inquiryStatus ?? input.event.eventName,
            providerDecisionEvent: input.event.eventName,
            providerDecisionAt: new Date().toISOString(),
          }),
        ],
      );
      await client.query(
        `UPDATE users SET verification_status = $2 WHERE id = $1`,
        [verification.user_id, decision.nextStatus],
      );
      verificationStatus = decision.nextStatus;
      outcome = `APPLIED_${decision.nextStatus}`;
    } else if (decision.nextStatus && verification.status !== "PENDING") {
      outcome = "IGNORED_ALREADY_DECIDED";
    }

    await client.query(
      `INSERT INTO admin_audit_logs (action, target_type, target_id, details)
       VALUES ('KYC_PROVIDER_EVENT', 'identity_verification', $1, $2::jsonb)`,
      [
        verification.id,
        JSON.stringify({
          eventId: input.event.eventId,
          eventName: input.event.eventName,
          inquiryId: input.event.inquiryId,
          inquiryStatus: input.event.inquiryStatus,
          payloadHash,
          outcome,
        }),
      ],
    );

    return { duplicate: false, outcome, verificationStatus };
  });
}
