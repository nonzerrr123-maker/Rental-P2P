import type { PoolClient, QueryResultRow } from "pg";
import { query, withTransaction } from "@/lib/db";
import { ensureConversationForRentalRequest } from "@/lib/chat/service";
import { createNotification } from "@/lib/notifications/service";

export const COMMUNITY_REQUEST_STATUSES = ["OPEN", "MATCHED", "CLOSED", "CANCELLED", "EXPIRED"] as const;
export type CommunityRequestStatus = (typeof COMMUNITY_REQUEST_STATUSES)[number];
export const COMMUNITY_OFFER_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"] as const;
export type CommunityOfferStatus = (typeof COMMUNITY_OFFER_STATUSES)[number];
export type CommunityPricingMode = "HOUR" | "DAY";
export type CommunitySort = "newest" | "urgent" | "nearest";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_RANGE_MS = 90 * DAY_MS;
const ACTIVE_RENTAL_STATUSES = [
  "ACCEPTED",
  "WAITING_PAYMENT",
  "PAID",
  "WAITING_PICKUP",
  "RENTING",
  "RETURNING",
  "DISPUTED",
];

export type CommunityRequestFilters = {
  q: string;
  category: string;
  province: string;
  district: string;
  subdistrict: string;
  urgent: boolean;
  status: CommunityRequestStatus | "ALL";
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
  sort: CommunitySort;
  page: number;
  limit: number;
  requesterId: string | null;
};

export type CommunityRequestRecord = {
  id: string;
  requesterId: string;
  title: string;
  description: string | null;
  category: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  neededStartsAt: string;
  neededEndsAt: string;
  targetPrice: string | null;
  isUrgent: boolean;
  status: CommunityRequestStatus;
  requester: {
    displayName: string;
    verified: boolean;
    ratingAverage: string;
    ratingCount: number;
  };
  distanceKm: number | null;
  offerCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicCommunityRequest = Omit<CommunityRequestRecord, "requesterId">;

export type CommunityOfferSummary = {
  id: string;
  communityRequestId: string;
  lenderId: string;
  lender: {
    displayName: string;
    verified: boolean;
    ratingAverage: string;
    ratingCount: number;
  };
  rentalItem: {
    id: string;
    title: string;
    hourlyRate: string | null;
    dailyRate: string | null;
    status: string;
  } | null;
  pricingMode: CommunityPricingMode | null;
  offeredRate: string | null;
  message: string | null;
  status: CommunityOfferStatus;
  rentalRequestId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunitySearchResult = {
  items: PublicCommunityRequest[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export class CommunityError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "CommunityError";
  }
}

type CommunityRequestRow = QueryResultRow & {
  id: string;
  requester_id: string;
  title: string;
  description: string | null;
  category: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  needed_starts_at: Date;
  needed_ends_at: Date;
  target_price: string | null;
  is_urgent: boolean;
  status: CommunityRequestStatus;
  requester_display_name: string;
  requester_verification_status: string;
  requester_rating_average: string;
  requester_rating_count: number;
  distance_km: number | null;
  offer_count: string;
  created_at: Date;
  updated_at: Date;
  total_count?: string;
};

type CommunityOfferRow = QueryResultRow & {
  id: string;
  community_request_id: string;
  lender_id: string;
  lender_display_name: string;
  lender_verification_status: string;
  lender_rating_average: string;
  lender_rating_count: number;
  rental_item_id: string | null;
  rental_item_title: string | null;
  rental_item_hourly_rate: string | null;
  rental_item_daily_rate: string | null;
  rental_item_status: string | null;
  pricing_mode: CommunityPricingMode | null;
  offered_rate: string | null;
  message: string | null;
  status: CommunityOfferStatus;
  rental_request_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type LockedRequestRow = QueryResultRow & {
  id: string;
  requester_id: string;
  title: string;
  description: string | null;
  category: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  latitude: string | null;
  longitude: string | null;
  needed_starts_at: Date;
  needed_ends_at: Date;
  target_price: string | null;
  is_urgent: boolean;
  status: CommunityRequestStatus;
};

type ItemRow = QueryResultRow & {
  id: string;
  owner_id: string;
  title: string;
  status: string;
  hourly_rate: string | null;
  daily_rate: string | null;
  minimum_hours: number;
  deposit_amount: string;
  owner_active: boolean;
};

type LockedOfferRow = QueryResultRow & {
  id: string;
  community_request_id: string;
  lender_id: string;
  rental_item_id: string | null;
  pricing_mode: CommunityPricingMode | null;
  offered_rate: string | null;
  message: string | null;
  status: CommunityOfferStatus;
};

function firstValue(value: string | null): string {
  return (value ?? "").trim();
}

function boundedQueryText(
  params: URLSearchParams,
  key: string,
  maxLength: number,
  errors: Record<string, string>,
): string {
  const value = firstValue(params.get(key));
  if (value.length > maxLength) errors[key] = `ต้องไม่เกิน ${maxLength} ตัวอักษร`;
  return value.slice(0, maxLength);
}

function optionalNumberParam(
  params: URLSearchParams,
  key: string,
  minimum: number,
  maximum: number,
  errors: Record<string, string>,
): number | null {
  const raw = firstValue(params.get(key));
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    errors[key] = `ต้องเป็นตัวเลขระหว่าง ${minimum} ถึง ${maximum}`;
    return null;
  }
  return value;
}

function integerParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
  errors: Record<string, string>,
): number {
  const raw = firstValue(params.get(key));
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    errors[key] = `ต้องเป็นจำนวนเต็มระหว่าง ${minimum} ถึง ${maximum}`;
    return fallback;
  }
  return value;
}

