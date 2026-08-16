import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";

export const ITEM_CONDITIONS = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "USED"] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];
export type ListingStatus = "ACTIVE" | "PAUSED" | "UNAVAILABLE" | "ARCHIVED";

export type RentalListing = {
  id: string;
  ownerId: string;
  title: string;
  category: string;
  description: string;
  condition: ItemCondition;
  status: ListingStatus;
  hourlyRate: string | null;
  dailyRate: string | null;
  minimumHours: number;
  depositAmount: string;
  urgentEnabled: boolean;
  urgentReservationFeeRate: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  locationLabel: string | null;
  latitude: string | null;
  longitude: string | null;
  createdAt: string;
  updatedAt: string;
};

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

export type RentalListingFieldErrors = Record<string, string>;

export class RentalListingValidationError extends Error {
  readonly status = 400;
  readonly code = "VALIDATION_ERROR";

  constructor(public readonly fieldErrors: RentalListingFieldErrors) {
    super("Rental listing input is invalid");
    this.name = "RentalListingValidationError";
  }
}

type ValidatedRentalListingInput = {
  title: string;
  category: string;
  description: string;
  condition: ItemCondition;
  hourlyRate: string | null;
  dailyRate: string | null;
  minimumHours: number;
  depositAmount: string;
  urgentEnabled: boolean;
  urgentReservationFeeRate: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  locationLabel: string | null;
  latitude: string | null;
  longitude: string | null;
};

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

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(
  value: unknown,
  field: string,
  maxLength: number,
  errors: RentalListingFieldErrors,
): string | null {
  const text = stringValue(value);
  if (!text) return null;
  if (text.length > maxLength) errors[field] = `ต้องไม่เกิน ${maxLength} ตัวอักษร`;
  return text;
}

function requiredString(
  value: unknown,
  field: string,
  label: string,
  minLength: number,
  maxLength: number,
  errors: RentalListingFieldErrors,
): string {
  const text = stringValue(value);
  if (!text) {
    errors[field] = `กรุณากรอก${label}`;
  } else if (text.length < minLength) {
    errors[field] = `${label}ต้องมีอย่างน้อย ${minLength} ตัวอักษร`;
  } else if (text.length > maxLength) {
    errors[field] = `${label}ต้องไม่เกิน ${maxLength} ตัวอักษร`;
  }
  return text;
}

function decimalValue(
  value: unknown,
  field: string,
  label: string,
  errors: RentalListingFieldErrors,
  options: { optional?: boolean; allowZero?: boolean; max?: number } = {},
): string | null {
  if (value === null || value === undefined || value === "") {
    if (options.optional) return null;
    errors[field] = `กรุณากรอก${label}`;
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  const minimumOkay = options.allowZero ? parsed >= 0 : parsed > 0;
  if (!Number.isFinite(parsed) || !minimumOkay) {
    errors[field] = options.allowZero ? `${label}ต้องเป็น 0 หรือมากกว่า` : `${label}ต้องมากกว่า 0`;
    return null;
  }
  if (options.max !== undefined && parsed > options.max) {
    errors[field] = `${label}มีค่าสูงเกินกำหนด`;
    return null;
  }
  return parsed.toFixed(2);
}

function integerValue(
  value: unknown,
  field: string,
  label: string,
  errors: RentalListingFieldErrors,
  minimum: number,
  maximum: number,
): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    errors[field] = `${label}ต้องเป็นจำนวนเต็ม ${minimum}-${maximum}`;
    return minimum;
  }
  return parsed;
}

function coordinateValue(
  value: unknown,
  field: "latitude" | "longitude",
  errors: RentalListingFieldErrors,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  const min = field === "latitude" ? -90 : -180;
  const max = field === "latitude" ? 90 : 180;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    errors[field] = `${field === "latitude" ? "Latitude" : "Longitude"} ต้องอยู่ระหว่าง ${min} ถึง ${max}`;
    return null;
  }
  return parsed.toFixed(6);
}

