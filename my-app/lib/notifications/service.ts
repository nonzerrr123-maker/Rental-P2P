import type { PoolClient, QueryResultRow } from "pg";
import { query } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NotificationSummary = {
  id: string;
  type: string;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationRow = QueryResultRow & {
  id: string;
  type: string;
  title: string;
  body: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  read_at: Date | null;
  created_at: Date;
};

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  idempotent?: boolean;
};

function mapNotification(row: NotificationRow): NotificationSummary {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    readAt: row.read_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createNotification(
  client: PoolClient,
  input: CreateNotificationInput,
): Promise<string | null> {
  const relatedType = input.relatedEntityType?.trim() || null;
  const relatedId = input.relatedEntityId ?? null;
  const idempotentClause = input.idempotent
    ? `AND NOT EXISTS (
         SELECT 1
         FROM notifications n
         WHERE n.user_id = $1
           AND n.type = $2
           AND n.related_entity_type IS NOT DISTINCT FROM $5::text
           AND n.related_entity_id IS NOT DISTINCT FROM $6::uuid
       )`
    : "";

  const result = await client.query<{ id: string } & QueryResultRow>(
    `INSERT INTO notifications (
       user_id,
       type,
       title,
       body,
       related_entity_type,
       related_entity_id
     )
     SELECT $1, $2, $3, $4, $5, $6
     WHERE true ${idempotentClause}
     RETURNING id`,
    [input.userId, input.type.trim(), input.title.trim(), input.body.trim(), relatedType, relatedId],
  );
  return result.rows[0]?.id ?? null;
}

export async function listNotificationsForUser(
  userId: string,
  limit = 50,
): Promise<{ items: NotificationSummary[]; unreadCount: number }> {
  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 50;
  const safeLimit = Math.min(Math.max(requestedLimit, 1), 100);
  const [itemsResult, unreadResult] = await Promise.all([
    query<NotificationRow>(
      `SELECT id, type, title, body, related_entity_type, related_entity_id, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [userId, safeLimit],
    ),
    query<{ count: string } & QueryResultRow>(
      `SELECT count(*)::text AS count
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    ),
  ]);

  return {
    items: itemsResult.rows.map(mapNotification),
    unreadCount: Number(unreadResult.rows[0]?.count ?? 0),
  };
}

export async function getNotificationUnreadCount(userId: string): Promise<number> {
  const result = await query<{ count: string } & QueryResultRow>(
    `SELECT count(*)::text AS count
     FROM notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  if (!UUID_PATTERN.test(notificationId)) return false;
  const result = await query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId],
  );
  return Boolean(result.rowCount);
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await query(
    `UPDATE notifications
     SET read_at = now()
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return result.rowCount ?? 0;
}
