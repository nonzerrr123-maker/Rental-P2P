import type { PoolClient, QueryResultRow } from "pg";
import { query, withTransaction } from "@/lib/db";
import {
  BookingError,
  type RentalPricingMode,
  type RentalRequestSummary,
  type RentalRequestStatus,
} from "@/lib/rental/bookings";
import { URGENT_RESERVATION_FEE_RATE_DB } from "@/lib/rental/fees";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_BOOKING_STATUSES: RentalRequestStatus[] = [
  "ACCEPTED",
  "WAITING_PAYMENT",
  "PAID",
  "WAITING_PICKUP",
  "RENTING",
  "RETURNING",
  "DISPUTED",
];

type UrgentItemRow = QueryResultRow & {
  id: string;
  owner_id: string;
  status: "ACTIVE" | "PAUSED" | "UNAVAILABLE" | "ARCHIVED";
  hourly_rate: string | null;
  daily_rate: string | null;
  minimum_hours: number;
  deposit_amount: string;
  urgent_enabled: boolean;
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

function reservationTtlMinutes(): number {
  const raw = process.env.URGENT_RESERVATION_TTL_MINUTES?.trim();
  if (!raw) return 15;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 120) {
    throw new Error("URGENT_RESERVATION_TTL_MINUTES must be an integer between 1 and 120");
  }
  return parsed;
}

function requireUuid(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) {
    throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", { itemId: "รหัสรายการไม่ถูกต้อง" });
  }
  return text;
}

function requireInstant(value: unknown, field: string): Date {
  const text = typeof value === "string" ? value.trim() : "";
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) {
    throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", { [field]: "วันเวลาไม่ถูกต้อง" });
  }
  return date;
}

function requirePricingMode(value: unknown): RentalPricingMode {
  const mode = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (mode !== "HOUR" && mode !== "DAY") {
    throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", { pricingMode: "รูปแบบราคาต้องเป็น HOUR หรือ DAY" });
  }
  return mode;
}

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

function isPgConflict(error: unknown): boolean {
  const code = error && typeof error === "object" && "code" in error
    ? (error as { code?: string }).code
    : undefined;
  return code === "23P01" || code === "40P01";
}

function moneyFromRate(rate: string, units: number): string {
  const cents = Math.round(Number(rate) * 100) * units;
  return (Math.round(cents) / 100).toFixed(2);
}

function feeFromAmount(amount: string, rate: string): string {
  const amountCents = Math.round(Number(amount) * 100);
  const rateUnits = Math.round(Number(rate) * 10_000);
  const feeCents = Math.round((amountCents * rateUnits) / 10_000);
  return (feeCents / 100).toFixed(2);
}

export async function expireStaleUrgentReservations(itemId?: string): Promise<number> {
  const values: unknown[] = [];
  const itemFilter = itemId ? "AND item_id = $1" : "";
  if (itemId) values.push(itemId);
  const result = await query(
    `UPDATE rental_requests
     SET status = 'EXPIRED', updated_at = now()
     WHERE is_urgent = true
       AND status = 'WAITING_PAYMENT'
       AND reservation_expires_at IS NOT NULL
       AND reservation_expires_at <= now()
       ${itemFilter}`,
    values,
  );
  return result.rowCount ?? 0;
}

async function expireStaleUrgentReservationsWithClient(client: PoolClient, itemId: string): Promise<void> {
  await client.query(
    `UPDATE rental_requests
     SET status = 'EXPIRED', updated_at = now()
     WHERE item_id = $1
       AND is_urgent = true
       AND status = 'WAITING_PAYMENT'
       AND reservation_expires_at IS NOT NULL
       AND reservation_expires_at <= now()`,
    [itemId],
  );
}

