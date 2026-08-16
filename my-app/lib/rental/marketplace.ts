import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";
import { ITEM_CONDITIONS, type ItemCondition } from "@/lib/rental/listings";

export type MarketplacePricingMode = "HOUR" | "DAY";
export type MarketplaceSort = "newest" | "price_asc" | "price_desc" | "distance";

export type MarketplaceFilters = {
  q: string;
  category: string;
  province: string;
  district: string;
  subdistrict: string;
  condition: ItemCondition | null;
  pricingMode: MarketplacePricingMode | null;
  urgent: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
  sort: MarketplaceSort;
  page: number;
  limit: number;
};

export type PublicRentalCard = {
  id: string;
  title: string;
  category: string;
  condition: ItemCondition;
  hourlyRate: string | null;
  dailyRate: string | null;
  depositAmount: string;
  urgentEnabled: boolean;
  province: string;
  district: string | null;
  subdistrict: string | null;
  owner: {
    displayName: string;
    verified: boolean;
    ratingAverage: string;
    ratingCount: number;
  };
  coverImageUrl: string | null;
  distanceKm: number | null;
  createdAt: string;
};

export type PublicRentalDetail = PublicRentalCard & {
  description: string;
  minimumHours: number;
  urgentReservationFeeRate: string;
  images: Array<{ id: string; altText: string | null; contentUrl: string }>;
};

export type MarketplaceResult = {
  items: PublicRentalCard[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type MarketplaceFacets = {
  categories: string[];
  provinces: string[];
};

export class MarketplaceValidationError extends Error {
  readonly status = 400;
  readonly code = "VALIDATION_ERROR";

  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Marketplace query is invalid");
    this.name = "MarketplaceValidationError";
  }
}

type MarketplaceRow = QueryResultRow & {
  id: string;
  title: string;
  category: string;
  condition: ItemCondition;
  hourly_rate: string | null;
  daily_rate: string | null;
  deposit_amount: string;
  urgent_enabled: boolean;
  province: string;
  district: string | null;
  subdistrict: string | null;
  owner_display_name: string;
  owner_verification_status: string;
  owner_rating_average: string;
  owner_rating_count: number;
  cover_image_id: string | null;
  distance_km: number | null;
  created_at: Date;
  total_count: string;
};

type DetailRow = QueryResultRow & MarketplaceRow & {
  description: string;
  minimum_hours: number;
  urgent_reservation_fee_rate: string;
};

type ImageRow = QueryResultRow & {
  id: string;
  alt_text: string | null;
};

function firstValue(value: string | null): string {
  return (value ?? "").trim();
}

function boundedText(
  params: URLSearchParams,
  key: string,
  maxLength: number,
  errors: Record<string, string>,
): string {
  const value = firstValue(params.get(key));
  if (value.length > maxLength) errors[key] = `ต้องไม่เกิน ${maxLength} ตัวอักษร`;
  return value.slice(0, maxLength);
}

function optionalNumber(
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

export function parseMarketplaceFilters(params: URLSearchParams): MarketplaceFilters {
  const errors: Record<string, string> = {};
  const q = boundedText(params, "q", 100, errors);
  const category = boundedText(params, "category", 80, errors);
  const province = boundedText(params, "province", 100, errors);
  const district = boundedText(params, "district", 100, errors);
  const subdistrict = boundedText(params, "subdistrict", 100, errors);

  const rawCondition = firstValue(params.get("condition")).toUpperCase();
  const condition = rawCondition && ITEM_CONDITIONS.includes(rawCondition as ItemCondition)
    ? (rawCondition as ItemCondition)
    : null;
  if (rawCondition && !condition) errors.condition = "สภาพสินค้าไม่ถูกต้อง";

  const rawPricingMode = firstValue(params.get("pricingMode")).toUpperCase();
  const pricingMode = rawPricingMode === "HOUR" || rawPricingMode === "DAY"
    ? rawPricingMode
    : null;
  if (rawPricingMode && !pricingMode) errors.pricingMode = "รูปแบบราคาต้องเป็น HOUR หรือ DAY";

  const rawUrgent = firstValue(params.get("urgent")).toLowerCase();
  const urgent = rawUrgent === "1" || rawUrgent === "true";
  if (rawUrgent && !["1", "true", "0", "false"].includes(rawUrgent)) {
    errors.urgent = "ค่า urgent ไม่ถูกต้อง";
  }

  const minPrice = optionalNumber(params, "minPrice", 0, 10_000_000, errors);
  const maxPrice = optionalNumber(params, "maxPrice", 0, 10_000_000, errors);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    errors.maxPrice = "ราคาสูงสุดต้องไม่น้อยกว่าราคาต่ำสุด";
  }

  const latitude = optionalNumber(params, "lat", -90, 90, errors);
  const longitude = optionalNumber(params, "lng", -180, 180, errors);
  const radiusKm = optionalNumber(params, "radiusKm", 1, 100, errors);
  if ((latitude === null) !== (longitude === null)) {
    errors.location = "Latitude และ Longitude ต้องระบุพร้อมกัน";
  }
  if (radiusKm !== null && (latitude === null || longitude === null)) {
    errors.radiusKm = "การค้นหาตามระยะทางต้องมีตำแหน่งปัจจุบัน";
  }

  const rawSort = firstValue(params.get("sort"));
  const allowedSorts: MarketplaceSort[] = ["newest", "price_asc", "price_desc", "distance"];
  let sort: MarketplaceSort = allowedSorts.includes(rawSort as MarketplaceSort)
    ? (rawSort as MarketplaceSort)
    : radiusKm !== null
      ? "distance"
      : "newest";
  if (rawSort && !allowedSorts.includes(rawSort as MarketplaceSort)) errors.sort = "การเรียงลำดับไม่ถูกต้อง";
  if (sort === "distance" && (latitude === null || longitude === null)) {
    sort = "newest";
    errors.sort = "การเรียงตามระยะทางต้องมีตำแหน่งปัจจุบัน";
  }

  const page = integerParam(params, "page", 1, 1, 10_000, errors);
  const limit = integerParam(params, "limit", 12, 1, 48, errors);

  if (Object.keys(errors).length > 0) throw new MarketplaceValidationError(errors);

  return {
    q,
    category,
    province,
    district,
    subdistrict,
    condition,
    pricingMode,
    urgent,
    minPrice,
    maxPrice,
    latitude,
    longitude,
    radiusKm,
    sort,
    page,
    limit,
  };
}

function mapMarketplaceRow(row: MarketplaceRow): PublicRentalCard {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    condition: row.condition,
    hourlyRate: row.hourly_rate,
    dailyRate: row.daily_rate,
    depositAmount: row.deposit_amount,
    urgentEnabled: row.urgent_enabled,
    province: row.province,
    district: row.district,
    subdistrict: row.subdistrict,
    owner: {
      displayName: row.owner_display_name,
      verified: row.owner_verification_status === "VERIFIED",
      ratingAverage: row.owner_rating_average,
      ratingCount: row.owner_rating_count,
    },
    coverImageUrl: row.cover_image_id ? `/api/rental-images/${row.cover_image_id}/content` : null,
    distanceKm: row.distance_km === null ? null : Number(row.distance_km),
    createdAt: row.created_at.toISOString(),
  };
}

