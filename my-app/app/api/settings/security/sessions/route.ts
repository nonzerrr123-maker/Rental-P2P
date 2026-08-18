import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const user = await requireUser();
    const result = await query(
      `UPDATE user_sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [user.id],
    );

    const response = NextResponse.json({ ok: true, revokedSessions: result.rowCount ?? 0 });
    response.cookies.set(SESSION_COOKIE_NAME, "", getSessionCookieOptions(0));
    return response;
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    console.error("Session revocation failed", error);
    return NextResponse.json({ ok: false, code: "SESSION_REVOCATION_FAILED", message: "ออกจากระบบทุกอุปกรณ์ไม่สำเร็จ" }, { status: 500 });
  }
}
