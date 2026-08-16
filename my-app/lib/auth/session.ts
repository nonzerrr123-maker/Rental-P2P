import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";

export const SESSION_COOKIE_NAME = "rental_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type UserRole = "USER" | "ADMIN" | "SUPERADMIN";
export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
};

type SessionUserRow = QueryResultRow & {
  session_id: string;
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  verification_status: VerificationStatus;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);

  await query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '7 days')`,
    [userId, tokenHash],
  );

  return token;
}

export async function revokeSessionToken(token: string): Promise<void> {
  await query(
    `UPDATE user_sessions
     SET revoked_at = COALESCE(revoked_at, now())
     WHERE token_hash = $1`,
    [hashSessionToken(token)],
  );
}

export async function getCurrentUserFromToken(token: string): Promise<AuthUser | null> {
  const result = await query<SessionUserRow>(
    `SELECT
       s.id AS session_id,
       u.id,
       u.email,
       u.display_name,
       u.role,
       u.verification_status
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
       AND u.is_active = true
     LIMIT 1`,
    [hashSessionToken(token)],
  );

  const row = result.rows[0];
  if (!row) return null;

  void query(
    `UPDATE user_sessions
     SET last_seen_at = now()
     WHERE id = $1
       AND (last_seen_at IS NULL OR last_seen_at < now() - interval '5 minutes')`,
    [row.session_id],
  ).catch((error) => console.error("Failed to update session last_seen_at", error));

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    verificationStatus: row.verification_status,
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getCurrentUserFromToken(token);
}

export function getLoginRedirect(user: Pick<AuthUser, "role" | "verificationStatus">): string {
  if (user.role === "ADMIN" || user.role === "SUPERADMIN") return "/admin";
  if (user.verificationStatus !== "VERIFIED") return "/verification";
  return "/";
}
