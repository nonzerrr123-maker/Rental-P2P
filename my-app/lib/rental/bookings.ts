import type { PoolClient, QueryResultRow } from "pg";
import { query, withTransaction } from "@/lib/db";

export const RENTAL_PRICING_MODES = ["HOUR", "DAY"] as const;
export type RentalPricingMode = (typeof RENTAL_PRICING_MODES)[number];

export type RentalRequestStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "WAITING_PAYMENT"
  | "PAID"
  | "WAITING_PICKUP"
  | "RENTING"
  | "RETURNING"
  | "RETURNED"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED"
  | "EXPIRED";

export type RentalRequestSummary = {
  id: string;
  item: {
    id: string;
    title: string;
  };
  lender: {
    id: string;
    displayName: string;
  };
  borrower: {
    id: string;
    displayName: string;
  };
  pricingMode: RentalPricingMode;
  startsAt: string;
  endsAt: string;
  unitRate: string;
  durationUnits: string;
  rentalAmount: string;
  depositAmount: string;
  platformFeeAmount: string;
  urgentReservationFeeAmount: string;
  isUrgent: boolean;
  reservationExpiresAt: string | null;
  status: RentalRequestStatus;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RentalRequestLists = {
  incoming: RentalRequestSummary[];
  outgoing: RentalRequestSummary[];
};

export type AvailabilityConflict = {
  startsAt: string;
  endsAt: string;
  kind: "BLOCK" | "BOOKING";
};

export type RentalAvailability = {
  itemId: string;
  from: string;
  to: string;
  available: boolean;
  conflicts: AvailabilityConflict[];
};

type BookingErrorCode =
  | "VALIDATION_ERROR"
  | "ITEM_NOT_FOUND"
  | "LISTING_UNAVAILABLE"
  | "SELF_RENTAL_NOT_ALLOWED"
  | "AVAILABILITY_CONFLICT"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_NOT_DECIDABLE"
  | "FORBIDDEN";

export class BookingError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    public readonly code: BookingErrorCode,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "BookingError";
  }
}

type ItemBookingRow = QueryResultRow & {
  id: string;
  owner_id: string;
  title: string;
  status: "ACTIVE" | "PAUSED" | "UNAVAILABLE" | "ARCHIVED";
  hourly_rate: string | null;
  daily_rate: string | null;
  minimum_hours: number;
  deposit_amount: string;
  owner_active: boolean;
};

type RequestRow = QueryResultRow & {
  id: string;
  item_id: string;
  item_title: string;
  lender_id: string;
  lender_display_name: string;
  borrower_id: string;
  borrower_display_name: string;
  pricing_mode: RentalPricingMode;
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

type AvailabilityRow = QueryResultRow & {
  starts_at: Date;
  ends_at: Date;
  kind: "BLOCK" | "BOOKING";
};

const ACTIVE_BOOKING_STATUSES: RentalRequestStatus[] = [
  "ACCEPTED",
  "WAITING_PAYMENT",
  "PAID",
  "WAITING_PICKUP",
  "RENTING",
  "RETURNING",
  "DISPUTED",
];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function requireUuid(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) {
    throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", {
      [field]: "รหัสรายการไม่ถูกต้อง",
    });
  }
  return text;
}

function requireInstant(value: unknown, field: string): Date {
  const text = typeof value === "string" ? value.trim() : "";
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) {
    throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", {
      [field]: "วันเวลาไม่ถูกต้อง",
    });
  }
  return date;
}

function requirePricingMode(value: unknown): RentalPricingMode {
  const mode = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!RENTAL_PRICING_MODES.includes(mode as RentalPricingMode)) {
    throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", {
      pricingMode: "รูปแบบราคาต้องเป็น HOUR หรือ DAY",
    });
  }
  return mode as RentalPricingMode;
}

function assertDateRange(startsAt: Date, endsAt: Date, requireFuture: boolean): void {
  const errors: Record<string, string> = {};
  if (endsAt.getTime() <= startsAt.getTime()) {
    errors.endsAt = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
  }
  if (requireFuture && startsAt.getTime() < Date.now() - 60_000) {
    errors.startsAt = "เวลาเริ่มยืมต้องไม่อยู่ในอดีต";
  }
  if (endsAt.getTime() - startsAt.getTime() > 90 * DAY_MS) {
    errors.endsAt = "ช่วงเวลายืมต้องไม่เกิน 90 วันต่อคำขอ";
  }
  if (Object.keys(errors).length > 0) {
    throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", errors);
  }
}

function moneyFromRate(rate: string, units: number): string {
  const rateCents = Math.round(Number(rate) * 100);
  const totalCents = Math.round(rateCents * units);
  return (totalCents / 100).toFixed(2);
}

function calculateDurationUnits(mode: RentalPricingMode, startsAt: Date, endsAt: Date): number {
  const diff = endsAt.getTime() - startsAt.getTime();
  return mode === "HOUR" ? Math.ceil(diff / HOUR_MS) : Math.ceil(diff / DAY_MS);
}

