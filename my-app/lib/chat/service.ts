import type { PoolClient, QueryResultRow } from "pg";
import { query, withTransaction } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGE_MAX_LENGTH = 2000;
const WRITABLE_RENTAL_STATUSES = [
  "REQUESTED",
  "ACCEPTED",
  "WAITING_PAYMENT",
  "PAID",
  "WAITING_PICKUP",
  "RENTING",
  "RETURNING",
  "RETURNED",
  "DISPUTED",
] as const;

export class ChatError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    public readonly code: "VALIDATION_ERROR" | "CONVERSATION_NOT_FOUND" | "FORBIDDEN" | "CHAT_CLOSED",
    message: string,
  ) {
    super(message);
    this.name = "ChatError";
  }
}

export type ConversationSummary = {
  id: string;
  rentalRequestId: string;
  rentalStatus: string;
  isUrgent: boolean;
  item: { id: string; title: string };
  counterpart: { id: string; displayName: string };
  lastMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  sender: { id: string; displayName: string };
  body: string;
  createdAt: string;
  readByOtherAt: string | null;
};

type ConversationAccessRow = QueryResultRow & {
  id: string;
  rental_request_id: string;
  rental_status: string;
  borrower_id: string;
  lender_id: string;
  participant: boolean;
};

type ConversationRow = QueryResultRow & {
  id: string;
  rental_request_id: string;
  rental_status: string;
  is_urgent: boolean;
  item_id: string;
  item_title: string;
  counterpart_id: string;
  counterpart_display_name: string;
  last_message_body: string | null;
  last_message_at: Date | null;
  unread_count: string;
  updated_at: Date;
};

type MessageRow = QueryResultRow & {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_display_name: string;
  body: string;
  created_at: Date;
  read_by_other_at: Date | null;
};

function requireUuid(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) {
    throw new ChatError(400, "VALIDATION_ERROR", `${field} is invalid`);
  }
  return text;
}

function mapConversation(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    rentalRequestId: row.rental_request_id,
    rentalStatus: row.rental_status,
    isUrgent: row.is_urgent,
    item: { id: row.item_id, title: row.item_title },
    counterpart: { id: row.counterpart_id, displayName: row.counterpart_display_name },
    lastMessage: row.last_message_at && row.last_message_body !== null
      ? { body: row.last_message_body, createdAt: row.last_message_at.toISOString() }
      : null,
    unreadCount: Number(row.unread_count),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: { id: row.sender_id, displayName: row.sender_display_name },
    body: row.body,
    createdAt: row.created_at.toISOString(),
    readByOtherAt: row.read_by_other_at?.toISOString() ?? null,
  };
}

export async function ensureConversationForRentalRequest(
  client: PoolClient,
  rentalRequestId: string,
  lenderId: string,
  borrowerId: string,
): Promise<string> {
  const inserted = await client.query<{ id: string } & QueryResultRow>(
    `INSERT INTO conversations (rental_request_id)
     VALUES ($1)
     ON CONFLICT (rental_request_id)
     DO UPDATE SET rental_request_id = EXCLUDED.rental_request_id
     RETURNING id`,
    [rentalRequestId],
  );
  const conversationId = inserted.rows[0].id;
  await client.query(
    `INSERT INTO conversation_participants (conversation_id, user_id)
     VALUES ($1, $2), ($1, $3)
     ON CONFLICT DO NOTHING`,
    [conversationId, lenderId, borrowerId],
  );
  return conversationId;
}

async function backfillConversationsForUser(client: PoolClient, userId: string): Promise<void> {
  const requests = await client.query<
    QueryResultRow & { id: string; lender_id: string; borrower_id: string }
  >(
    `SELECT id, lender_id, borrower_id
     FROM rental_requests
     WHERE lender_id = $1 OR borrower_id = $1`,
    [userId],
  );
  for (const request of requests.rows) {
    await ensureConversationForRentalRequest(client, request.id, request.lender_id, request.borrower_id);
  }
}

