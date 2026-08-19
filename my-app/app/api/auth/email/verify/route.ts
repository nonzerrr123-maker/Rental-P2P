import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { hashAuthActionToken, isPlausibleAuthActionToken } from "@/lib/auth/action-tokens";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";

type TokenRow = QueryResultRow & {
  id: string;
  user_id: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawToken = typeof body?.token === "string" ? body.token.trim() : "";
  if (!isPlausibleAuthActionToken(rawToken)) {
    return NextResponse.json({ ok: false, code: "INVALID_TOKEN", message: "ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });
  }

  try {
    const result = await withTransaction(async (client) => {
      const tokenResult = await client.query<TokenRow>(
        `SELECT id, user_id
         FROM auth_action_tokens
         WHERE token_hash = $1
           AND purpose = 'EMAIL_VERIFY'
           AND consumed_at IS NULL
           AND expires_at > now()
         LIMIT 1
         FOR UPDATE`,
        [hashAuthActionToken(rawToken)],
      );
      const token = tokenResult.rows[0];
      if (!token) return { verified: false as const };

      await client.query(
        `INSERT INTO user_email_verifications (user_id, verified_at)
         VALUES ($1, now())
         ON CONFLICT (user_id) DO UPDATE SET verified_at = EXCLUDED.verified_at`,
        [token.user_id],
      );
      await client.query(
        `UPDATE auth_action_tokens
         SET consumed_at = COALESCE(consumed_at, now())
         WHERE user_id = $1 AND purpose = 'EMAIL_VERIFY' AND consumed_at IS NULL`,
        [token.user_id],
      );
      return { verified: true as const };
    });

    if (!result.verified) {
      return NextResponse.json({ ok: false, code: "INVALID_TOKEN", message: "ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: "ยืนยันอีเมลเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Email verification failed", error);
    return NextResponse.json({ ok: false, code: "EMAIL_VERIFY_FAILED", message: "ไม่สามารถยืนยันอีเมลได้" }, { status: 500 });
  }
}