export function validateRentalListingInput(input: unknown): ValidatedRentalListingInput {
  const errors: RentalListingFieldErrors = {};
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const title = requiredString(body.title, "title", "ชื่อสิ่งของ", 3, 120, errors);
  const category = requiredString(body.category, "category", "หมวดหมู่", 1, 80, errors);
  const description = requiredString(body.description, "description", "รายละเอียด", 10, 3000, errors);
  const province = requiredString(body.province, "province", "จังหวัด", 1, 100, errors);
  const district = optionalString(body.district, "district", 100, errors);
  const subdistrict = optionalString(body.subdistrict, "subdistrict", 100, errors);
  const locationLabel = optionalString(body.locationLabel, "locationLabel", 160, errors);

  const rawCondition = stringValue(body.condition).toUpperCase();
  const condition = ITEM_CONDITIONS.includes(rawCondition as ItemCondition)
    ? (rawCondition as ItemCondition)
    : "GOOD";
  if (!ITEM_CONDITIONS.includes(rawCondition as ItemCondition)) {
    errors.condition = "กรุณาเลือกสภาพสิ่งของที่ถูกต้อง";
  }

  const hourlyRate = decimalValue(body.hourlyRate, "hourlyRate", "ค่าเช่ารายชั่วโมง", errors, {
    optional: true,
    max: 10_000_000,
  });
  const dailyRate = decimalValue(body.dailyRate, "dailyRate", "ค่าเช่ารายวัน", errors, {
    optional: true,
    max: 10_000_000,
  });
  if (!hourlyRate && !dailyRate) {
    errors.pricing = "ต้องกำหนดค่าเช่ารายชั่วโมงหรือรายวันอย่างน้อยหนึ่งแบบ";
  }

  const minimumHours = integerValue(body.minimumHours, "minimumHours", "จำนวนชั่วโมงขั้นต่ำ", errors, 1, 168);
  const depositAmount =
    decimalValue(body.depositAmount ?? 0, "depositAmount", "เงินประกัน", errors, {
      allowZero: true,
      max: 10_000_000,
    }) ?? "0.00";

  const urgentEnabled = body.urgentEnabled === true;
  const rawUrgentRate = body.urgentReservationFeeRate ?? 0.05;
  const urgentRateNumber = typeof rawUrgentRate === "number" ? rawUrgentRate : Number(String(rawUrgentRate).trim());
  let urgentReservationFeeRate = "0.0500";
  if (!Number.isFinite(urgentRateNumber) || urgentRateNumber < 0 || urgentRateNumber > 1) {
    errors.urgentReservationFeeRate = "ค่าจองด่วนต้องอยู่ระหว่าง 0% ถึง 100%";
  } else {
    urgentReservationFeeRate = urgentRateNumber.toFixed(4);
  }

  const latitude = coordinateValue(body.latitude, "latitude", errors);
  const longitude = coordinateValue(body.longitude, "longitude", errors);
  if ((latitude === null) !== (longitude === null)) {
    errors.locationCoordinates = "Latitude และ Longitude ต้องระบุพร้อมกันทั้งคู่";
  }

  if (Object.keys(errors).length > 0) throw new RentalListingValidationError(errors);

  return {
    title,
    category,
    description,
    condition,
    hourlyRate,
    dailyRate,
    minimumHours,
    depositAmount,
    urgentEnabled,
    urgentReservationFeeRate,
    province,
    district,
    subdistrict,
    locationLabel,
    latitude,
    longitude,
  };
}

const rentalListingSelect = `
  SELECT
    id,
    owner_id,
    title,
    category,
    description,
    condition,
    status,
    hourly_rate,
    daily_rate,
    minimum_hours,
    deposit_amount,
    urgent_enabled,
    urgent_reservation_fee_rate,
    province,
    district,
    subdistrict,
    location_label,
    latitude,
    longitude,
    created_at,
    updated_at
  FROM rental_items
`;

export async function createRentalListing(ownerId: string, input: unknown): Promise<RentalListing> {
  const value = validateRentalListingInput(input);
  const result = await query<RentalListingRow>(
    `INSERT INTO rental_items (
       owner_id,
       title,
       category,
       description,
       condition,
       hourly_rate,
       daily_rate,
       minimum_hours,
       deposit_amount,
       urgent_enabled,
       urgent_reservation_fee_rate,
       province,
       district,
       subdistrict,
       location_label,
       latitude,
       longitude
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
     )
     RETURNING
       id,
       owner_id,
       title,
       category,
       description,
       condition,
       status,
       hourly_rate,
       daily_rate,
       minimum_hours,
       deposit_amount,
       urgent_enabled,
       urgent_reservation_fee_rate,
       province,
       district,
       subdistrict,
       location_label,
       latitude,
       longitude,
       created_at,
       updated_at`,
    [
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

  return mapRentalListing(result.rows[0]);
}

export async function listRentalListingsForOwner(ownerId: string): Promise<RentalListing[]> {
  const result = await query<RentalListingRow>(
    `${rentalListingSelect}
     WHERE owner_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [ownerId],
  );
  return result.rows.map(mapRentalListing);
}