async function getConversationAccess(
  client: PoolClient,
  conversationIdInput: unknown,
  userId: string,
): Promise<ConversationAccessRow> {
  const conversationId = requireUuid(conversationIdInput, "conversationId");
  const result = await client.query<ConversationAccessRow>(
    `SELECT
       c.id,
       c.rental_request_id,
       r.status::text AS rental_status,
       r.borrower_id,
       r.lender_id,
       EXISTS (
         SELECT 1 FROM conversation_participants cp
         WHERE cp.conversation_id = c.id AND cp.user_id = $2
       ) AS participant
     FROM conversations c
     JOIN rental_requests r ON r.id = c.rental_request_id
     WHERE c.id = $1
     LIMIT 1`,
    [conversationId, userId],
  );
  const row = result.rows[0];
  if (!row) throw new ChatError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
  if (!row.participant) throw new ChatError(403, "FORBIDDEN", "You are not a participant in this conversation");
  return row;
}

export async function listConversationsForUser(userId: string): Promise<ConversationSummary[]> {
  return withTransaction(async (client) => {
    await backfillConversationsForUser(client, userId);
    const result = await client.query<ConversationRow>(
      `SELECT
         c.id,
         c.rental_request_id,
         r.status::text AS rental_status,
         r.is_urgent,
         i.id AS item_id,
         i.title AS item_title,
         CASE WHEN r.borrower_id = $1 THEN r.lender_id ELSE r.borrower_id END AS counterpart_id,
         counterpart.display_name AS counterpart_display_name,
         last_message.body AS last_message_body,
         last_message.created_at AS last_message_at,
         COALESCE(unread.count, 0)::text AS unread_count,
         GREATEST(c.updated_at, COALESCE(last_message.created_at, c.updated_at)) AS updated_at
       FROM conversations c
       JOIN conversation_participants mine ON mine.conversation_id = c.id AND mine.user_id = $1
       JOIN rental_requests r ON r.id = c.rental_request_id
       JOIN rental_items i ON i.id = r.item_id
       JOIN users counterpart ON counterpart.id = CASE WHEN r.borrower_id = $1 THEN r.lender_id ELSE r.borrower_id END
       LEFT JOIN LATERAL (
         SELECT m.body, m.created_at
         FROM messages m
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 1
       ) last_message ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS count
         FROM messages m
         WHERE m.conversation_id = c.id
           AND m.sender_id <> $1
           AND NOT EXISTS (
             SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = $1
           )
       ) unread ON true
       ORDER BY GREATEST(c.updated_at, COALESCE(last_message.created_at, c.updated_at)) DESC, c.id DESC
       LIMIT 100`,
      [userId],
    );
    return result.rows.map(mapConversation);
  });
}

