import type { PoolClient, QueryResultRow } from "pg";
import type { AuthUser } from "@/lib/auth/session";
import { query, withTransaction } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ReviewError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

type RentalReviewRow = QueryResultRow & {
  id: string;
  item_title: string;
  borrower_id: string;
  borrower_name: string;
  lender_id: string;
  lender_name: string;
  status: string;
};

type ReviewRow = QueryResultRow & {
  id: string;
  rental_request_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewee_id: string;
  reviewee_name: string;
  rating: number;
  comment: string | null;
  created_at: Date;
};

export type ReviewSummary = {
  id: string;
  rentalRequestId: string;
  reviewer: { id: string; displayName: string };
  reviewee: { id: string; displayName: string };
  rating: number;
  comment: string | null;
  createdAt: string;
};

export type ReviewContext = {
  rentalRequestId: string;
  itemTitle: string;
  status: string;
  perspective: "BORROWER" | "LENDER";
  reviewee: { id: string; displayName: string };
  existingReview: ReviewSummary | null;
  canReview: boolean;
  blockedReason: string | null;
};

function requireUuid(value: unknown, field = "rentalRequestId"): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) throw new ReviewError(400, "VALIDATION_ERROR", "Invalid identifier", { [field]: "รหัสรายการไม่ถูกต้อง" });
  return text;
}

function mapReview(row: ReviewRow): ReviewSummary {
  return {
    id: row.id,
    rentalRequestId: row.rental_request_id,
    reviewer: { id: row.reviewer_id, displayName: row.reviewer_name },
    reviewee: { id: row.reviewee_id, displayName: row.reviewee_name },
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at.toISOString(),
  };
}

async function loadRental(client: PoolClient, rentalRequestId: string, lock = false): Promise<RentalReviewRow> {
  const result = await client.query<RentalReviewRow>(
    `SELECT r.id, i.title AS item_title,
            r.borrower_id, borrower.display_name AS borrower_name,
            r.lender_id, lender.display_name AS lender_name,
            r.status::text AS status
     FROM rental_requests r
     JOIN rental_items i ON i.id = r.item_id
     JOIN users borrower ON borrower.id = r.borrower_id
     JOIN users lender ON lender.id = r.lender_id
     WHERE r.id = $1
     LIMIT 1${lock ? " FOR UPDATE OF r" : ""}`,
    [rentalRequestId],
  );
  const rental = result.rows[0];
  if (!rental) throw new ReviewError(404, "RENTAL_NOT_FOUND", "Rental not found");
  return rental;
}

function perspective(actor: AuthUser, rental: RentalReviewRow): "BORROWER" | "LENDER" {
  if (actor.id === rental.borrower_id) return "BORROWER";
  if (actor.id === rental.lender_id) return "LENDER";
  throw new ReviewError(403, "FORBIDDEN", "Only rental participants can review each other");
}

async function findExistingReview(client: PoolClient, rentalRequestId: string, reviewerId: string): Promise<ReviewSummary | null> {
  const result = await client.query<ReviewRow>(
    `SELECT rv.id, rv.rental_request_id, rv.reviewer_id, reviewer.display_name AS reviewer_name,
            rv.reviewee_id, reviewee.display_name AS reviewee_name, rv.rating, rv.comment, rv.created_at
     FROM reviews rv
     JOIN users reviewer ON reviewer.id = rv.reviewer_id
     JOIN users reviewee ON reviewee.id = rv.reviewee_id
     WHERE rv.rental_request_id = $1 AND rv.reviewer_id = $2
     LIMIT 1`,
    [rentalRequestId, reviewerId],
  );
  return result.rows[0] ? mapReview(result.rows[0]) : null;
}

