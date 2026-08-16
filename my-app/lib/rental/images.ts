import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { assertResourceOwner, type AuthUser } from "@/lib/auth/authorization";
import { query, withTransaction } from "@/lib/db";
import { deleteObject, getObject, putObject } from "@/lib/storage/s3";

export const MAX_RENTAL_IMAGES = 8;
export const MAX_RENTAL_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type SupportedImageType = keyof typeof IMAGE_TYPES;

export type RentalImage = {
  id: string;
  itemId: string;
  altText: string | null;
  sortOrder: number;
  createdAt: string;
  contentUrl: string;
};

type RentalImageRow = QueryResultRow & {
  id: string;
  item_id: string;
  storage_key: string;
  alt_text: string | null;
  sort_order: number;
  created_at: Date;
};

export class RentalImageError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 413 | 415 | 503,
    public readonly code:
      | "ITEM_NOT_FOUND"
      | "IMAGE_NOT_FOUND"
      | "IMAGE_LIMIT_REACHED"
      | "IMAGE_REQUIRED"
      | "IMAGE_TOO_LARGE"
      | "UNSUPPORTED_IMAGE"
      | "IMAGE_TYPE_MISMATCH"
      | "INVALID_REORDER"
      | "STORAGE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "RentalImageError";
  }
}

function mapImage(row: RentalImageRow): RentalImage {
  return {
    id: row.id,
    itemId: row.item_id,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    contentUrl: `/api/rental-images/${row.id}/content`,
  };
}

function detectImageType(bytes: Uint8Array): SupportedImageType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function cleanAltText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, 240);
}

async function getItemOwner(itemId: string): Promise<string | null> {
  const result = await query<QueryResultRow & { owner_id: string }>(
    `SELECT owner_id FROM rental_items WHERE id = $1 LIMIT 1`,
    [itemId],
  );
  return result.rows[0]?.owner_id ?? null;
}

export async function assertRentalItemImageAccess(user: AuthUser, itemId: string): Promise<void> {
  const ownerId = await getItemOwner(itemId);
  if (!ownerId) {
    throw new RentalImageError(404, "ITEM_NOT_FOUND", "Rental item not found");
  }
  assertResourceOwner(user, ownerId);
}