export async function searchPublicRentalItems(filters: MarketplaceFilters): Promise<MarketplaceResult> {
  const values: unknown[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  const conditions = ["ri.status = 'ACTIVE'"];

  if (filters.q) {
    const parameter = bind(`%${filters.q}%`);
    conditions.push(`(
      ri.title ILIKE ${parameter}
      OR ri.description ILIKE ${parameter}
      OR ri.category ILIKE ${parameter}
    )`);
  }
  if (filters.category) conditions.push(`ri.category = ${bind(filters.category)}`);
  if (filters.province) conditions.push(`ri.province = ${bind(filters.province)}`);
  if (filters.district) conditions.push(`ri.district = ${bind(filters.district)}`);
  if (filters.subdistrict) conditions.push(`ri.subdistrict = ${bind(filters.subdistrict)}`);
  if (filters.condition) conditions.push(`ri.condition = ${bind(filters.condition)}::item_condition`);
  if (filters.pricingMode === "HOUR") conditions.push("ri.hourly_rate IS NOT NULL");
  if (filters.pricingMode === "DAY") conditions.push("ri.daily_rate IS NOT NULL");
  if (filters.urgent) conditions.push("ri.urgent_enabled = true");

  const rateColumn = filters.pricingMode === "HOUR"
    ? "ri.hourly_rate"
    : filters.pricingMode === "DAY"
      ? "ri.daily_rate"
      : null;

  if (rateColumn && filters.minPrice !== null) conditions.push(`${rateColumn} >= ${bind(filters.minPrice)}`);
  if (rateColumn && filters.maxPrice !== null) conditions.push(`${rateColumn} <= ${bind(filters.maxPrice)}`);
  if (!rateColumn && filters.minPrice !== null && filters.maxPrice !== null) {
    const min = bind(filters.minPrice);
    const max = bind(filters.maxPrice);
    conditions.push(`((ri.hourly_rate BETWEEN ${min} AND ${max}) OR (ri.daily_rate BETWEEN ${min} AND ${max}))`);
  } else if (!rateColumn && filters.minPrice !== null) {
    const min = bind(filters.minPrice);
    conditions.push(`(ri.hourly_rate >= ${min} OR ri.daily_rate >= ${min})`);
  } else if (!rateColumn && filters.maxPrice !== null) {
    const max = bind(filters.maxPrice);
    conditions.push(`(ri.hourly_rate <= ${max} OR ri.daily_rate <= ${max})`);
  }

  let distanceExpression = "NULL::double precision";
  if (filters.latitude !== null && filters.longitude !== null) {
    const lat = bind(filters.latitude);
    const lng = bind(filters.longitude);
    distanceExpression = `6371.0088 * 2 * ASIN(SQRT(LEAST(1.0,
      POWER(SIN(RADIANS(ri.latitude::double precision - ${lat}) / 2), 2)
      + COS(RADIANS(${lat})) * COS(RADIANS(ri.latitude::double precision))
      * POWER(SIN(RADIANS(ri.longitude::double precision - ${lng}) / 2), 2)
    )))`;
    if (filters.radiusKm !== null) {
      conditions.push("ri.latitude IS NOT NULL AND ri.longitude IS NOT NULL");
      conditions.push(`${distanceExpression} <= ${bind(filters.radiusKm)}`);
    }
  }

  const orderBy = filters.sort === "distance"
    ? "distance_km ASC NULLS LAST, ri.created_at DESC, ri.id DESC"
    : filters.sort === "price_asc"
      ? "COALESCE(ri.daily_rate, ri.hourly_rate) ASC NULLS LAST, ri.created_at DESC, ri.id DESC"
      : filters.sort === "price_desc"
        ? "COALESCE(ri.daily_rate, ri.hourly_rate) DESC NULLS LAST, ri.created_at DESC, ri.id DESC"
        : "ri.created_at DESC, ri.id DESC";

  const limit = bind(filters.limit);
  const offset = bind((filters.page - 1) * filters.limit);

  const result = await query<MarketplaceRow>(
    `SELECT
       ri.id,
       ri.title,
       ri.category,
       ri.condition,
       ri.hourly_rate,
       ri.daily_rate,
       ri.deposit_amount,
       ri.urgent_enabled,
       ri.province,
       ri.district,
       ri.subdistrict,
       u.display_name AS owner_display_name,
       u.verification_status::text AS owner_verification_status,
       u.rating_average AS owner_rating_average,
       u.rating_count AS owner_rating_count,
       cover.id AS cover_image_id,
       ${distanceExpression} AS distance_km,
       ri.created_at,
       COUNT(*) OVER()::text AS total_count
     FROM rental_items ri
     JOIN users u ON u.id = ri.owner_id AND u.is_active = true
     LEFT JOIN LATERAL (
       SELECT id
       FROM rental_images
       WHERE item_id = ri.id
       ORDER BY sort_order ASC, created_at ASC
       LIMIT 1
     ) cover ON true
     WHERE ${conditions.join(" AND ")}
     ORDER BY ${orderBy}
     LIMIT ${limit} OFFSET ${offset}`,
    values,
  );

  const total = Number(result.rows[0]?.total_count ?? 0);
  return {
    items: result.rows.map(mapMarketplaceRow),
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  };
}

export async function getPublicRentalItem(itemId: string): Promise<PublicRentalDetail | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)) {
    return null;
  }

  const itemResult = await query<DetailRow>(
    `SELECT
       ri.id,
       ri.title,
       ri.category,
       ri.description,
       ri.condition,
       ri.hourly_rate,
       ri.daily_rate,
       ri.minimum_hours,
       ri.deposit_amount,
       ri.urgent_enabled,
       ri.urgent_reservation_fee_rate,
       ri.province,
       ri.district,
       ri.subdistrict,
       u.display_name AS owner_display_name,
       u.verification_status::text AS owner_verification_status,
       u.rating_average AS owner_rating_average,
       u.rating_count AS owner_rating_count,
       cover.id AS cover_image_id,
       NULL::double precision AS distance_km,
       ri.created_at,
       '1'::text AS total_count
     FROM rental_items ri
     JOIN users u ON u.id = ri.owner_id AND u.is_active = true
     LEFT JOIN LATERAL (
       SELECT id
       FROM rental_images
       WHERE item_id = ri.id
       ORDER BY sort_order ASC, created_at ASC
       LIMIT 1
     ) cover ON true
     WHERE ri.id = $1 AND ri.status = 'ACTIVE'
     LIMIT 1`,
    [itemId],
  );
  const row = itemResult.rows[0];
  if (!row) return null;

  const imageResult = await query<ImageRow>(
    `SELECT id, alt_text
     FROM rental_images
     WHERE item_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [itemId],
  );

  return {
    ...mapMarketplaceRow(row),
    description: row.description,
    minimumHours: row.minimum_hours,
    urgentReservationFeeRate: row.urgent_reservation_fee_rate,
    images: imageResult.rows.map((image) => ({
      id: image.id,
      altText: image.alt_text,
      contentUrl: `/api/rental-images/${image.id}/content`,
    })),
  };
}

export async function listMarketplaceFacets(): Promise<MarketplaceFacets> {
  const [categoryResult, provinceResult] = await Promise.all([
    query<QueryResultRow & { value: string }>(
      `SELECT DISTINCT category AS value
       FROM rental_items
       WHERE status = 'ACTIVE'
       ORDER BY value ASC
       LIMIT 100`,
    ),
    query<QueryResultRow & { value: string }>(
      `SELECT DISTINCT province AS value
       FROM rental_items
       WHERE status = 'ACTIVE'
       ORDER BY value ASC
       LIMIT 100`,
    ),
  ]);
  return {
    categories: categoryResult.rows.map((row) => row.value),
    provinces: provinceResult.rows.map((row) => row.value),
  };
}