export function parseCommunityRequestFilters(
  params: URLSearchParams,
  options: { requesterId?: string | null; defaultStatus?: CommunityRequestStatus | "ALL" } = {},
): CommunityRequestFilters {
  const errors: Record<string, string> = {};
  const q = boundedQueryText(params, "q", 100, errors);
  const category = boundedQueryText(params, "category", 80, errors);
  const province = boundedQueryText(params, "province", 100, errors);
  const district = boundedQueryText(params, "district", 100, errors);
  const subdistrict = boundedQueryText(params, "subdistrict", 100, errors);
  const rawUrgent = firstValue(params.get("urgent")).toLowerCase();
  const urgent = rawUrgent === "1" || rawUrgent === "true";
  if (rawUrgent && !["1", "0", "true", "false"].includes(rawUrgent)) errors.urgent = "ค่า urgent ไม่ถูกต้อง";

  const rawStatus = firstValue(params.get("status")).toUpperCase();
  const defaultStatus = options.defaultStatus ?? "OPEN";
  let status: CommunityRequestStatus | "ALL" = defaultStatus;
  if (rawStatus) {
    if (rawStatus === "ALL") status = "ALL";
    else if (COMMUNITY_REQUEST_STATUSES.includes(rawStatus as CommunityRequestStatus)) status = rawStatus as CommunityRequestStatus;
    else errors.status = "สถานะคำขอไม่ถูกต้อง";
  }

  const latitude = optionalNumberParam(params, "lat", -90, 90, errors);
  const longitude = optionalNumberParam(params, "lng", -180, 180, errors);
  const radiusKm = optionalNumberParam(params, "radiusKm", 1, 50, errors);
  if ((latitude === null) !== (longitude === null)) errors.location = "Latitude และ Longitude ต้องระบุพร้อมกัน";
  if (radiusKm !== null && (latitude === null || longitude === null)) errors.radiusKm = "การค้นหารัศมีต้องมีตำแหน่งปัจจุบัน";

  const rawSort = firstValue(params.get("sort")).toLowerCase();
  const allowedSorts: CommunitySort[] = ["newest", "urgent", "nearest"];
  let sort: CommunitySort = allowedSorts.includes(rawSort as CommunitySort)
    ? (rawSort as CommunitySort)
    : radiusKm !== null
      ? "nearest"
      : "newest";
  if (rawSort && !allowedSorts.includes(rawSort as CommunitySort)) errors.sort = "การเรียงลำดับไม่ถูกต้อง";
  if (sort === "nearest" && (latitude === null || longitude === null)) {
    sort = "newest";
    errors.sort = "การเรียงใกล้ที่สุดต้องมีตำแหน่งปัจจุบัน";
  }

  const page = integerParam(params, "page", 1, 1, 10_000, errors);
  const limit = integerParam(params, "limit", 12, 1, 48, errors);
  if (Object.keys(errors).length > 0) throw new CommunityError(400, "VALIDATION_ERROR", "Community query is invalid", errors);

  return {
    q,
    category,
    province,
    district,
    subdistrict,
    urgent,
    status,
    latitude,
    longitude,
    radiusKm,
    sort,
    page,
    limit,
    requesterId: options.requesterId ?? null,
  };
}

function mapRequest(row: CommunityRequestRow): CommunityRequestRecord {
  return {
    id: row.id,
    requesterId: row.requester_id,
    title: row.title,
    description: row.description,
    category: row.category,
    province: row.province,
    district: row.district,
    subdistrict: row.subdistrict,
    neededStartsAt: row.needed_starts_at.toISOString(),
    neededEndsAt: row.needed_ends_at.toISOString(),
    targetPrice: row.target_price,
    isUrgent: row.is_urgent,
    status: row.status,
    requester: {
      displayName: row.requester_display_name,
      verified: row.requester_verification_status === "VERIFIED",
      ratingAverage: row.requester_rating_average,
      ratingCount: row.requester_rating_count,
    },
    distanceKm: row.distance_km === null ? null : Number(row.distance_km),
    offerCount: Number(row.offer_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toPublicCommunityRequest(record: CommunityRequestRecord): PublicCommunityRequest {
  const { requesterId: _requesterId, ...safe } = record;
  void _requesterId;
  return safe;
}

function mapOffer(row: CommunityOfferRow): CommunityOfferSummary {
  return {
    id: row.id,
    communityRequestId: row.community_request_id,
    lenderId: row.lender_id,
    lender: {
      displayName: row.lender_display_name,
      verified: row.lender_verification_status === "VERIFIED",
      ratingAverage: row.lender_rating_average,
      ratingCount: row.lender_rating_count,
    },
    rentalItem: row.rental_item_id
      ? {
          id: row.rental_item_id,
          title: row.rental_item_title ?? "รายการให้ยืม",
          hourlyRate: row.rental_item_hourly_rate,
          dailyRate: row.rental_item_daily_rate,
          status: row.rental_item_status ?? "UNKNOWN",
        }
      : null,
    pricingMode: row.pricing_mode,
    offeredRate: row.offered_rate,
    message: row.message,
    status: row.status,
    rentalRequestId: row.rental_request_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function requiredText(
  value: unknown,
  field: string,
  label: string,
  minLength: number,
  maxLength: number,
  errors: Record<string, string>,
): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) errors[field] = `กรุณากรอก${label}`;
  else if (text.length < minLength) errors[field] = `${label}ต้องมีอย่างน้อย ${minLength} ตัวอักษร`;
  else if (text.length > maxLength) errors[field] = `${label}ต้องไม่เกิน ${maxLength} ตัวอักษร`;
  return text.slice(0, maxLength);
}

function optionalText(value: unknown, field: string, maxLength: number, errors: Record<string, string>): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (text.length > maxLength) errors[field] = `ต้องไม่เกิน ${maxLength} ตัวอักษร`;
  return text.slice(0, maxLength);
}

function requiredInstant(value: unknown, field: string, errors: Record<string, string>): Date {
  const text = typeof value === "string" ? value.trim() : "";
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) errors[field] = "วันเวลาไม่ถูกต้อง";
  return date;
}

function optionalMoney(value: unknown, field: string, errors: Record<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) {
    errors[field] = "ราคาต้องอยู่ระหว่าง 0 ถึง 10,000,000 บาท";
    return null;
  }
  return amount.toFixed(2);
}

