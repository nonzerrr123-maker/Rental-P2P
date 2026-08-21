import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";
import {
  type RentalListing,
  type ItemCondition,
  type ListingStatus,
  validateRentalListingInput,
} from "@/lib/rental/listings";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RentalListingRow = QueryResultRow & {
  id: string;
  owner_id: string;
  title: string;
  category: string;
  description: string;
  condition: ItemCondition;
  status: ListingStatus;
  hourly_rate: string | null;
  daily_rate: string | null;
  minimum_hours: number;
  deposit_amount: string;
  urgent_enabled: boolean;
  urgent_reservation_fee_rate: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  location_label: string | null;
  latitude: string | null;
  longitude: string | null;
  created_at: Date;
  updated_at: Date;
};

export class RentalListingMutationError extends Error {
  constructor(
    public readonly status: 403 | 404 | 409,
    public readonly code: "FORBIDDEN" | "NOT_FOUND" | "ARCHIVED_LISTING",
    message: string,
  ) {
    super(message);
    this.name = "RentalListingMutationError";
  }
}

function mapRentalListing(row: RentalListingRow): RentalListing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    category: row.category,
    description: row.description,
    condition: row.condition,
    status: row.status,
    hourlyRate: row.hourly_rate,
    dailyRate: row.daily_rate,
    minimumHours: row.minimum_hours,
    depositAmount: row.deposit_amount,
    urgentEnabled: row.urgent_enabled,
    urgentReservationFeeRate: row.urgent_reservation_fee_rate,
    province: row.province,
    district: row.district,
    subdistrict: row.subdistrict,
    locationLabel: row.location_label,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const ownerListingSelect = `
  SELECT
    id, owner_id, title, category, description, condition, status,
    hourly_rate, daily_rate, minimum_hours, deposit_amount,
    urgent_enabled, urgent_reservation_fee_rate,
    province, district, subdistrict, location_label, latitude, longitude,
    created_at, updated_at
  FROM rental_items
`;

function requireUuid(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(id)) {
    throw new RentalListingMutationError(404, "NOT_FOUND", "Rental listing not found");
  }
  return id;
}

export async function getOwnerRentalListing(ownerId: string, itemIdInput: unknown): Promise<RentalListing> {
  const itemId = requireUuid(itemIdInput);
  const result = await query<RentalListingRow>(
    `${ownerListingSelect} WHERE id = $1 AND owner_id = $2 LIMIT 1`,
    [itemId, ownerId],
  );
  if (!result.rows[0]) {
    throw new RentalListingMutationError(404, "NOT_FOUND", "Rental listing not found");
  }
  return mapRentalListing(result.rows[0]);
}

export async function updateOwnerRentalListing(
  ownerId: string,
  itemIdInput: unknown,
  input: unknown,
): Promise<RentalListing> {
  const itemId = requireUuid(itemIdInput);
  const value = validateRentalListingInput(input);

  const updated = await query<RentalListingRow>(
    `UPDATE rental_items
     SET title = $3,
         category = $4,
         description = $5,
         condition = $6,
         hourly_rate = $7,
         daily_rate = $8,
         minimum_hours = $9,
         deposit_amount = $10,
         urgent_enabled = $11,
         urgent_reservation_fee_rate = $12,
         province = $13,
         district = $14,
         subdistrict = $15,
         location_label = $16,
         latitude = $17,
         longitude = $18,
         updated_at = now()
     WHERE id = $1
       AND owner_id = $2
       AND status <> 'ARCHIVED'
     RETURNING
       id, owner_id, title, category, description, condition, status,
       hourly_rate, daily_rate, minimum_hours, deposit_amount,
       urgent_enabled, urgent_reservation_fee_rate,
       province, district, subdistrict, location_label, latitude, longitude,
       created_at, updated_at`,
    [
      itemId,
      ownerId,
      value.title,
      value.category,
      value.description,
      value.condition,
      value.hourlyRate,
      value.dailyRate,
      value.minimumHours,
      value.depositAmount,
      value.urgentEnabled,
      value.urgentReservationFeeRate,
      value.province,
      value.district,
      value.subdistrict,
      value.locationLabel,
      value.latitude,
      value.longitude,
    ],
  );

  if (updated.rows[0]) return mapRentalListing(updated.rows[0]);

  const existing = await query<{ owner_id: string; status: ListingStatus } & QueryResultRow>(
    `SELECT owner_id, status FROM rental_items WHERE id = $1 LIMIT 1`,
    [itemId],
  );
  const row = existing.rows[0];
  if (!row) throw new RentalListingMutationError(404, "NOT_FOUND", "Rental listing not found");
  if (row.owner_id !== ownerId) {
    throw new RentalListingMutationError(403, "FORBIDDEN", "Only the listing owner can edit this post");
  }
  throw new RentalListingMutationError(409, "ARCHIVED_LISTING", "Archived listings must be restored before editing");
}