async function getItemForBooking(client: PoolClient, itemId: string): Promise<ItemBookingRow> {
  const result = await client.query<ItemBookingRow>(
    `SELECT
       i.id,
       i.owner_id,
       i.title,
       i.status,
       i.hourly_rate,
       i.daily_rate,
       i.minimum_hours,
       i.deposit_amount,
       u.is_active AS owner_active
     FROM rental_items i
     JOIN users u ON u.id = i.owner_id
     WHERE i.id = $1
     FOR UPDATE OF i`,
    [itemId],
  );
  const item = result.rows[0];
  if (!item) throw new BookingError(404, "ITEM_NOT_FOUND", "Rental item not found");
  if (item.status !== "ACTIVE" || !item.owner_active) {
    throw new BookingError(409, "LISTING_UNAVAILABLE", "Rental item is not currently available");
  }
  return item;
}

async function hasConflictingAvailability(
  client: PoolClient,
  itemId: string,
  startsAt: Date,
  endsAt: Date,
  excludeRequestId?: string,
): Promise<boolean> {
  const blocked = await client.query(
    `SELECT 1
     FROM item_availability_blocks
     WHERE item_id = $1
       AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
     LIMIT 1`,
    [itemId, startsAt.toISOString(), endsAt.toISOString()],
  );
  if (blocked.rowCount) return true;

  const active = await client.query(
    `SELECT 1
     FROM rental_requests
     WHERE item_id = $1
       AND status = ANY($4::rental_status[])
       AND ($5::uuid IS NULL OR id <> $5::uuid)
       AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
     LIMIT 1`,
    [itemId, startsAt.toISOString(), endsAt.toISOString(), ACTIVE_BOOKING_STATUSES, excludeRequestId ?? null],
  );
  return Boolean(active.rowCount);
}

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

async function getRequestWithClient(client: PoolClient, requestId: string): Promise<RentalRequestSummary> {
  const result = await client.query<RequestRow>(`${requestSelect} WHERE r.id = $1 LIMIT 1`, [requestId]);
  const row = result.rows[0];
  if (!row) throw new BookingError(404, "REQUEST_NOT_FOUND", "Rental request not found");
  return mapRequest(row);
}

export async function getRentalAvailability(
  itemIdInput: unknown,
  fromInput: unknown,
  toInput: unknown,
): Promise<RentalAvailability> {
  const itemId = requireUuid(itemIdInput, "itemId");
  const from = requireInstant(fromInput, "from");
  const to = requireInstant(toInput, "to");
  assertDateRange(from, to, false);

  const item = await query<{ id: string } & QueryResultRow>(
    `SELECT i.id
     FROM rental_items i
     JOIN users u ON u.id = i.owner_id
     WHERE i.id = $1 AND i.status = 'ACTIVE' AND u.is_active = true
     LIMIT 1`,
    [itemId],
  );
  if (!item.rows[0]) throw new BookingError(404, "ITEM_NOT_FOUND", "Rental item not found");

  const conflicts = await query<AvailabilityRow>(
    `SELECT starts_at, ends_at, kind
     FROM (
       SELECT starts_at, ends_at, 'BLOCK'::text AS kind
       FROM item_availability_blocks
       WHERE item_id = $1
         AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
       UNION ALL
       SELECT starts_at, ends_at, 'BOOKING'::text AS kind
       FROM rental_requests
       WHERE item_id = $1
         AND status = ANY($4::rental_status[])
         AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
     ) conflicts
     ORDER BY starts_at ASC`,
    [itemId, from.toISOString(), to.toISOString(), ACTIVE_BOOKING_STATUSES],
  );

  return {
    itemId,
    from: from.toISOString(),
    to: to.toISOString(),
    available: conflicts.rows.length === 0,
    conflicts: conflicts.rows.map((row) => ({
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      kind: row.kind,
    })),
  };
}