export async function getChatUnreadCount(userId: string): Promise<number> {
  const result = await query<{ count: string } & QueryResultRow>(
    `SELECT count(*)::text AS count
     FROM messages m
     JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = $1
     WHERE m.sender_id <> $1
       AND NOT EXISTS (
         SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = $1
       )`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function listMessages(
  userId: string,
  conversationIdInput: unknown,
  options: { before?: unknown; after?: unknown; limit?: number } = {},
): Promise<{ items: ChatMessage[]; hasMore: boolean }> {
  return withTransaction(async (client) => {
    const access = await getConversationAccess(client, conversationIdInput, userId);
    if (options.before && options.after) {
      throw new ChatError(400, "VALIDATION_ERROR", "Use either before or after cursor, not both");
    }
    const requestedLimit = Number.isFinite(options.limit) ? Math.trunc(options.limit as number) : 50;
    const safeLimit = Math.min(Math.max(requestedLimit, 1), 100);
    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;
    if (options.before || options.after) {
      cursorId = requireUuid(options.before ?? options.after, "cursor");
      const cursor = await client.query<{ created_at: Date } & QueryResultRow>(
        `SELECT created_at FROM messages WHERE id = $1 AND conversation_id = $2 LIMIT 1`,
        [cursorId, access.id],
      );
      if (!cursor.rows[0]) throw new ChatError(400, "VALIDATION_ERROR", "Message cursor is invalid");
      cursorCreatedAt = cursor.rows[0].created_at;
    }

    const isAfter = Boolean(options.after);
    const condition = cursorCreatedAt && cursorId
      ? isAfter
        ? "AND (m.created_at, m.id) > ($2::timestamptz, $3::uuid)"
        : "AND (m.created_at, m.id) < ($2::timestamptz, $3::uuid)"
      : "";
    const values: unknown[] = [access.id];
    if (cursorCreatedAt && cursorId) values.push(cursorCreatedAt.toISOString(), cursorId);
    values.push(safeLimit + 1);
    const limitIndex = values.length;
    const result = await client.query<MessageRow>(
      `SELECT
         m.id,
         m.conversation_id,
         m.sender_id,
         sender.display_name AS sender_display_name,
         m.body,
         m.created_at,
         (
           SELECT min(mr.read_at)
           FROM message_reads mr
           WHERE mr.message_id = m.id AND mr.user_id <> m.sender_id
         ) AS read_by_other_at
       FROM messages m
       JOIN users sender ON sender.id = m.sender_id
       WHERE m.conversation_id = $1
         ${condition}
       ORDER BY m.created_at ${isAfter ? "ASC" : "DESC"}, m.id ${isAfter ? "ASC" : "DESC"}
       LIMIT $${limitIndex}`,
      values,
    );
    const hasMore = result.rows.length > safeLimit;
    const sliced = result.rows.slice(0, safeLimit);
    const ordered = isAfter ? sliced : sliced.reverse();
    return { items: ordered.map(mapMessage), hasMore };
  });
}

export async function sendMessage(
  userId: string,
  conversationIdInput: unknown,
  bodyInput: unknown,
): Promise<ChatMessage> {
  const body = typeof bodyInput === "string" ? bodyInput.trim() : "";
  if (!body || body.length > MESSAGE_MAX_LENGTH) {
    throw new ChatError(400, "VALIDATION_ERROR", `Message must be between 1 and ${MESSAGE_MAX_LENGTH} characters`);
  }

  return withTransaction(async (client) => {
    const access = await getConversationAccess(client, conversationIdInput, userId);
    if (!WRITABLE_RENTAL_STATUSES.includes(access.rental_status as (typeof WRITABLE_RENTAL_STATUSES)[number])) {
      throw new ChatError(409, "CHAT_CLOSED", "This rental conversation is read-only in its current state");
    }
    const senderResult = await client.query<{ display_name: string } & QueryResultRow>(
      `SELECT display_name FROM users WHERE id = $1 AND is_active = true LIMIT 1`,
      [userId],
    );
    const senderName = senderResult.rows[0]?.display_name ?? "ผู้ใช้";
    const inserted = await client.query<MessageRow>(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, sender_id, $4::text AS sender_display_name, body, created_at, NULL::timestamptz AS read_by_other_at`,
      [access.id, userId, body, senderName],
    );
    const message = inserted.rows[0];
    await client.query(
      `INSERT INTO message_reads (message_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [message.id, userId],
    );
    await client.query(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [access.id]);

    const recipientId = access.borrower_id === userId ? access.lender_id : access.borrower_id;
    await createNotification(client, {
      userId: recipientId,
      type: "NEW_MESSAGE",
      title: `ข้อความใหม่จาก ${senderName}`,
      body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
      relatedEntityType: "MESSAGE",
      relatedEntityId: message.id,
      idempotent: true,
    });
    return mapMessage(message);
  });
}

export async function markConversationRead(userId: string, conversationIdInput: unknown): Promise<number> {
  return withTransaction(async (client) => {
    const access = await getConversationAccess(client, conversationIdInput, userId);
    const result = await client.query(
      `INSERT INTO message_reads (message_id, user_id)
       SELECT m.id, $2
       FROM messages m
       WHERE m.conversation_id = $1 AND m.sender_id <> $2
       ON CONFLICT DO NOTHING`,
      [access.id, userId],
    );
    return result.rowCount ?? 0;
  });
}
