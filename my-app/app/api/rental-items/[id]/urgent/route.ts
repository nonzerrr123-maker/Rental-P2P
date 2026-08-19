import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import {
  assertResourceOwner,
  authorizationErrorResponse,
  requireVerifiedUser,
} from "@/lib/auth/authorization";
import { query } from "@/lib/db";
import { URGENT_RESERVATION_FEE_RATE_DB } from "@/lib/rental/fees";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ItemOwnerRow = QueryResultRow & { owner_id: string };
type UpdatedRow = QueryResultRow & {
  id: string;
  urgent_enabled: boolean;
  urgent_reservation_fee_rate: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Rental item not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 });
    }
    const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (typeof input.enabled !== "boolean") {
      return NextResponse.json({ ok: false, code: "VALIDATION_ERROR", message: "enabled must be boolean" }, { status: 400 });
    }

    const owner = await query<ItemOwnerRow>("SELECT owner_id FROM rental_items WHERE id = $1 LIMIT 1", [id]);
    if (!owner.rows[0]) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Rental item not found" }, { status: 404 });
    }
    assertResourceOwner(user, owner.rows[0].owner_id);

    const updated = await query<UpdatedRow>(
      `UPDATE rental_items
       SET urgent_enabled = $2,
           urgent_reservation_fee_rate = $3::numeric,
           updated_at = now()
       WHERE id = $1
       RETURNING id, urgent_enabled, urgent_reservation_fee_rate`,
      [id, input.enabled, URGENT_RESERVATION_FEE_RATE_DB],
    );
    const item = updated.rows[0];
    return NextResponse.json({
      ok: true,
      item: {
        id: item.id,
        urgentEnabled: item.urgent_enabled,
        urgentReservationFeeRate: item.urgent_reservation_fee_rate,
      },
    });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to update urgent listing availability", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to update urgent availability" }, { status: 500 });
  }
}