async function hasUnresolvedDispute(client: PoolClient, rentalRequestId: string): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM disputes
     WHERE rental_request_id = $1 AND status IN ('OPEN','UNDER_REVIEW')
     LIMIT 1`,
    [rentalRequestId],
  );
  return Boolean(result.rowCount);
}

export async function getReviewContext(actor: AuthUser, rentalRequestIdInput: unknown): Promise<ReviewContext> {
  const rentalRequestId = requireUuid(rentalRequestIdInput);
  return withTransaction(async (client) => {
    const rental = await loadRental(client, rentalRequestId);
    const role = perspective(actor, rental);
    const existingReview = await findExistingReview(client, rental.id, actor.id);
    const unresolved = await hasUnresolvedDispute(client, rental.id);
    const canReview = rental.status === "COMPLETED" && !unresolved && !existingReview;
    let blockedReason: string | null = null;
    if (existingReview) blockedReason = "คุณส่งรีวิวสำหรับ Rental นี้แล้ว";
    else if (unresolved) blockedReason = "ยังมีข้อพิพาทที่ยังไม่ปิด จึงยังรีวิวไม่ได้";
    else if (rental.status !== "COMPLETED") blockedReason = "รีวิวได้หลัง Rental เสร็จสมบูรณ์เท่านั้น";
    const reviewee = role === "BORROWER"
      ? { id: rental.lender_id, displayName: rental.lender_name }
      : { id: rental.borrower_id, displayName: rental.borrower_name };
    return { rentalRequestId: rental.id, itemTitle: rental.item_title, status: rental.status, perspective: role, reviewee, existingReview, canReview, blockedReason };
  });
}

function validateRating(value: unknown): number {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewError(400, "VALIDATION_ERROR", "Rating must be between 1 and 5", { rating: "คะแนนต้องเป็นจำนวนเต็ม 1–5" });
  }
  return rating;
}

function validateComment(value: unknown): string | null {
  if (value == null) return null;
  const comment = String(value).trim();
  if (!comment) return null;
  if (comment.length > 1500) throw new ReviewError(400, "VALIDATION_ERROR", "Review comment is too long", { comment: "รีวิวต้องไม่เกิน 1,500 ตัวอักษร" });
  return comment;
}

async function refreshRating(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `UPDATE users u
     SET rating_average = stats.average_rating,
         rating_count = stats.rating_count,
         updated_at = now()
     FROM (
       SELECT reviewee_id, round(avg(rating)::numeric, 2) AS average_rating, count(*)::int AS rating_count
       FROM reviews
       WHERE reviewee_id = $1
       GROUP BY reviewee_id
     ) stats
     WHERE u.id = stats.reviewee_id`,
    [userId],
  );
}

export async function createReview(
  actor: AuthUser,
  input: { rentalRequestId?: unknown; rating?: unknown; comment?: unknown },
): Promise<ReviewSummary> {
  const rentalRequestId = requireUuid(input.rentalRequestId);
  const rating = validateRating(input.rating);
  const comment = validateComment(input.comment);

  try {
    return await withTransaction(async (client) => {
      const rental = await loadRental(client, rentalRequestId, true);
      const role = perspective(actor, rental);
      if (rental.status !== "COMPLETED") throw new ReviewError(409, "REVIEW_NOT_ALLOWED", "Rental must be completed before review");
      if (await hasUnresolvedDispute(client, rental.id)) throw new ReviewError(409, "DISPUTE_OPEN", "Resolve the dispute before reviewing");
      const revieweeId = role === "BORROWER" ? rental.lender_id : rental.borrower_id;
      const inserted = await client.query<{ id: string } & QueryResultRow>(
        `INSERT INTO reviews (rental_request_id, reviewer_id, reviewee_id, rating, comment)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id`,
        [rental.id, actor.id, revieweeId, rating, comment],
      );
      await refreshRating(client, revieweeId);
      await createNotification(client, {
        userId: revieweeId,
        type: "REVIEW_RECEIVED",
        title: "คุณได้รับรีวิวใหม่",
        body: `${rental.item_title}: ${actor.displayName} ให้ ${rating}/5 ดาว`,
        relatedEntityType: "RENTAL_REQUEST",
        relatedEntityId: rental.id,
        idempotent: true,
      });
      const result = await client.query<ReviewRow>(
        `SELECT rv.id, rv.rental_request_id, rv.reviewer_id, reviewer.display_name AS reviewer_name,
                rv.reviewee_id, reviewee.display_name AS reviewee_name, rv.rating, rv.comment, rv.created_at
         FROM reviews rv JOIN users reviewer ON reviewer.id=rv.reviewer_id JOIN users reviewee ON reviewee.id=rv.reviewee_id
         WHERE rv.id=$1`,
        [inserted.rows[0].id],
      );
      return mapReview(result.rows[0]);
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
      throw new ReviewError(409, "REVIEW_ALREADY_EXISTS", "You already reviewed this rental");
    }
    throw error;
  }
}

export async function listReviewsForUser(userIdInput: unknown, limitInput: unknown = 30): Promise<{ items: ReviewSummary[]; average: string; count: number }> {
  const userId = requireUuid(userIdInput, "userId");
  const requested = Number(limitInput);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 100) : 30;
  const result = await query<ReviewRow>(
    `SELECT rv.id, rv.rental_request_id, rv.reviewer_id, reviewer.display_name AS reviewer_name,
            rv.reviewee_id, reviewee.display_name AS reviewee_name, rv.rating, rv.comment, rv.created_at
     FROM reviews rv JOIN users reviewer ON reviewer.id=rv.reviewer_id JOIN users reviewee ON reviewee.id=rv.reviewee_id
     WHERE rv.reviewee_id=$1
     ORDER BY rv.created_at DESC, rv.id DESC LIMIT $2`,
    [userId, limit],
  );
  const stats = await query<{ rating_average: string; rating_count: number } & QueryResultRow>(
    `SELECT rating_average, rating_count FROM users WHERE id=$1 LIMIT 1`, [userId]);
  return { items: result.rows.map(mapReview), average: stats.rows[0]?.rating_average ?? "0.00", count: Number(stats.rows[0]?.rating_count ?? 0) };
}
