import type { QueryResultRow } from "pg";
import type { AuthUser } from "@/lib/auth/session";
import { assertResourceOwner } from "@/lib/auth/authorization";
import { query } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RentalItemLocation = {
  itemId: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  locationLabel: string | null;
  latitude: string | null;
  longitude: string | null;
  updatedAt: string;
};

export class RentalLocationValidationError extends Error {
  readonly status = 400;
  readonly code = "VALIDATION_ERROR";

  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Rental location input is invalid");
    this.name = "RentalLocationValidationError";
  }
}

type LocationRow = QueryResultRow & {
  id: string;
  owner_id: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  location_label: string | null;
  latitude: string | null;
  longitude: string | null;
  updated_at: Date;
};

function boundedString(value: unknown, field: string, maxLength: number, required: boolean, errors: Record<string, string>): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    if (required) errors[field] = "กรุณาระบุจังหวัด";
    return null;
  }
  if (text.length > maxLength) errors[field] = `ต้องไม่เกิน ${maxLength} ตัวอักษร`;
  return text.slice(0, maxLength);
}

function coordinate(value: unknown, field: "latitude" | "longitude", errors: Record<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  const minimum = field === "latitude" ? -90 : -180;
  const maximum = field === "latitude" ? 90 : 180;
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    errors[field] = `${field === "latitude" ? "Latitude" : "Longitude"} ต้องอยู่ระหว่าง ${minimum} ถึง ${maximum}`;
    return null;
  }
  return number.toFixed(6);
}

function mapLocation(row: LocationRow): RentalItemLocation {
  return {
    itemId: row.id,
    province: row.province,
    district: row.district,
    subdistrict: row.subdistrict,
    locationLabel: row.location_label,
    latitude: row.latitude,
    longitude: row.longitude,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function updateRentalItemLocation(actor: AuthUser, itemId: string, input: unknown): Promise<RentalItemLocation> {
  if (!UUID_PATTERN.test(itemId)) {
    throw new RentalLocationValidationError({ itemId: "รหัสประกาศไม่ถูกต้อง" });
  }

  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const errors: Record<string, string> = {};
  const province = boundedString(body.province, "province", 100, true, errors) ?? "";
  const district = boundedString(body.district, "district", 100, false, errors);
  const subdistrict = boundedString(body.subdistrict, "subdistrict", 100, false, errors);
  const locationLabel = boundedString(body.locationLabel, "locationLabel", 160, false, errors);
  const latitude = coordinate(body.latitude, "latitude", errors);
  const longitude = coordinate(body.longitude, "longitude", errors);
  if ((latitude === null) !== (longitude === null)) {
    errors.locationCoordinates = "Latitude และ Longitude ต้องระบุพร้อมกันทั้งคู่";
  }
  if (Object.keys(errors).length) throw new RentalLocationValidationError(errors);

  const ownerResult = await query<{ owner_id: string } & QueryResultRow>(
    `SELECT owner_id FROM rental_items WHERE id = $1 LIMIT 1`,
    [itemId],
  );
  const ownerId = ownerResult.rows[0]?.owner_id;
  if (!ownerId) {
    const error = new Error("Rental item not found");
    error.name = "RentalLocationNotFoundError";
    throw error;
  }
  assertResourceOwner(actor, ownerId);

  const result = await query<LocationRow>(
    `UPDATE rental_items
     SET province = $2,
         district = $3,
         subdistrict = $4,
         location_label = $5,
         latitude = $6,
         longitude = $7,
         updated_at = now()
     WHERE id = $1
     RETURNING id, owner_id, province, district, subdistrict, location_label, latitude, longitude, updated_at`,
    [itemId, province, district, subdistrict, locationLabel, latitude, longitude],
  );
  return mapLocation(result.rows[0]);
}
