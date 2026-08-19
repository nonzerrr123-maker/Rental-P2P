import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { getSessionCookieOptions, hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionRow = QueryResultRow & {
  id: string;
  token_hash: string;
  created_at: Date;
  last_seen_at: Date | null;
  expires_at: Date;
};

export async function GET() {
  try {
    const user = await requireUser();
    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const currentHash = currentToken ? hashSessionToken(currentToken) : null;
    const result = await query<SessionRow>(
      `SELECT id, token_hash, created_at, last_seen_at, expires_at
       FROM user_sessions
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND expires_at > now()
       ORDER BY COALESCE(last_seen_at, created_at) DESC, created_at DESC`,
      [user.id],
    );

    return NextResponse.json({
      ok: true,
      sessions: result.rows.map((session) => ({
        id: session.id,
        current: currentHash === session.token_hash,
        createdAt: session.created_at.toISOString(),
        lastSeenAt: session.last_seen_at?.toISOString() ?? null,
        expiresAt: session.expires_at.toISOString(),
      })),
    });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    console.error("Session listing failed", error);
    return NextResponse.json({ ok: false, code: "SESSION_LIST_FAILED", message: "โหลด session ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    let sessionId: string | null = null;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await request.json().catch(() => ({})) as { sessionId?: unknown };
      if (typeof payload.sessionId === "string" && payload.sessionId.trim()) {
        sessionId = payload.sessionId.trim();
        if (!UUID_PATTERN.test(sessionId)) {
          return NextResponse.json({ ok: false, code: "INVALID_SESSION", message: "Session ไม่ถูกต้อง" }, { status: 400 });
        }
      }
    }

    if (sessionId) {
      const cookieStore = await cookies();
      const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      const currentHash = currentToken ? hashSessionToken(currentToken) : null;
      const target = await query<QueryResultRow & { token_hash: string }>(
        `SELECT token_hash FROM user_sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL LIMIT 1`,
        [sessionId, user.id],
      );
      if (!target.rows[0]) {
        return NextResponse.json({ ok: false, code: "SESSION_NOT_FOUND", message: "ไม่พบ session นี้" }, { status: 404 });
      }

      const revokingCurrent = Boolean(currentHash && target.rows[0].token_hash === currentHash);
      const result = await query(
        `UPDATE user_sessions
         SET revoked_at = COALESCE(revoked_at, now())
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [sessionId, user.id],
      );
      const response = NextResponse.json({ ok: true, revokedSessions: result.rowCount ?? 0, currentSessionRevoked: revokingCurrent });
      if (revokingCurrent) response.cookies.set(SESSION_COOKIE_NAME, "", getSessionCookieOptions(0));
      return response;
    }

    const result = await query(
      `UPDATE user_sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [user.id],
    );

    const response = NextResponse.json({ ok: true, revokedSessions: result.rowCount ?? 0, currentSessionRevoked: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", getSessionCookieOptions(0));
    return response;
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    console.error("Session revocation failed", error);
    return NextResponse.json({ ok: false, code: "SESSION_REVOCATION_FAILED", message: "จัดการ session ไม่สำเร็จ" }, { status: 500 });
  }
}
