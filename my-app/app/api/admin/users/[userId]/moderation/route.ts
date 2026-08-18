import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { z } from "zod";
import { authorizationErrorResponse, requireSuperadmin } from "@/lib/auth/authorization";
import { withTransaction } from "@/lib/db";
import { userModerationSchema } from "@/lib/forms/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const userIdSchema = z.string().uuid();

type TargetUserRow = QueryResultRow & {
  id: string;
  display_name: string;
  email: string;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  is_active: boolean;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const actor = await requireSuperadmin();
    const { userId: rawUserId } = await params;
    const userId = userIdSchema.safeParse(rawUserId);
    if (!userId.success) {
      return NextResponse.json({ ok: false, code: "INVALID_USER_ID", message: "User ID ไม่ถูกต้อง" }, { status: 400 });
    }
    if (userId.data === actor.id) {
      return NextResponse.json({ ok: false, code: "SELF_MODERATION_FORBIDDEN", message: "ไม่สามารถแบนบัญชี Superadmin ที่กำลังใช้งานอยู่ได้" }, { status: 409 });
    }

    const parsed = userModerationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "INVALID_MODERATION", message: parsed.error.issues[0]?.message ?? "คำสั่งไม่ถูกต้อง" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const targetResult = await client.query<TargetUserRow>(
        `SELECT id, display_name, email, role::text, is_active
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [userId.data],
      );
      const target = targetResult.rows[0];
      if (!target) return { kind: "NOT_FOUND" as const };
      if (target.role === "SUPERADMIN") return { kind: "SUPERADMIN_PROTECTED" as const };

      const shouldBeActive = parsed.data.action === "UNBAN";
      if (target.is_active === shouldBeActive) {
        return { kind: "UNCHANGED" as const, target };
      }

      await client.query(`UPDATE users SET is_active = $2 WHERE id = $1`, [target.id, shouldBeActive]);
      let revokedSessions = 0;
      if (!shouldBeActive) {
        const revoked = await client.query(
          `UPDATE user_sessions
           SET revoked_at = COALESCE(revoked_at, now())
           WHERE user_id = $1
             AND revoked_at IS NULL`,
          [target.id],
        );
        revokedSessions = revoked.rowCount ?? 0;
      }

      const auditAction = shouldBeActive ? "USER_UNBANNED" : "USER_BANNED";
      await client.query(
        `INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, details)
         VALUES ($1, $2, 'USER', $3, $4::jsonb)`,
        [actor.id, auditAction, target.id, JSON.stringify({ reason: parsed.data.reason, email: target.email, previousActive: target.is_active, revokedSessions })],
      );

      return { kind: "UPDATED" as const, target, isActive: shouldBeActive, revokedSessions };
    });

    if (result.kind === "NOT_FOUND") {
      return NextResponse.json({ ok: false, code: "USER_NOT_FOUND", message: "ไม่พบผู้ใช้" }, { status: 404 });
    }
    if (result.kind === "SUPERADMIN_PROTECTED") {
      return NextResponse.json({ ok: false, code: "SUPERADMIN_PROTECTED", message: "ไม่อนุญาตให้แก้สถานะบัญชี SUPERADMIN ผ่าน moderation" }, { status: 409 });
    }
    if (result.kind === "UNCHANGED") {
      return NextResponse.json({ ok: true, unchanged: true, user: { id: result.target.id, isActive: result.target.is_active } });
    }

    return NextResponse.json({
      ok: true,
      user: { id: result.target.id, displayName: result.target.display_name, isActive: result.isActive },
      revokedSessions: result.revokedSessions,
    });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    console.error("Superadmin user moderation failed", error);
    return NextResponse.json({ ok: false, code: "USER_MODERATION_FAILED", message: "จัดการสถานะผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  }
}
