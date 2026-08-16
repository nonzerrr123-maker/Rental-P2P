import type { PoolClient, QueryResultRow } from "pg";
import { withTransaction } from "@/lib/db";
import { ensureConversationForRentalRequest } from "@/lib/chat/service";
import { createNotification } from "@/lib/notifications/service";

type RentalCommunicationRow = QueryResultRow & {
  id: string;
  item_title: string;
  lender_id: string;
  lender_name: string;
  borrower_id: string;
  borrower_name: string;
  status: string;
  is_urgent: boolean;
  accepted_at: Date | null;
};

async function syncRequest(client: PoolClient, request: RentalCommunicationRow): Promise<void> {
  await ensureConversationForRentalRequest(client, request.id, request.lender_id, request.borrower_id);

  if (request.is_urgent) {
    await createNotification(client, {
      userId: request.lender_id,
      type: "URGENT_RESERVED",
      title: "มีการจองยืมด่วน",
      body: `${request.borrower_name} จอง ${request.item_title} แบบยืมด่วน`,
      relatedEntityType: "RENTAL_REQUEST",
      relatedEntityId: request.id,
      idempotent: true,
    });
    if (request.status === "EXPIRED") {
      const common = {
        type: "URGENT_EXPIRED",
        title: "การจองยืมด่วนหมดอายุ",
        body: `ช่วงเวลาของ ${request.item_title} ถูกปล่อยกลับเข้าสู่ระบบแล้ว`,
        relatedEntityType: "RENTAL_REQUEST",
        relatedEntityId: request.id,
        idempotent: true,
      } as const;
      await createNotification(client, { ...common, userId: request.borrower_id });
      await createNotification(client, { ...common, userId: request.lender_id });
    }
  } else {
    await createNotification(client, {
      userId: request.lender_id,
      type: "RENTAL_REQUESTED",
      title: "มีคำขอยืมใหม่",
      body: `${request.borrower_name} ส่งคำขอยืม ${request.item_title}`,
      relatedEntityType: "RENTAL_REQUEST",
      relatedEntityId: request.id,
      idempotent: true,
    });
    if (request.accepted_at && !["REJECTED", "CANCELLED", "EXPIRED"].includes(request.status)) {
      await createNotification(client, {
        userId: request.borrower_id,
        type: "RENTAL_ACCEPTED",
        title: "คำขอยืมได้รับการตอบรับ",
        body: `${request.lender_name} ตอบรับคำขอยืม ${request.item_title} แล้ว`,
        relatedEntityType: "RENTAL_REQUEST",
        relatedEntityId: request.id,
        idempotent: true,
      });
    }
    if (request.status === "REJECTED") {
      await createNotification(client, {
        userId: request.borrower_id,
        type: "RENTAL_REJECTED",
        title: "คำขอยืมถูกปฏิเสธ",
        body: `${request.lender_name} ปฏิเสธคำขอยืม ${request.item_title}`,
        relatedEntityType: "RENTAL_REQUEST",
        relatedEntityId: request.id,
        idempotent: true,
      });
    }
  }

  if (request.status === "CANCELLED") {
    const common = {
      type: "RENTAL_CANCELLED",
      title: "รายการเช่าถูกยกเลิก",
      body: `${request.item_title} ถูกยกเลิกก่อนเริ่มการเช่า`,
      relatedEntityType: "RENTAL_REQUEST",
      relatedEntityId: request.id,
      idempotent: true,
    } as const;
    await createNotification(client, { ...common, userId: request.borrower_id });
    await createNotification(client, { ...common, userId: request.lender_id });
  }
}

const requestSelect = `
  SELECT
    r.id,
    i.title AS item_title,
    r.lender_id,
    lender.display_name AS lender_name,
    r.borrower_id,
    borrower.display_name AS borrower_name,
    r.status::text AS status,
    r.is_urgent,
    r.accepted_at
  FROM rental_requests r
  JOIN rental_items i ON i.id = r.item_id
  JOIN users lender ON lender.id = r.lender_id
  JOIN users borrower ON borrower.id = r.borrower_id
`;

export async function synchronizeRentalRequestCommunication(requestId: string): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query<RentalCommunicationRow>(`${requestSelect} WHERE r.id = $1 LIMIT 1`, [requestId]);
    if (result.rows[0]) await syncRequest(client, result.rows[0]);
  });
}

export async function synchronizeCommunicationForUser(userId: string): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query<RentalCommunicationRow>(
      `${requestSelect}
       WHERE r.lender_id = $1 OR r.borrower_id = $1
       ORDER BY r.created_at DESC
       LIMIT 200`,
      [userId],
    );
    for (const request of result.rows) await syncRequest(client, request);
  });
}
