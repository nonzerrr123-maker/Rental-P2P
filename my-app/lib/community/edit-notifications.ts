import type { QueryResultRow } from "pg";
import { withTransaction } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";
import type { CommunityRequestRecord } from "@/lib/community/service";

function changed(a: string | null | boolean, b: string | null | boolean): boolean {
  return a !== b;
}

export function communityEditHasMaterialChanges(before: CommunityRequestRecord, after: CommunityRequestRecord): boolean {
  return changed(before.title, after.title)
    || changed(before.category, after.category)
    || changed(before.province, after.province)
    || changed(before.district, after.district)
    || changed(before.subdistrict, after.subdistrict)
    || changed(before.neededStartsAt, after.neededStartsAt)
    || changed(before.neededEndsAt, after.neededEndsAt)
    || changed(before.targetPrice, after.targetPrice)
    || changed(before.isUrgent, after.isUrgent);
}

export async function notifyPendingLendersAboutCommunityEdit(
  before: CommunityRequestRecord,
  after: CommunityRequestRecord,
): Promise<number> {
  if (!communityEditHasMaterialChanges(before, after)) return 0;

  return withTransaction(async (client) => {
    const lenders = await client.query<{ lender_id: string } & QueryResultRow>(
      `SELECT DISTINCT lender_id
       FROM community_offers
       WHERE community_request_id = $1
         AND status = 'PENDING'`,
      [after.id],
    );

    for (const row of lenders.rows) {
      await createNotification(client, {
        userId: row.lender_id,
        type: "COMMUNITY_REQUEST_UPDATED",
        title: "คำขอหาของมีการแก้ไข",
        body: `${after.title} มีการเปลี่ยนรายละเอียดสำคัญ กรุณาตรวจสอบข้อเสนอของคุณอีกครั้ง`,
        relatedEntityType: "COMMUNITY_REQUEST",
        relatedEntityId: after.id,
        idempotent: false,
      });
    }

    return lenders.rows.length;
  });
}
