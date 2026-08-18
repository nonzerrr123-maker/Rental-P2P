import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db";
import { passwordSettingsSchema } from "@/lib/forms/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PasswordRow = QueryResultRow & { password_hash: string };

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = passwordSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, code: "INVALID_PASSWORD_CHANGE", message: parsed.error.issues[0]?.message ?? "ข้อมูลรหัสผ่านไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!currentToken) {
      return NextResponse.json({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, { status: 401 });
    }

    const result = await withTransaction(async (client) => {
      const passwordResult = await client.query<PasswordRow>(
        `SELECT password_hash FROM users WHERE id = $1 FOR UPDATE`,
        [user.id],
      );
      const storedHash = passwordResult.rows[0]?.password_hash;
      if (!storedHash || !(await verifyPassword(parsed.data.currentPassword, storedHash))) {
        return { invalidCurrentPassword: true, revokedSessions: 0 };
      }

      const newHash = await hashPassword(parsed.data.newPassword);
      await client.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [user.id, newHash]);
      const revoked = await client.query(
        `UPDATE user_sessions
         SET revoked_at = COALESCE(revoked_at, now())
         WHERE user_id = $1
           AND token_hash <> $2
           AND revoked_at IS NULL`,
        [user.id, hashSessionToken(currentToken)],
      );
      return { invalidCurrentPassword: false, revokedSessions: revoked.rowCount ?? 0 };
    });

    if (result.invalidCurrentPassword) {
      return NextResponse.json({ ok: false, code: "CURRENT_PASSWORD_INVALID", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, revokedSessions: result.revokedSessions });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    console.error("Password settings update failed", error);
    return NextResponse.json({ ok: false, code: "PASSWORD_UPDATE_FAILED", message: "เปลี่ยนรหัสผ่านไม่สำเร็จ" }, { status: 500 });
  }
}