function positiveMoney(value: unknown, field: string, errors: Record<string, string>): string | null {
  const amount = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    errors[field] = "ราคาที่เสนอต้องมากกว่า 0 และไม่เกิน 10,000,000 บาท";
    return null;
  }
  return amount.toFixed(2);
}

function coordinate(value: unknown, field: "latitude" | "longitude", errors: Record<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  const min = field === "latitude" ? -90 : -180;
  const max = field === "latitude" ? 90 : 180;
  if (!Number.isFinite(number) || number < min || number > max) {
    errors[field] = `${field === "latitude" ? "Latitude" : "Longitude"} ต้องอยู่ระหว่าง ${min} ถึง ${max}`;
    return null;
  }
  return number.toFixed(6);
}

type ValidatedRequestInput = {
  title: string;
  description: string | null;
  category: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  latitude: string | null;
  longitude: string | null;
  neededStartsAt: Date;
  neededEndsAt: Date;
  targetPrice: string | null;
  isUrgent: boolean;
};

function validateRequestInput(input: unknown, requireFuture = true): ValidatedRequestInput {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};
  const title = requiredText(body.title, "title", "ชื่อสิ่งของ", 3, 120, errors);
  const description = optionalText(body.description, "description", 3000, errors);
  const category = requiredText(body.category, "category", "หมวดหมู่", 1, 80, errors);
  const province = requiredText(body.province, "province", "จังหวัด", 1, 100, errors);
  const district = optionalText(body.district, "district", 100, errors);
  const subdistrict = optionalText(body.subdistrict, "subdistrict", 100, errors);
  const latitude = coordinate(body.latitude, "latitude", errors);
  const longitude = coordinate(body.longitude, "longitude", errors);
  if ((latitude === null) !== (longitude === null)) errors.locationCoordinates = "Latitude และ Longitude ต้องระบุพร้อมกัน";
  const neededStartsAt = requiredInstant(body.neededStartsAt, "neededStartsAt", errors);
  const neededEndsAt = requiredInstant(body.neededEndsAt, "neededEndsAt", errors);
  if (!Number.isNaN(neededStartsAt.getTime()) && !Number.isNaN(neededEndsAt.getTime())) {
    if (neededEndsAt.getTime() <= neededStartsAt.getTime()) errors.neededEndsAt = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
    if (neededEndsAt.getTime() - neededStartsAt.getTime() > MAX_RANGE_MS) errors.neededEndsAt = "ช่วงเวลาที่ต้องการต้องไม่เกิน 90 วัน";
    if (requireFuture && neededStartsAt.getTime() < Date.now() - 60_000) errors.neededStartsAt = "เวลาเริ่มต้องไม่อยู่ในอดีต";
  }
  const targetPrice = optionalMoney(body.targetPrice, "targetPrice", errors);
  const isUrgent = body.isUrgent === true;
  if (Object.keys(errors).length > 0) throw new CommunityError(400, "VALIDATION_ERROR", "Community request input is invalid", errors);
  return {
    title,
    description,
    category,
    province,
    district,
    subdistrict,
    latitude,
    longitude,
    neededStartsAt,
    neededEndsAt,
    targetPrice,
    isUrgent,
  };
}

function requireUuid(value: unknown, field = "id"): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(text)) {
    throw new CommunityError(400, "VALIDATION_ERROR", "Invalid identifier", { [field]: "รหัสรายการไม่ถูกต้อง" });
  }
  return text;
}

async function expireRequestWithClient(client: PoolClient, request: LockedRequestRow): Promise<void> {
  if (request.status !== "OPEN" || request.needed_ends_at.getTime() > Date.now()) return;
  await client.query(`UPDATE community_requests SET status = 'EXPIRED', updated_at = now() WHERE id = $1 AND status = 'OPEN'`, [request.id]);
  const offers = await client.query<{ lender_id: string } & QueryResultRow>(
    `UPDATE community_offers
     SET status = 'EXPIRED', updated_at = now()
     WHERE community_request_id = $1 AND status = 'PENDING'
     RETURNING lender_id`,
    [request.id],
  );
  await createNotification(client, {
    userId: request.requester_id,
    type: "COMMUNITY_REQUEST_EXPIRED",
    title: "คำขอหาของหมดอายุ",
    body: `${request.title} พ้นช่วงเวลาที่ต้องการแล้ว`,
    relatedEntityType: "COMMUNITY_REQUEST",
    relatedEntityId: request.id,
    idempotent: true,
  });
  for (const offer of offers.rows) {
    await createNotification(client, {
      userId: offer.lender_id,
      type: "COMMUNITY_REQUEST_EXPIRED",
      title: "คำขอหาของหมดอายุ",
      body: `${request.title} พ้นช่วงเวลาที่ต้องการแล้ว`,
      relatedEntityType: "COMMUNITY_REQUEST",
      relatedEntityId: request.id,
      idempotent: true,
    });
  }
}

export async function expireStaleCommunityRequests(): Promise<number> {
  return withTransaction(async (client) => {
    const result = await client.query<LockedRequestRow>(
      `SELECT id, requester_id, title, description, category, province, district, subdistrict,
              latitude, longitude, needed_starts_at, needed_ends_at, target_price, is_urgent, status
       FROM community_requests
       WHERE status = 'OPEN' AND needed_ends_at <= now()
       ORDER BY needed_ends_at ASC
       LIMIT 200
       FOR UPDATE SKIP LOCKED`,
    );
    for (const request of result.rows) await expireRequestWithClient(client, request);
    return result.rows.length;
  });
}

