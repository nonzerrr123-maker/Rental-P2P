import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { hashAuthActionToken, isPlausibleAuthActionToken } from "@/lib/auth/action-tokens";
import { hashPassword } from "@/lib/auth/password";
import { withTransaction } from "@/lib/db";
import { sendPasswordChangedMessage } from "@/lib/email/messages";

export const runtime = "nodejs";

type TokenRow = QueryResultRow & {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawToken = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isPlausibleAuthActionToken(rawToken)) {
    return NextResponse.json({ ok: false, code: "INVALID_TOKEN", message: "ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ ok: false, code: "INVALID_PASSWORD", message: "รหัสผ่านต้องมี 8-128 ตัวอักษร" }, { status: 400 });
  }

  try {
    const newPasswordHash = await hashPassword(password);
    const result = await withTransaction(async (client) => {
      const tokenResult = await client.query<TokenRow>(
        `SELECT t.id, t.user_id, u.email, u.display_name
         FROM auth_action_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = $1
           AND t.purpose = 'PASSWORD_RESET'
           AND t.consumed_at IS NULL
           AND t.expires_at > now()
           AND u.is_active = true
         LIMIT 1
         FOR UPDATE OF t, u`,
        [hashAuthActionToken(rawToken)],
      );
      const token = tokenResult.rows[0];
      if (!token) return { reset: false as const };

      await client.query(
        `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
        [token.user_id, newPasswordHash],
      );
      await client.query(
        `UPDATE user_sessions
         SET revoked_at = COALESCE(revoked_at, now())
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [token.user_id],
      );
      await client.query(
        `UPDATE auth_action_tokens
         SET consumed_at = COALESCE(consumed_at, now())
         WHERE user_id = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL`,
        [token.user_id],
      );

      return {
        reset: true as const,
        actionId: token.id,
        email: token.email,
        displayName: token.display_name,
      };
    });

    if (!result.reset) {
      return NextResponse.json({ ok: false, code: "INVALID_TOKEN", message: "ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });
    }

    try {
      await sendPasswordChangedMessage({
        to: result.email,
        displayName: result.displayName,
        actionId: result.actionId,
      });
    } catch (error) {
      console.error("Password changed security email failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        status: typeof error === "object" && error !== null && "status" in error ? error.status : undefined,
      });
    }

    return NextResponse.json({ ok: true, message: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง" });
  } catch (error) {
    console.error("Password reset failed", error);
    return NextResponse.json({ ok: false, code: "PASSWORD_RESET_FAILED", message: "ไม่สามารถตั้งรหัสผ่านใหม่ได้" }, { status: 500 });
  }
}