export async function createRentalRequest(borrowerId: string, input: unknown): Promise<RentalRequestSummary> {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const itemId = requireUuid(body.itemId, "itemId");
  const pricingMode = requirePricingMode(body.pricingMode);
  const startsAt = requireInstant(body.startsAt, "startsAt");
  const endsAt = requireInstant(body.endsAt, "endsAt");
  assertDateRange(startsAt, endsAt, true);

  return withTransaction(async (client) => {
    const item = await getItemForBooking(client, itemId);
    if (item.owner_id === borrowerId) {
      throw new BookingError(409, "SELF_RENTAL_NOT_ALLOWED", "You cannot rent your own listing");
    }

    const rate = pricingMode === "HOUR" ? item.hourly_rate : item.daily_rate;
    if (!rate) {
      throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", {
        pricingMode: pricingMode === "HOUR" ? "รายการนี้ไม่มีราคารายชั่วโมง" : "รายการนี้ไม่มีราคารายวัน",
      });
    }

    const durationUnits = calculateDurationUnits(pricingMode, startsAt, endsAt);
    if (pricingMode === "HOUR" && durationUnits < item.minimum_hours) {
      throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", {
        duration: `รายการนี้ต้องยืมอย่างน้อย ${item.minimum_hours} ชั่วโมง`,
      });
    }
    if (durationUnits < 1) {
      throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", {
        duration: "ระยะเวลายืมไม่ถูกต้อง",
      });
    }

    if (await hasConflictingAvailability(client, item.id, startsAt, endsAt)) {
      throw new BookingError(409, "AVAILABILITY_CONFLICT", "The selected rental period is unavailable");
    }

    const rentalAmount = moneyFromRate(rate, durationUnits);
    const inserted = await client.query<{ id: string } & QueryResultRow>(
      `INSERT INTO rental_requests (
         item_id,
         lender_id,
         borrower_id,
         pricing_mode,
         starts_at,
         ends_at,
         unit_rate,
         duration_units,
         rental_amount,
         deposit_amount,
         platform_fee_amount,
         urgent_reservation_fee_amount,
         is_urgent,
         status
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0, false, 'REQUESTED'
       )
       RETURNING id`,
      [
        item.id,
        item.owner_id,
        borrowerId,
        pricingMode,
        startsAt.toISOString(),
        endsAt.toISOString(),
        rate,
        durationUnits.toFixed(2),
        rentalAmount,
        item.deposit_amount,
      ],
    );

    return getRequestWithClient(client, inserted.rows[0].id);
  });
}

export async function listRentalRequestsForUser(userId: string): Promise<RentalRequestLists> {
  const result = await query<RequestRow>(
    `${requestSelect}
     WHERE r.borrower_id = $1 OR r.lender_id = $1
     ORDER BY r.created_at DESC
     LIMIT 100`,
    [userId],
  );
  const all = result.rows.map(mapRequest);
  return {
    incoming: all.filter((request) => request.lender.id === userId),
    outgoing: all.filter((request) => request.borrower.id === userId),
  };
}

function isExclusionViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23P01");
}

export async function decideRentalRequest(
  lenderId: string,
  requestIdInput: unknown,
  decisionInput: unknown,
): Promise<RentalRequestSummary> {
  const requestId = requireUuid(requestIdInput, "requestId");
  const decision = typeof decisionInput === "string" ? decisionInput.trim().toUpperCase() : "";
  if (decision !== "ACCEPT" && decision !== "REJECT") {
    throw new BookingError(400, "VALIDATION_ERROR", "Decision is invalid", {
      decision: "decision ต้องเป็น ACCEPT หรือ REJECT",
    });
  }

  try {
    return await withTransaction(async (client) => {
      const locked = await client.query<
        QueryResultRow & {
          id: string;
          item_id: string;
          lender_id: string;
          starts_at: Date;
          ends_at: Date;
          status: RentalRequestStatus;
          item_status: string;
          owner_active: boolean;
        }
      >(
        `SELECT
           r.id,
           r.item_id,
           r.lender_id,
           r.starts_at,
           r.ends_at,
           r.status,
           i.status AS item_status,
           owner.is_active AS owner_active
         FROM rental_requests r
         JOIN rental_items i ON i.id = r.item_id
         JOIN users owner ON owner.id = i.owner_id
         WHERE r.id = $1
         FOR UPDATE OF r`,
        [requestId],
      );
      const request = locked.rows[0];
      if (!request) throw new BookingError(404, "REQUEST_NOT_FOUND", "Rental request not found");
      if (request.lender_id !== lenderId) {
        throw new BookingError(403, "FORBIDDEN", "Only the listing owner can decide this request");
      }
      if (request.status !== "REQUESTED") {
        throw new BookingError(409, "REQUEST_NOT_DECIDABLE", "This rental request has already been decided");
      }

      if (decision === "REJECT") {
        await client.query(
          `UPDATE rental_requests
           SET status = 'REJECTED', rejected_at = now(), updated_at = now()
           WHERE id = $1`,
          [requestId],
        );
        return getRequestWithClient(client, requestId);
      }

      if (request.item_status !== "ACTIVE" || !request.owner_active) {
        throw new BookingError(409, "LISTING_UNAVAILABLE", "Rental item is not currently available");
      }
      if (await hasConflictingAvailability(client, request.item_id, request.starts_at, request.ends_at, request.id)) {
        throw new BookingError(409, "AVAILABILITY_CONFLICT", "Another accepted rental blocks this period");
      }

      await client.query(
        `UPDATE rental_requests
         SET status = 'WAITING_PAYMENT', accepted_at = now(), updated_at = now()
         WHERE id = $1`,
        [requestId],
      );
      return getRequestWithClient(client, requestId);
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new BookingError(409, "AVAILABILITY_CONFLICT", "Another accepted rental blocks this period");
    }
    throw error;
  }
}