const requestBaseSelect = `
  SELECT
    cr.id,
    cr.requester_id,
    cr.title,
    cr.description,
    cr.category,
    cr.province,
    cr.district,
    cr.subdistrict,
    cr.needed_starts_at,
    cr.needed_ends_at,
    cr.target_price,
    cr.is_urgent,
    cr.status,
    requester.display_name AS requester_display_name,
    requester.verification_status::text AS requester_verification_status,
    requester.rating_average AS requester_rating_average,
    requester.rating_count AS requester_rating_count,
    NULL::double precision AS distance_km,
    (SELECT count(*)::text FROM community_offers co WHERE co.community_request_id = cr.id AND co.status = 'PENDING') AS offer_count,
    cr.created_at,
    cr.updated_at
  FROM community_requests cr
  JOIN users requester ON requester.id = cr.requester_id AND requester.is_active = true
`;

export async function searchCommunityRequests(filters: CommunityRequestFilters): Promise<CommunitySearchResult> {
  await expireStaleCommunityRequests();
  const values: unknown[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const conditions = ["requester.is_active = true"];
  if (filters.status !== "ALL") conditions.push(`cr.status = ${bind(filters.status)}::community_request_status`);
  if (filters.requesterId) conditions.push(`cr.requester_id = ${bind(filters.requesterId)}::uuid`);
  if (filters.q) {
    const term = bind(`%${filters.q}%`);
    conditions.push(`(cr.title ILIKE ${term} OR COALESCE(cr.description, '') ILIKE ${term} OR cr.category ILIKE ${term})`);
  }
  if (filters.category) conditions.push(`cr.category = ${bind(filters.category)}`);
  if (filters.province) conditions.push(`cr.province = ${bind(filters.province)}`);
  if (filters.district) conditions.push(`cr.district = ${bind(filters.district)}`);
  if (filters.subdistrict) conditions.push(`cr.subdistrict = ${bind(filters.subdistrict)}`);
  if (filters.urgent) conditions.push("cr.is_urgent = true");

  let distanceExpression = "NULL::double precision";
  if (filters.latitude !== null && filters.longitude !== null) {
    const lat = bind(filters.latitude);
    const lng = bind(filters.longitude);
    distanceExpression = `6371.0088 * 2 * ASIN(SQRT(LEAST(1.0,
      POWER(SIN(RADIANS(cr.latitude::double precision - ${lat}::double precision) / 2), 2)
      + COS(RADIANS(${lat}::double precision)) * COS(RADIANS(cr.latitude::double precision))
      * POWER(SIN(RADIANS(cr.longitude::double precision - ${lng}::double precision) / 2), 2)
    )))`;
    if (filters.radiusKm !== null) {
      const latDelta = filters.radiusKm / 111.32;
      const cosine = Math.max(Math.abs(Math.cos((filters.latitude * Math.PI) / 180)), 0.01);
      const lngDelta = filters.radiusKm / (111.32 * cosine);
      const minLat = bind(filters.latitude - latDelta);
      const maxLat = bind(filters.latitude + latDelta);
      const minLng = bind(filters.longitude - lngDelta);
      const maxLng = bind(filters.longitude + lngDelta);
      conditions.push("cr.latitude IS NOT NULL AND cr.longitude IS NOT NULL");
      conditions.push(`cr.latitude BETWEEN ${minLat} AND ${maxLat}`);
      conditions.push(`cr.longitude BETWEEN ${minLng} AND ${maxLng}`);
      conditions.push(`${distanceExpression} <= ${bind(filters.radiusKm)}`);
    }
  }

  const orderBy = filters.sort === "nearest"
    ? "distance_km ASC NULLS LAST, cr.is_urgent DESC, cr.created_at DESC, cr.id DESC"
    : filters.sort === "urgent"
      ? "cr.is_urgent DESC, cr.needed_starts_at ASC, cr.created_at DESC, cr.id DESC"
      : "cr.created_at DESC, cr.id DESC";
  const limit = bind(filters.limit);
  const offset = bind((filters.page - 1) * filters.limit);

  const result = await query<CommunityRequestRow>(
    `SELECT
       cr.id,
       cr.requester_id,
       cr.title,
       cr.description,
       cr.category,
       cr.province,
       cr.district,
       cr.subdistrict,
       cr.needed_starts_at,
       cr.needed_ends_at,
       cr.target_price,
       cr.is_urgent,
       cr.status,
       requester.display_name AS requester_display_name,
       requester.verification_status::text AS requester_verification_status,
       requester.rating_average AS requester_rating_average,
       requester.rating_count AS requester_rating_count,
       ${distanceExpression} AS distance_km,
       (SELECT count(*)::text FROM community_offers co WHERE co.community_request_id = cr.id AND co.status = 'PENDING') AS offer_count,
       cr.created_at,
       cr.updated_at,
       COUNT(*) OVER()::text AS total_count
     FROM community_requests cr
     JOIN users requester ON requester.id = cr.requester_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY ${orderBy}
     LIMIT ${limit} OFFSET ${offset}`,
    values,
  );
  const total = Number(result.rows[0]?.total_count ?? 0);
  return {
    items: result.rows.map((row) => toPublicCommunityRequest(mapRequest(row))),
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  };
}

export async function getCommunityRequest(requestIdInput: unknown): Promise<CommunityRequestRecord | null> {
  const requestId = requireUuid(requestIdInput, "requestId");
  await expireStaleCommunityRequests();
  const result = await query<CommunityRequestRow>(`${requestBaseSelect} WHERE cr.id = $1 LIMIT 1`, [requestId]);
  return result.rows[0] ? mapRequest(result.rows[0]) : null;
}

export async function createCommunityRequest(requesterId: string, input: unknown): Promise<CommunityRequestRecord> {
  const value = validateRequestInput(input, true);
  const inserted = await query<{ id: string } & QueryResultRow>(
    `INSERT INTO community_requests (
       requester_id, title, description, category, province, district, subdistrict,
       latitude, longitude, needed_starts_at, needed_ends_at, target_price, is_urgent
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      requesterId,
      value.title,
      value.description,
      value.category,
      value.province,
      value.district,
      value.subdistrict,
      value.latitude,
      value.longitude,
      value.neededStartsAt.toISOString(),
      value.neededEndsAt.toISOString(),
      value.targetPrice,
      value.isUrgent,
    ],
  );
  const created = await getCommunityRequest(inserted.rows[0].id);
  if (!created) throw new Error("Created community request could not be loaded");
  return created;
}

async function lockRequest(client: PoolClient, requestId: string): Promise<LockedRequestRow> {
  const result = await client.query<LockedRequestRow>(
    `SELECT id, requester_id, title, description, category, province, district, subdistrict,
            latitude, longitude, needed_starts_at, needed_ends_at, target_price, is_urgent, status
     FROM community_requests
     WHERE id = $1
     FOR UPDATE`,
    [requestId],
  );
  const request = result.rows[0];
  if (!request) throw new CommunityError(404, "REQUEST_NOT_FOUND", "Community request not found");
  await expireRequestWithClient(client, request);
  if (request.status === "OPEN" && request.needed_ends_at.getTime() <= Date.now()) request.status = "EXPIRED";
  return request;
}

async function notifyPendingOfferLenders(
  client: PoolClient,
  request: LockedRequestRow,
  type: string,
  title: string,
  body: string,
): Promise<void> {
  const result = await client.query<{ lender_id: string } & QueryResultRow>(
    `UPDATE community_offers
     SET status = 'REJECTED', updated_at = now()
     WHERE community_request_id = $1 AND status = 'PENDING'
     RETURNING lender_id`,
    [request.id],
  );
  for (const row of result.rows) {
    await createNotification(client, {
      userId: row.lender_id,
      type,
      title,
      body,
      relatedEntityType: "COMMUNITY_REQUEST",
      relatedEntityId: request.id,
      idempotent: true,
    });
  }
}

export async function updateCommunityRequest(requesterId: string, requestIdInput: unknown, input: unknown): Promise<CommunityRequestRecord> {
  const requestId = requireUuid(requestIdInput, "requestId");
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const action = typeof body.action === "string" ? body.action.trim().toUpperCase() : "";

  await withTransaction(async (client) => {
    const request = await lockRequest(client, requestId);
    if (request.requester_id !== requesterId) throw new CommunityError(403, "FORBIDDEN", "Only the requester can update this request");
    if (request.status !== "OPEN") throw new CommunityError(409, "REQUEST_NOT_OPEN", "This community request is no longer open");

    if (action === "CANCEL" || action === "CLOSE") {
      const nextStatus = action === "CANCEL" ? "CANCELLED" : "CLOSED";
      await client.query(`UPDATE community_requests SET status = $2::community_request_status, updated_at = now() WHERE id = $1`, [request.id, nextStatus]);
      await notifyPendingOfferLenders(
        client,
        request,
        action === "CANCEL" ? "COMMUNITY_REQUEST_CANCELLED" : "COMMUNITY_REQUEST_CLOSED",
        action === "CANCEL" ? "คำขอหาของถูกยกเลิก" : "คำขอหาของถูกปิด",
        `${request.title} ไม่รับข้อเสนอเพิ่มแล้ว`,
      );
      return;
    }
    if (action) throw new CommunityError(400, "VALIDATION_ERROR", "Unknown community request action", { action: "action ไม่ถูกต้อง" });

    const merged = {
      title: body.title ?? request.title,
      description: body.description ?? request.description,
      category: body.category ?? request.category,
      province: body.province ?? request.province,
      district: body.district ?? request.district,
      subdistrict: body.subdistrict ?? request.subdistrict,
      latitude: Object.prototype.hasOwnProperty.call(body, "latitude") ? body.latitude : request.latitude,
      longitude: Object.prototype.hasOwnProperty.call(body, "longitude") ? body.longitude : request.longitude,
      neededStartsAt: body.neededStartsAt ?? request.needed_starts_at.toISOString(),
      neededEndsAt: body.neededEndsAt ?? request.needed_ends_at.toISOString(),
      targetPrice: Object.prototype.hasOwnProperty.call(body, "targetPrice") ? body.targetPrice : request.target_price,
      isUrgent: Object.prototype.hasOwnProperty.call(body, "isUrgent") ? body.isUrgent : request.is_urgent,
    };
    const value = validateRequestInput(merged, true);
    await client.query(
      `UPDATE community_requests
       SET title=$2, description=$3, category=$4, province=$5, district=$6, subdistrict=$7,
           latitude=$8, longitude=$9, needed_starts_at=$10, needed_ends_at=$11,
           target_price=$12, is_urgent=$13, updated_at=now()
       WHERE id=$1`,
      [
        request.id,
        value.title,
        value.description,
        value.category,
        value.province,
        value.district,
        value.subdistrict,
        value.latitude,
        value.longitude,
        value.neededStartsAt.toISOString(),
        value.neededEndsAt.toISOString(),
        value.targetPrice,
        value.isUrgent,
      ],
    );
  });

  const updated = await getCommunityRequest(requestId);
  if (!updated) throw new Error("Updated community request could not be loaded");
  return updated;
}

function requirePricingMode(value: unknown, errors: Record<string, string>): CommunityPricingMode | null {
  const mode = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (mode === "HOUR" || mode === "DAY") return mode;
  errors.pricingMode = "รูปแบบราคาต้องเป็น HOUR หรือ DAY";
  return null;
}

async function getItemForOffer(client: PoolClient, lenderId: string, itemId: string, mode: CommunityPricingMode): Promise<ItemRow> {
  const result = await client.query<ItemRow>(
    `SELECT i.id, i.owner_id, i.title, i.status, i.hourly_rate, i.daily_rate, i.minimum_hours, i.deposit_amount,
            owner.is_active AS owner_active
     FROM rental_items i
     JOIN users owner ON owner.id = i.owner_id
     WHERE i.id = $1
     FOR UPDATE OF i`,
    [itemId],
  );
  const item = result.rows[0];
  if (!item) throw new CommunityError(404, "ITEM_NOT_FOUND", "Rental item not found");
  if (item.owner_id !== lenderId) throw new CommunityError(403, "FORBIDDEN", "You can only offer your own rental item");
  if (item.status !== "ACTIVE" || !item.owner_active) throw new CommunityError(409, "LISTING_UNAVAILABLE", "Rental item is not active");
  if (mode === "HOUR" && !item.hourly_rate) throw new CommunityError(409, "PRICING_MODE_UNAVAILABLE", "This item has no hourly pricing");
  if (mode === "DAY" && !item.daily_rate) throw new CommunityError(409, "PRICING_MODE_UNAVAILABLE", "This item has no daily pricing");
  return item;
}

async function assertItemAvailable(
  client: PoolClient,
  itemId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<void> {
  const blocked = await client.query(
    `SELECT 1
     FROM item_availability_blocks
     WHERE item_id = $1
       AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
     LIMIT 1`,
    [itemId, startsAt.toISOString(), endsAt.toISOString()],
  );
  if (blocked.rowCount) throw new CommunityError(409, "AVAILABILITY_CONFLICT", "Rental item is blocked during the requested period");
  const active = await client.query(
    `SELECT 1
     FROM rental_requests
     WHERE item_id = $1
       AND status = ANY($4::rental_status[])
       AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
     LIMIT 1`,
    [itemId, startsAt.toISOString(), endsAt.toISOString(), ACTIVE_RENTAL_STATUSES],
  );
  if (active.rowCount) throw new CommunityError(409, "AVAILABILITY_CONFLICT", "Rental item is already reserved during the requested period");
}

type ValidatedOfferInput = {
  rentalItemId: string | null;
  pricingMode: CommunityPricingMode | null;
  offeredRate: string | null;
  message: string | null;
};

async function validateOfferInput(
  client: PoolClient,
  lenderId: string,
  request: LockedRequestRow,
  input: Record<string, unknown>,
): Promise<ValidatedOfferInput> {
  const errors: Record<string, string> = {};
  const rawItem = typeof input.rentalItemId === "string" ? input.rentalItemId.trim() : "";
  const message = optionalText(input.message, "message", 1500, errors);
  if (!rawItem) {
    if (!message || message.length < 3) errors.message = "ถ้ายังไม่ผูกรายการ กรุณาเขียนรายละเอียดข้อเสนออย่างน้อย 3 ตัวอักษร";
    if (Object.keys(errors).length > 0) throw new CommunityError(400, "VALIDATION_ERROR", "Community offer input is invalid", errors);
    return { rentalItemId: null, pricingMode: null, offeredRate: null, message };
  }

  if (!UUID_PATTERN.test(rawItem)) errors.rentalItemId = "รหัสรายการให้ยืมไม่ถูกต้อง";
  const pricingMode = requirePricingMode(input.pricingMode, errors);
  const offeredRate = positiveMoney(input.offeredRate, "offeredRate", errors);
  if (Object.keys(errors).length > 0 || !pricingMode || !offeredRate) {
    throw new CommunityError(400, "VALIDATION_ERROR", "Community offer input is invalid", errors);
  }
  await getItemForOffer(client, lenderId, rawItem, pricingMode);
  await assertItemAvailable(client, rawItem, request.needed_starts_at, request.needed_ends_at);
  return { rentalItemId: rawItem, pricingMode, offeredRate, message };
}

const offerSelect = `
  SELECT
    co.id,
    co.community_request_id,
    co.lender_id,
    lender.display_name AS lender_display_name,
    lender.verification_status::text AS lender_verification_status,
    lender.rating_average AS lender_rating_average,
    lender.rating_count AS lender_rating_count,
    co.rental_item_id,
    ri.title AS rental_item_title,
    ri.hourly_rate AS rental_item_hourly_rate,
    ri.daily_rate AS rental_item_daily_rate,
    ri.status::text AS rental_item_status,
    co.pricing_mode,
    co.offered_rate,
    co.message,
    co.status,
    rr.id AS rental_request_id,
    co.created_at,
    co.updated_at
  FROM community_offers co
  JOIN users lender ON lender.id = co.lender_id
  LEFT JOIN rental_items ri ON ri.id = co.rental_item_id
  LEFT JOIN rental_requests rr ON rr.id = co.id
`;

export async function listCommunityOffersForViewer(viewerId: string, requestIdInput: unknown): Promise<CommunityOfferSummary[]> {
  const requestId = requireUuid(requestIdInput, "requestId");
  await expireStaleCommunityRequests();
  const requestResult = await query<{ requester_id: string } & QueryResultRow>(`SELECT requester_id FROM community_requests WHERE id = $1`, [requestId]);
  const request = requestResult.rows[0];
  if (!request) throw new CommunityError(404, "REQUEST_NOT_FOUND", "Community request not found");
  const result = await query<CommunityOfferRow>(
    `${offerSelect}
     WHERE co.community_request_id = $1
       AND ($2::uuid = $3::uuid OR co.lender_id = $2::uuid)
     ORDER BY CASE co.status WHEN 'PENDING' THEN 0 WHEN 'ACCEPTED' THEN 1 ELSE 2 END,
              co.created_at DESC`,
    [requestId, viewerId, request.requester_id],
  );
  return result.rows.map(mapOffer);
}

async function loadOffer(client: PoolClient, offerId: string): Promise<LockedOfferRow> {
  const result = await client.query<LockedOfferRow>(
    `SELECT id, community_request_id, lender_id, rental_item_id, pricing_mode, offered_rate, message, status
     FROM community_offers
     WHERE id = $1
     FOR UPDATE`,
    [offerId],
  );
  const offer = result.rows[0];
  if (!offer) throw new CommunityError(404, "OFFER_NOT_FOUND", "Community offer not found");
  return offer;
}

export async function createCommunityOffer(lenderId: string, requestIdInput: unknown, input: unknown): Promise<CommunityOfferSummary> {
  const requestId = requireUuid(requestIdInput, "requestId");
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  let offerId = "";
  try {
    await withTransaction(async (client) => {
      const request = await lockRequest(client, requestId);
      if (request.status !== "OPEN") throw new CommunityError(409, "REQUEST_NOT_OPEN", "This community request is no longer open");
      if (request.requester_id === lenderId) throw new CommunityError(409, "SELF_OFFER_NOT_ALLOWED", "You cannot offer to your own community request");
      const value = await validateOfferInput(client, lenderId, request, body);
      const inserted = await client.query<{ id: string } & QueryResultRow>(
        `INSERT INTO community_offers (
           community_request_id, lender_id, rental_item_id, pricing_mode, offered_rate, message
         ) VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [request.id, lenderId, value.rentalItemId, value.pricingMode, value.offeredRate, value.message],
      );
      offerId = inserted.rows[0].id;
      const lenderResult = await client.query<{ display_name: string } & QueryResultRow>(`SELECT display_name FROM users WHERE id=$1`, [lenderId]);
      await createNotification(client, {
        userId: request.requester_id,
        type: "COMMUNITY_OFFER_RECEIVED",
        title: "มีข้อเสนอใหม่ในคอมมูหาของ",
        body: `${lenderResult.rows[0]?.display_name ?? "ผู้ให้ยืม"} ส่งข้อเสนอสำหรับ ${request.title}`,
        relatedEntityType: "COMMUNITY_REQUEST",
        relatedEntityId: request.id,
        idempotent: true,
      });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
      throw new CommunityError(409, "DUPLICATE_OFFER", "You already have an offer on this request");
    }
    throw error;
  }
  const result = await query<CommunityOfferRow>(`${offerSelect} WHERE co.id = $1 LIMIT 1`, [offerId]);
  return mapOffer(result.rows[0]);
}