export async function listRentalImages(itemId: string): Promise<RentalImage[]> {
  const result = await query<RentalImageRow>(
    `SELECT id, item_id, storage_key, alt_text, sort_order, created_at
     FROM rental_images
     WHERE item_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [itemId],
  );
  return result.rows.map(mapImage);
}

export async function uploadRentalImage(input: {
  user: AuthUser;
  itemId: string;
  file: File;
  altText?: unknown;
}): Promise<RentalImage> {
  await assertRentalItemImageAccess(input.user, input.itemId);

  if (!(input.file instanceof File) || input.file.size <= 0) {
    throw new RentalImageError(400, "IMAGE_REQUIRED", "An image file is required");
  }
  if (input.file.size > MAX_RENTAL_IMAGE_BYTES) {
    throw new RentalImageError(413, "IMAGE_TOO_LARGE", "Image must be 5 MB or smaller");
  }

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const detectedType = detectImageType(bytes);
  if (!detectedType) {
    throw new RentalImageError(
      415,
      "UNSUPPORTED_IMAGE",
      "Only JPEG, PNG, and WebP images are supported",
    );
  }
  if (input.file.type && input.file.type !== detectedType) {
    throw new RentalImageError(
      415,
      "IMAGE_TYPE_MISMATCH",
      "Declared image type does not match the file contents",
    );
  }

  const extension = IMAGE_TYPES[detectedType];
  const storageKey = `rental-items/${input.itemId}/${randomUUID()}.${extension}`;
  const altText = cleanAltText(input.altText);

  const currentCount = await query<QueryResultRow & { count: string }>(
    `SELECT COUNT(*)::text AS count FROM rental_images WHERE item_id = $1`,
    [input.itemId],
  );
  if (Number(currentCount.rows[0]?.count ?? 0) >= MAX_RENTAL_IMAGES) {
    throw new RentalImageError(409, "IMAGE_LIMIT_REACHED", `Maximum ${MAX_RENTAL_IMAGES} images per listing`);
  }

  try {
    await putObject({ key: storageKey, bytes, contentType: detectedType });
  } catch (error) {
    console.error("Failed to upload rental image to object storage", error);
    throw new RentalImageError(503, "STORAGE_UNAVAILABLE", "Image storage is unavailable");
  }

  try {
    const inserted = await withTransaction(async (client) => {
      const itemResult = await client.query<QueryResultRow & { owner_id: string }>(
        `SELECT owner_id FROM rental_items WHERE id = $1 FOR UPDATE`,
        [input.itemId],
      );
      const ownerId = itemResult.rows[0]?.owner_id;
      if (!ownerId) {
        throw new RentalImageError(404, "ITEM_NOT_FOUND", "Rental item not found");
      }
      assertResourceOwner(input.user, ownerId);

      const orderResult = await client.query<QueryResultRow & { count: string; max_sort: number | null }>(
        `SELECT COUNT(*)::text AS count, MAX(sort_order) AS max_sort
         FROM rental_images
         WHERE item_id = $1`,
        [input.itemId],
      );
      if (Number(orderResult.rows[0]?.count ?? 0) >= MAX_RENTAL_IMAGES) {
        throw new RentalImageError(409, "IMAGE_LIMIT_REACHED", `Maximum ${MAX_RENTAL_IMAGES} images per listing`);
      }
      const sortOrder = (orderResult.rows[0]?.max_sort ?? -1) + 1;

      const result = await client.query<RentalImageRow>(
        `INSERT INTO rental_images (item_id, storage_key, alt_text, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id, item_id, storage_key, alt_text, sort_order, created_at`,
        [input.itemId, storageKey, altText, sortOrder],
      );
      return mapImage(result.rows[0]);
    });
    return inserted;
  } catch (error) {
    try {
      await deleteObject(storageKey);
    } catch (cleanupError) {
      console.error("Failed to clean orphaned rental image", cleanupError);
    }
    throw error;
  }
}

async function lockImage(client: PoolClient, itemId: string, imageId: string): Promise<RentalImageRow | null> {
  const result = await client.query<RentalImageRow>(
    `SELECT id, item_id, storage_key, alt_text, sort_order, created_at
     FROM rental_images
     WHERE id = $1 AND item_id = $2
     FOR UPDATE`,
    [imageId, itemId],
  );
  return result.rows[0] ?? null;
}

export async function deleteRentalImage(input: {
  user: AuthUser;
  itemId: string;
  imageId: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    const itemResult = await client.query<QueryResultRow & { owner_id: string }>(
      `SELECT owner_id FROM rental_items WHERE id = $1 FOR UPDATE`,
      [input.itemId],
    );
    const ownerId = itemResult.rows[0]?.owner_id;
    if (!ownerId) throw new RentalImageError(404, "ITEM_NOT_FOUND", "Rental item not found");
    assertResourceOwner(input.user, ownerId);

    const image = await lockImage(client, input.itemId, input.imageId);
    if (!image) throw new RentalImageError(404, "IMAGE_NOT_FOUND", "Rental image not found");

    try {
      await deleteObject(image.storage_key);
    } catch (error) {
      console.error("Failed to delete rental image from object storage", error);
      throw new RentalImageError(503, "STORAGE_UNAVAILABLE", "Image storage is unavailable");
    }

    await client.query(`DELETE FROM rental_images WHERE id = $1`, [image.id]);
    await client.query(
      `WITH ordered AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) - 1 AS next_sort
         FROM rental_images
         WHERE item_id = $1
       )
       UPDATE rental_images ri
       SET sort_order = ordered.next_sort
       FROM ordered
       WHERE ri.id = ordered.id`,
      [input.itemId],
    );
  });
}

export async function reorderRentalImages(input: {
  user: AuthUser;
  itemId: string;
  orderedImageIds: string[];
}): Promise<RentalImage[]> {
  return withTransaction(async (client) => {
    const itemResult = await client.query<QueryResultRow & { owner_id: string }>(
      `SELECT owner_id FROM rental_items WHERE id = $1 FOR UPDATE`,
      [input.itemId],
    );
    const ownerId = itemResult.rows[0]?.owner_id;
    if (!ownerId) throw new RentalImageError(404, "ITEM_NOT_FOUND", "Rental item not found");
    assertResourceOwner(input.user, ownerId);

    const currentResult = await client.query<RentalImageRow>(
      `SELECT id, item_id, storage_key, alt_text, sort_order, created_at
       FROM rental_images
       WHERE item_id = $1
       ORDER BY sort_order ASC, created_at ASC
       FOR UPDATE`,
      [input.itemId],
    );
    const currentIds = currentResult.rows.map((row) => row.id);
    const ordered = input.orderedImageIds;
    const uniqueOrdered = new Set(ordered);
    const isSameSet =
      ordered.length === currentIds.length &&
      uniqueOrdered.size === currentIds.length &&
      currentIds.every((id) => uniqueOrdered.has(id));
    if (!isSameSet) {
      throw new RentalImageError(
        400,
        "INVALID_REORDER",
        "Reorder payload must contain every image exactly once",
      );
    }

    for (let index = 0; index < ordered.length; index += 1) {
      await client.query(
        `UPDATE rental_images SET sort_order = $3 WHERE item_id = $1 AND id = $2`,
        [input.itemId, ordered[index], index],
      );
    }

    const result = await client.query<RentalImageRow>(
      `SELECT id, item_id, storage_key, alt_text, sort_order, created_at
       FROM rental_images
       WHERE item_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [input.itemId],
    );
    return result.rows.map(mapImage);
  });
}

export async function loadRentalImageContent(imageId: string): Promise<{
  response: Response;
  contentType: string;
}> {
  const result = await query<RentalImageRow>(
    `SELECT id, item_id, storage_key, alt_text, sort_order, created_at
     FROM rental_images
     WHERE id = $1
     LIMIT 1`,
    [imageId],
  );
  const image = result.rows[0];
  if (!image) throw new RentalImageError(404, "IMAGE_NOT_FOUND", "Rental image not found");

  let response: Response;
  try {
    response = await getObject(image.storage_key);
  } catch (error) {
    console.error("Failed to load rental image from object storage", error);
    throw new RentalImageError(503, "STORAGE_UNAVAILABLE", "Image storage is unavailable");
  }

  const extension = image.storage_key.split(".").pop()?.toLowerCase();
  const contentType =
    response.headers.get("content-type") ||
    (extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg");
  return { response, contentType };
}
