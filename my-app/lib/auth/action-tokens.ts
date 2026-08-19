import { createHash, randomBytes } from "node:crypto";
import type { QueryResultRow } from "pg";
import { withTransaction } from "@/lib/db";

export type AuthActionPurpose = "EMAIL_VERIFY" | "PASSWORD_RESET";

export type IssuedAuthActionToken = {
  id: string;
  rawToken: string;
  expiresAt: Date;
};

export type IssueAuthActionTokenResult =
  | { issued: true; token: IssuedAuthActionToken }
  | { issued: false; reason: "COOLDOWN" };

type RecentTokenRow = QueryResultRow & { created_at: Date };
type IssuedTokenRow = QueryResultRow & { id: string; expires_at: Date };

const RAW_TOKEN_BYTES = 32;
const TOKEN_HASH_HEX_LENGTH = 64;

export function hashAuthActionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function isPlausibleAuthActionToken(rawToken: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(rawToken);
}

export async function issueAuthActionToken(input: {
  userId: string;
  purpose: AuthActionPurpose;
  ttlSeconds: number;
  cooldownSeconds?: number;
}): Promise<IssueAuthActionTokenResult> {
  const ttlSeconds = Math.max(60, Math.trunc(input.ttlSeconds));
  const cooldownSeconds = Math.max(0, Math.trunc(input.cooldownSeconds ?? 0));
  const rawToken = randomBytes(RAW_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashAuthActionToken(rawToken);

  return withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
      `auth-action:${input.userId}:${input.purpose}`,
    ]);

    if (cooldownSeconds > 0) {
      const recent = await client.query<RecentTokenRow>(
        `SELECT created_at
         FROM auth_action_tokens
         WHERE user_id = $1 AND purpose = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [input.userId, input.purpose],
      );
      const createdAt = recent.rows[0]?.created_at;
      if (createdAt && Date.now() - createdAt.getTime() < cooldownSeconds * 1000) {
        return { issued: false as const, reason: "COOLDOWN" as const };
      }
    }

    await client.query(
      `UPDATE auth_action_tokens
       SET consumed_at = COALESCE(consumed_at, now())
       WHERE user_id = $1
         AND purpose = $2
         AND consumed_at IS NULL`,
      [input.userId, input.purpose],
    );

    const result = await client.query<IssuedTokenRow>(
      `INSERT INTO auth_action_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, $2, $3, now() + ($4 * interval '1 second'))
       RETURNING id, expires_at`,
      [input.userId, input.purpose, tokenHash, ttlSeconds],
    );
    const row = result.rows[0];
    if (!row || tokenHash.length !== TOKEN_HASH_HEX_LENGTH) {
      throw new Error("Failed to issue auth action token");
    }

    return {
      issued: true as const,
      token: { id: row.id, rawToken, expiresAt: row.expires_at },
    };
  });
}
