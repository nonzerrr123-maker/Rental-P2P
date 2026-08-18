import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { z } from "zod";
import { authorizationErrorResponse, requireSuperadmin } from "@/lib/auth/authorization";
import { withTransaction } from "@/lib/db";
import { listingModerationSchema } from "@/lib/forms/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const itemIdSchema = z.string().uuid();

type ListingStatus = "ACTIVE" | "PAUSED" | "UNAVAILABLE" | "ARCHIVED";
type ListingRow = QueryResultRow & {
  id: string;
  title: string;
  owner_id: string;
  status: ListingStatus;
};
type AuditRow = QueryResultRow & {
  action: string;
  details: { previousStatus?: string };
};

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const actor = await requireSuperadmin();
    const { itemId: rawItemId } = await params;
    const itemId = itemIdSchema.safeParse(rawItemId);
    if (!itemId.success) {
      return NextResponse.json({ ok: false, code: "INVALID_ITEM_ID", message: "Item ID ไม่ถูกต้อง" }, { status: 400 });
    }
    const parsed = listingModerationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "INVALID_MODERATION", message: parsed.error.issues[0]?.message ?? "คำสั่งไม่ถูกต้อง" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const listingResult = await client.query<ListingRow>(
        `SELECT id, title, owner_id, status::text
         FROM rental_items
         WHERE id = $1
         FOR UPDATE`,
        [itemId.data],
      );
      const listing = listingResult.rows[0];
      if (!listing) return { kind: "NOT_FOUND" as const };
      if (listing.status === "ARCHIVED") return { kind: "ARCHIVED" as const, listing };

      let nextStatus: ListingStatus;
      if (parsed.data.action === "HIDE") {
        if (listing.status === "PAUSED") return { kind: "OWNER_PAUSED" as const, listing };
        nextStatus = "PAUSED";
      } else {
        if (listing.status !== "PAUSED") return { kind: "NOT_HIDDEN" as const, listing };
        const auditResult = await client.query<AuditRow>(
          `SELECT action, details
           FROM admin_audit_logs
           WHERE target_type = 'RENTAL_ITEM'
             AND target_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [listing.id],
        );
        const audit = auditResult.rows[0];
        if (audit?.action !== "LISTING_HIDDEN") return { kind: "NOT_HIDDEN" as const, listing };
        const previousStatus = audit.details?.previousStatus;
        nextStatus = previousStatus === "UNAVAILABLE" ? "UNAVAILABLE" : "ACTIVE";
      }

      await client.query(`UPDATE rental_items SET status = $2 WHERE id = $1`, [listing.id, nextStatus]);
      await client.query(
        `INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, details)
         VALUES ($1, $2, 'RENTAL_ITEM', $3, $4::jsonb)`,
        [
          actor.id,
          parsed.data.action === "HIDE" ? "LISTING_HIDDEN" : "LISTING_RESTORED",
          listing.id,
          JSON.stringify({ reason: parsed.data.reason, title: listing.title, ownerId: listing.owner_id, previousStatus: listing.status, nextStatus }),
        ],
      );
      return { kind: "UPDATED" as const, listing, nextStatus };
    });

    if (result.kind === "NOT_FOUND") {
      return NextResponse.json({ ok: false, code: "LISTING_NOT_FOUND", message: "ไม่พบประกาศ" }, { status: 404 });
    }
    if (result.kind === "ARCHIVED") {
      return NextResponse.json({ ok: false, code: "ARCHIVED_LISTING", message: "ประกาศที่ถูก Archive แล้วไม่สามารถจัดการผ่าน moderation นี้ได้" }, { status: 409 });
    }
    if (result.kind === "OWNER_PAUSED") {
      return NextResponse.json({ ok: false, code: "OWNER_PAUSED", message: "ประกาศนี้ Pause อยู่แล้วและไม่ได้ถูกซ่อนโดย Superadmin" }, { status: 409 });
    }
    if (result.kind === "NOT_HIDDEN") {
      return NextResponse.json({ ok: false, code: "NOT_ADMIN_HIDDEN", message: "คืนประกาศได้เฉพาะรายการที่ Superadmin เป็นผู้ซ่อนล่าสุด" }, { status: 409 });
    }

    return NextResponse.json({ ok: true, listing: { id: result.listing.id, title: result.listing.title, status: result.nextStatus } });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    console.error("Superadmin listing moderation failed", error);
    return NextResponse.json({ ok: false, code: "LISTING_MODERATION_FAILED", message: "จัดการประกาศไม่สำเร็จ" }, { status: 500 });
  }
}
