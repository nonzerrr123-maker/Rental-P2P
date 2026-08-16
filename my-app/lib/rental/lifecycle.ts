import type { QueryResultRow } from "pg";
import type { AuthUser } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db";
import {
  BookingError,
  decideRentalRequest,
  type RentalRequestStatus,
  type RentalRequestSummary,
} from "@/lib/rental/bookings";
import { expireStaleUrgentReservations } from "@/lib/rental/urgent";

export type RentalLifecycleAction = "ACCEPT" | "REJECT" | "CANCEL";

export const RENTAL_LIFECYCLE: Readonly<Record<RentalRequestStatus, readonly RentalRequestStatus[]>> = {
  REQUESTED: ["WAITING_PAYMENT", "REJECTED", "CANCELLED"],
  ACCEPTED: ["WAITING_PAYMENT", "CANCELLED"],
  REJECTED: [],
  WAITING_PAYMENT: ["PAID", "CANCELLED", "EXPIRED"],
  PAID: ["WAITING_PICKUP", "DISPUTED"],
  WAITING_PICKUP: ["RENTING", "DISPUTED"],
  RENTING: ["RETURNING", "DISPUTED"],
  RETURNING: ["RETURNED", "DISPUTED"],
  RETURNED: ["COMPLETED", "DISPUTED"],
  COMPLETED: [],
  DISPUTED: [],
  CANCELLED: [],
  EXPIRED: [],
};

type LifecycleRow = QueryResultRow & {
  id: string;
  borrower_id: string;
  lender_id: string;
  status: RentalRequestStatus;
  is_urgent: boolean;
  reservation_expires_at: Date | null;
};

type RequestRow = QueryResultRow & {
  id: string;
  item_id: string;
  item_title: string;
  lender_id: string;
  lender_display_name: string;
  borrower_id: string;
  borrower_display_name: string;
  pricing_mode: "HOUR" | "DAY";
  starts_at: Date;
  ends_at: Date;
  unit_rate: string;
  duration_units: string;
  rental_amount: string;
  deposit_amount: string;
  platform_fee_amount: string;
  urgent_reservation_fee_amount: string;
  is_urgent: boolean;
  reservation_expires_at: Date | null;
  status: RentalRequestStatus;
  accepted_at: Date | null;
  rejected_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const requestSelect = `
  SELECT
    r.id,
    r.item_id,
    i.title AS item_title,
    r.lender_id,
    lender.display_name AS lender_display_name,
    r.borrower_id,
    borrower.display_name AS borrower_display_name,
    r.pricing_mode,
    r.starts_at,
    r.ends_at,
    r.unit_rate,
    r.duration_units,
    r.rental_amount,
    r.deposit_amount,
    r.platform_fee_amount,
    r.urgent_reservation_fee_amount,
    r.is_urgent,
    r.reservation_expires_at,
    r.status,
    r.accepted_at,
    r.rejected_at,
    r.created_at,
    r.updated_at
  FROM rental_requests r
  JOIN rental_items i ON i.id = r.item_id
  JOIN users lender ON lender.id = r.lender_id
  JOIN users borrower ON borrower.id = r.borrower_id
`;

function mapRequest(row: RequestRow): RentalRequestSummary {
  return {
    id: row.id,
    item: { id: row.item_id, title: row.item_title },
    lender: { id: row.lender_id, displayName: row.lender_display_name },
    borrower: { id: row.borrower_id, displayName: row.borrower_display_name },
    pricingMode: row.pricing_mode,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    unitRate: row.unit_rate,
    durationUnits: row.duration_units,
    rentalAmount: row.rental_amount,
    depositAmount: row.deposit_amount,
    platformFeeAmount: row.platform_fee_amount,
    urgentReservationFeeAmount: row.urgent_reservation_fee_amount,
    isUrgent: row.is_urgent,
    reservationExpiresAt: row.reservation_expires_at?.toISOString() ?? null,
    status: row.status,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    rejectedAt: row.rejected_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isAdmin(user: AuthUser): boolean {
  return user.role === "ADMIN" || user.role === "SUPERADMIN";
}

function requireAction(value: unknown): RentalLifecycleAction {
  const action = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (action !== "ACCEPT" && action !== "REJECT" && action !== "CANCEL") {
    throw new BookingError(400, "VALIDATION_ERROR", "Rental action is invalid", {
      action: "action ต้องเป็น ACCEPT, REJECT หรือ CANCEL",
    });
  }
  return action;
}

export async function applyRentalLifecycleAction(
  actor: AuthUser,
  requestId: string,
  actionInput: unknown,
): Promise<RentalRequestSummary> {
  const action = requireAction(actionInput);
  await expireStaleUrgentReservations();

  if (action === "ACCEPT" || action === "REJECT") {
    return decideRentalRequest(actor.id, requestId, action);
  }

  return withTransaction(async (client) => {
    const locked = await client.query<LifecycleRow>(
      `SELECT id, borrower_id, lender_id, status, is_urgent, reservation_expires_at
       FROM rental_requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId],
    );
    const request = locked.rows[0];
    if (!request) throw new BookingError(404, "REQUEST_NOT_FOUND", "Rental request not found");

    const borrowerCanCancel = request.borrower_id === actor.id && (request.status === "REQUESTED" || request.status === "WAITING_PAYMENT");
    const lenderCanCancel = request.lender_id === actor.id && request.status === "WAITING_PAYMENT";
    const adminCanCancel = isAdmin(actor) && (request.status === "REQUESTED" || request.status === "WAITING_PAYMENT");
    if (!borrowerCanCancel && !lenderCanCancel && !adminCanCancel) {
      const participant = request.borrower_id === actor.id || request.lender_id === actor.id || isAdmin(actor);
      if (!participant) throw new BookingError(403, "FORBIDDEN", "You cannot change this rental request");
      throw new BookingError(409, "REQUEST_NOT_DECIDABLE", "This rental request cannot be cancelled in its current state");
    }

    await client.query(
      `UPDATE rental_requests
       SET status = 'CANCELLED', cancelled_at = now(), updated_at = now()
       WHERE id = $1`,
      [requestId],
    );
    const result = await client.query<RequestRow>(`${requestSelect} WHERE r.id = $1 LIMIT 1`, [requestId]);
    return mapRequest(result.rows[0]);
  });
}

export async function expireUrgentReservationsForDashboard(): Promise<number> {
  return expireStaleUrgentReservations();
}