function calculateDurationUnits(mode: CommunityPricingMode, startsAt: Date, endsAt: Date): number {
  const diff = endsAt.getTime() - startsAt.getTime();
  return mode === "HOUR" ? Math.ceil(diff / HOUR_MS) : Math.ceil(diff / DAY_MS);
}

function rentalAmount(rate: string, units: number): string {
  const rateCents = Math.round(Number(rate) * 100);
  return ((rateCents * units) / 100).toFixed(2);
}

async function acceptOffer(
  client: PoolClient,
  actorId: string,
  request: LockedRequestRow,
  offer: LockedOfferRow,
): Promise<string> {
  if (actorId !== request.requester_id) throw new CommunityError(403, "FORBIDDEN", "Only the requester can accept an offer");
  if (request.status !== "OPEN") throw new CommunityError(409, "REQUEST_NOT_OPEN", "This community request is no longer open");
  if (offer.status !== "PENDING") throw new CommunityError(409, "OFFER_NOT_PENDING", "This offer is no longer pending");
  if (!offer.rental_item_id || !offer.pricing_mode || !offer.offered_rate) {
    throw new CommunityError(409, "OFFER_NOT_READY", "Attach an active rental listing and price before accepting this offer");
  }

  const item = await getItemForOffer(client, offer.lender_id, offer.rental_item_id, offer.pricing_mode);
  await assertItemAvailable(client, item.id, request.needed_starts_at, request.needed_ends_at);
  const units = calculateDurationUnits(offer.pricing_mode, request.needed_starts_at, request.needed_ends_at);
  if (offer.pricing_mode === "HOUR" && units < item.minimum_hours) {
    throw new CommunityError(409, "MINIMUM_HOURS_NOT_MET", `รายการนี้ต้องยืมอย่างน้อย ${item.minimum_hours} ชั่วโมง`);
  }
  if (units < 1) throw new CommunityError(409, "INVALID_DURATION", "Requested rental duration is invalid");

  // TASK 19 correlation invariant: an accepted community offer and its rental request
  // intentionally share the same UUID. This provides a durable 1:1 mapping without a
  // new migration column and makes retries naturally idempotent.
  const rentalRequestId = offer.id;
  await client.query(
    `INSERT INTO rental_requests (
       id, item_id, lender_id, borrower_id, pricing_mode, starts_at, ends_at,
       unit_rate, duration_units, rental_amount, deposit_amount,
       platform_fee_amount, urgent_reservation_fee_amount, is_urgent,
       status, accepted_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,0,false,'WAITING_PAYMENT',now())`,
    [
      rentalRequestId,
      item.id,
      offer.lender_id,
      request.requester_id,
      offer.pricing_mode,
      request.needed_starts_at.toISOString(),
      request.needed_ends_at.toISOString(),
      offer.offered_rate,
      units.toFixed(2),
      rentalAmount(offer.offered_rate, units),
      item.deposit_amount,
    ],
  );

  await client.query(`UPDATE community_requests SET status='MATCHED', updated_at=now() WHERE id=$1`, [request.id]);
  await client.query(`UPDATE community_offers SET status='ACCEPTED', updated_at=now() WHERE id=$1`, [offer.id]);
  const rejected = await client.query<{ lender_id: string } & QueryResultRow>(
    `UPDATE community_offers
     SET status='REJECTED', updated_at=now()
     WHERE community_request_id=$1 AND id<>$2 AND status='PENDING'
     RETURNING lender_id`,
    [request.id, offer.id],
  );

  await ensureConversationForRentalRequest(client, rentalRequestId, offer.lender_id, request.requester_id);
  await createNotification(client, {
    userId: request.requester_id,
    type: "COMMUNITY_MATCHED",
    title: "จับคู่ของที่ต้องการสำเร็จ",
    body: `${request.title} มีข้อเสนอที่คุณตอบรับแล้ว ไปชำระเงินเพื่อยืนยันการเช่า`,
    relatedEntityType: "RENTAL_REQUEST",
    relatedEntityId: rentalRequestId,
    idempotent: true,
  });
  await createNotification(client, {
    userId: offer.lender_id,
    type: "COMMUNITY_OFFER_ACCEPTED",
    title: "ข้อเสนอของคุณได้รับการตอบรับ",
    body: `${request.title} ถูกจับคู่กับรายการของคุณแล้ว`,
    relatedEntityType: "RENTAL_REQUEST",
    relatedEntityId: rentalRequestId,
    idempotent: true,
  });
  for (const row of rejected.rows) {
    await createNotification(client, {
      userId: row.lender_id,
      type: "COMMUNITY_OFFER_REJECTED",
      title: "คำขอเลือกข้อเสนออื่นแล้ว",
      body: `${request.title} จับคู่กับผู้ให้ยืมรายอื่นแล้ว`,
      relatedEntityType: "COMMUNITY_REQUEST",
      relatedEntityId: request.id,
      idempotent: true,
    });
  }
  return rentalRequestId;
}