async function hasConflict(client: PoolClient, itemId: string, startsAt: Date, endsAt: Date): Promise<boolean> {
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
       AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
     LIMIT 1`,
    [itemId, startsAt.toISOString(), endsAt.toISOString(), ACTIVE_BOOKING_STATUSES],
  );
  return Boolean(active.rowCount);
}

export async function createUrgentRentalRequest(borrowerId: string, input: unknown): Promise<RentalRequestSummary> {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const itemId = requireUuid(body.itemId);
  const pricingMode = requirePricingMode(body.pricingMode);
  const startsAt = requireInstant(body.startsAt, "startsAt");
  const endsAt = requireInstant(body.endsAt, "endsAt");
  const diff = endsAt.getTime() - startsAt.getTime();
  if (diff <= 0 || startsAt.getTime() < Date.now() - 60_000 || diff > 90 * DAY_MS) {
    throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", { duration: "ช่วงเวลายืมไม่ถูกต้อง" });
  }

  try {
    return await withTransaction(async (client) => {
      const itemResult = await client.query<UrgentItemRow>(
        `SELECT
           i.id,
           i.owner_id,
           i.status,
           i.hourly_rate,
           i.daily_rate,
           i.minimum_hours,
           i.deposit_amount,
           i.urgent_enabled,
           owner.is_active AS owner_active
         FROM rental_items i
         JOIN users owner ON owner.id = i.owner_id
         WHERE i.id = $1
         FOR UPDATE OF i`,
        [itemId],
      );
      const item = itemResult.rows[0];
      if (!item) throw new BookingError(404, "ITEM_NOT_FOUND", "Rental item not found");
      if (item.status !== "ACTIVE" || !item.owner_active) {
        throw new BookingError(409, "LISTING_UNAVAILABLE", "Rental item is not currently available");
      }
      if (item.owner_id === borrowerId) {
        throw new BookingError(409, "SELF_RENTAL_NOT_ALLOWED", "You cannot rent your own listing");
      }
      if (!item.urgent_enabled) {
        throw new BookingError(409, "LISTING_UNAVAILABLE", "Urgent borrowing is not enabled for this item");
      }

      const rate = pricingMode === "HOUR" ? item.hourly_rate : item.daily_rate;
      if (!rate) {
        throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", {
          pricingMode: pricingMode === "HOUR" ? "รายการนี้ไม่มีราคารายชั่วโมง" : "รายการนี้ไม่มีราคารายวัน",
        });
      }
      const durationUnits = pricingMode === "HOUR" ? Math.ceil(diff / HOUR_MS) : Math.ceil(diff / DAY_MS);
      if (pricingMode === "HOUR" && durationUnits < item.minimum_hours) {
        throw new BookingError(400, "VALIDATION_ERROR", "Booking input is invalid", {
          duration: `รายการนี้ต้องยืมอย่างน้อย ${item.minimum_hours} ชั่วโมง`,
        });
      }

      await expireStaleUrgentReservationsWithClient(client, itemId);
      if (await hasConflict(client, itemId, startsAt, endsAt)) {
        throw new BookingError(409, "AVAILABILITY_CONFLICT", "The selected rental period is unavailable");
      }

      const rentalAmount = moneyFromRate(rate, durationUnits);
      const urgentFee = feeFromAmount(rentalAmount, URGENT_RESERVATION_FEE_RATE_DB);
      const expiresAt = new Date(Date.now() + reservationTtlMinutes() * 60_000);
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
           reservation_expires_at,
           status,
           accepted_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, true, $12, 'WAITING_PAYMENT', now()
         )
         RETURNING id`,
        [
          itemId,
          item.owner_id,
          borrowerId,
          pricingMode,
          startsAt.toISOString(),
          endsAt.toISOString(),
          rate,
          durationUnits.toFixed(2),
          rentalAmount,
          item.deposit_amount,
          urgentFee,
          expiresAt.toISOString(),
        ],
      );

      const requestResult = await client.query<RequestRow>(`${requestSelect} WHERE r.id = $1 LIMIT 1`, [inserted.rows[0].id]);
      return mapRequest(requestResult.rows[0]);
    });
  } catch (error) {
    if (isPgConflict(error)) {
      throw new BookingError(409, "AVAILABILITY_CONFLICT", "Another reservation already holds this period");
    }
    throw error;
  }
}
