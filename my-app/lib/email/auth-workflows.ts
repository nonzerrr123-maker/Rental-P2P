import type { QueryResultRow } from "pg";
import { issueAuthActionToken } from "@/lib/auth/action-tokens";
import {
  authEmailCooldownSeconds,
  emailVerificationTtlSeconds,
  getResendConfigurationState,
  passwordResetTtlSeconds,
} from "@/lib/email/resend";
import { sendEmailVerificationMessage, sendPasswordResetMessage } from "@/lib/email/messages";
import { query } from "@/lib/db";

type EmailVerifiedRow = QueryResultRow & { verified_at: Date };

export async function isUserEmailVerified(userId: string): Promise<boolean> {
  const result = await query<EmailVerifiedRow>(
    `SELECT verified_at FROM user_email_verifications WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return Boolean(result.rows[0]?.verified_at);
}

export async function sendVerificationForUser(input: {
  userId: string;
  email: string;
  displayName: string;
  baseUrl: string;
  enforceCooldown?: boolean;
}): Promise<{ sent: boolean; reason?: "NOT_CONFIGURED" | "COOLDOWN" | "PROVIDER_FAILED" }> {
  if (!getResendConfigurationState().configured) return { sent: false, reason: "NOT_CONFIGURED" };
  if (await isUserEmailVerified(input.userId)) return { sent: false };

  const issued = await issueAuthActionToken({
    userId: input.userId,
    purpose: "EMAIL_VERIFY",
    ttlSeconds: emailVerificationTtlSeconds(),
    cooldownSeconds: input.enforceCooldown === false ? 0 : authEmailCooldownSeconds(),
  });
  if (!issued.issued) return { sent: false, reason: "COOLDOWN" };

  try {
    await sendEmailVerificationMessage({
      to: input.email,
      displayName: input.displayName,
      token: issued.token.rawToken,
      baseUrl: input.baseUrl,
      actionId: issued.token.id,
    });
    return { sent: true };
  } catch (error) {
    console.error("Verification email provider request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      status: typeof error === "object" && error !== null && "status" in error ? error.status : undefined,
    });
    return { sent: false, reason: "PROVIDER_FAILED" };
  }
}

export async function sendPasswordResetForUser(input: {
  userId: string;
  email: string;
  displayName: string;
  baseUrl: string;
}): Promise<{ sent: boolean; reason?: "NOT_CONFIGURED" | "COOLDOWN" | "PROVIDER_FAILED" }> {
  if (!getResendConfigurationState().configured) return { sent: false, reason: "NOT_CONFIGURED" };

  const issued = await issueAuthActionToken({
    userId: input.userId,
    purpose: "PASSWORD_RESET",
    ttlSeconds: passwordResetTtlSeconds(),
    cooldownSeconds: authEmailCooldownSeconds(),
  });
  if (!issued.issued) return { sent: false, reason: "COOLDOWN" };

  try {
    await sendPasswordResetMessage({
      to: input.email,
      displayName: input.displayName,
      token: issued.token.rawToken,
      baseUrl: input.baseUrl,
      actionId: issued.token.id,
    });
    return { sent: true };
  } catch (error) {
    console.error("Password reset email provider request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      status: typeof error === "object" && error !== null && "status" in error ? error.status : undefined,
    });
    return { sent: false, reason: "PROVIDER_FAILED" };
  }
}