export async function updateCommunityOffer(actorId: string, offerIdInput: unknown, input: unknown): Promise<CommunityOfferSummary> {
  const offerId = requireUuid(offerIdInput, "offerId");
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const action = typeof body.action === "string" ? body.action.trim().toUpperCase() : "UPDATE";
  let rentalRequestId: string | null = null;

  await withTransaction(async (client) => {
    const offer = await loadOffer(client, offerId);
    const request = await lockRequest(client, offer.community_request_id);

    if (action === "ACCEPT") {
      rentalRequestId = await acceptOffer(client, actorId, request, offer);
      return;
    }
    if (action === "REJECT") {
      if (actorId !== request.requester_id) throw new CommunityError(403, "FORBIDDEN", "Only the requester can reject an offer");
      if (offer.status !== "PENDING") throw new CommunityError(409, "OFFER_NOT_PENDING", "This offer is no longer pending");
      await client.query(`UPDATE community_offers SET status='REJECTED', updated_at=now() WHERE id=$1`, [offer.id]);
      await createNotification(client, {
        userId: offer.lender_id,
        type: "COMMUNITY_OFFER_REJECTED",
        title: "ข้อเสนอไม่ได้รับการเลือก",
        body: `ผู้ขอปฏิเสธข้อเสนอสำหรับ ${request.title}`,
        relatedEntityType: "COMMUNITY_REQUEST",
        relatedEntityId: request.id,
        idempotent: true,
      });
      return;
    }
    if (action === "WITHDRAW") {
      if (actorId !== offer.lender_id) throw new CommunityError(403, "FORBIDDEN", "Only the lender can withdraw this offer");
      if (offer.status !== "PENDING") throw new CommunityError(409, "OFFER_NOT_PENDING", "This offer is no longer pending");
      await client.query(`UPDATE community_offers SET status='WITHDRAWN', updated_at=now() WHERE id=$1`, [offer.id]);
      await createNotification(client, {
        userId: request.requester_id,
        type: "COMMUNITY_OFFER_WITHDRAWN",
        title: "ข้อเสนอถูกถอน",
        body: `มีผู้ให้ยืมถอนข้อเสนอสำหรับ ${request.title}`,
        relatedEntityType: "COMMUNITY_REQUEST",
        relatedEntityId: request.id,
        idempotent: true,
      });
      return;
    }
    if (action !== "UPDATE") throw new CommunityError(400, "VALIDATION_ERROR", "Unknown offer action", { action: "action ไม่ถูกต้อง" });
    if (actorId !== offer.lender_id) throw new CommunityError(403, "FORBIDDEN", "Only the lender can update this offer");
    if (offer.status !== "PENDING" || request.status !== "OPEN") throw new CommunityError(409, "OFFER_NOT_PENDING", "This offer can no longer be edited");
    const value = await validateOfferInput(client, actorId, request, {
      rentalItemId: Object.prototype.hasOwnProperty.call(body, "rentalItemId") ? body.rentalItemId : offer.rental_item_id,
      pricingMode: Object.prototype.hasOwnProperty.call(body, "pricingMode") ? body.pricingMode : offer.pricing_mode,
      offeredRate: Object.prototype.hasOwnProperty.call(body, "offeredRate") ? body.offeredRate : offer.offered_rate,
      message: Object.prototype.hasOwnProperty.call(body, "message") ? body.message : offer.message,
    });
    await client.query(
      `UPDATE community_offers
       SET rental_item_id=$2, pricing_mode=$3, offered_rate=$4, message=$5, updated_at=now()
       WHERE id=$1`,
      [offer.id, value.rentalItemId, value.pricingMode, value.offeredRate, value.message],
    );
  });

  const result = await query<CommunityOfferRow>(`${offerSelect} WHERE co.id = $1 LIMIT 1`, [offerId]);
  const mapped = mapOffer(result.rows[0]);
  if (rentalRequestId) mapped.rentalRequestId = rentalRequestId;
  return mapped;
}

export async function listCommunityFacets(): Promise<{ categories: string[]; provinces: string[] }> {
  await expireStaleCommunityRequests();
  const [categories, provinces] = await Promise.all([
    query<{ value: string } & QueryResultRow>(`SELECT DISTINCT category AS value FROM community_requests WHERE status='OPEN' ORDER BY value LIMIT 100`),
    query<{ value: string } & QueryResultRow>(`SELECT DISTINCT province AS value FROM community_requests WHERE status='OPEN' ORDER BY value LIMIT 100`),
  ]);
  return { categories: categories.rows.map((row) => row.value), provinces: provinces.rows.map((row) => row.value) };
}
