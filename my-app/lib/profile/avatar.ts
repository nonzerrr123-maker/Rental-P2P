import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";
import { deleteObject, getObject, putObject } from "@/lib/storage/s3";

export const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
type AvatarContentType = keyof typeof TYPES;

type AvatarRow = QueryResultRow & { avatar_storage_key: string | null; avatar_content_type: string | null };

export class AvatarError extends Error {
  constructor(public readonly status: 400 | 404 | 413 | 415 | 503, public readonly code: string, message: string) {
    super(message);
    this.name = "AvatarError";
  }
}

function detectType(bytes: Uint8Array): AvatarContentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return "image/webp";
  return null;
}

async function avatarRow(userId: string): Promise<AvatarRow | null> {
  const result = await query<AvatarRow>(`SELECT avatar_storage_key, avatar_content_type FROM users WHERE id=$1 AND is_active=true LIMIT 1`, [userId]);
  return result.rows[0] ?? null;
}

export async function uploadAvatar(userId: string, file: File): Promise<{ contentUrl: string }> {
  if (!(file instanceof File) || file.size <= 0) throw new AvatarError(400, "IMAGE_REQUIRED", "กรุณาเลือกรูปโปรไฟล์");
  if (file.size > MAX_AVATAR_BYTES) throw new AvatarError(413, "IMAGE_TOO_LARGE", "รูปโปรไฟล์ต้องไม่เกิน 3 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectType(bytes);
  if (!detected) throw new AvatarError(415, "UNSUPPORTED_IMAGE", "รองรับเฉพาะ JPEG, PNG และ WebP");
  if (file.type && file.type !== detected) throw new AvatarError(415, "IMAGE_TYPE_MISMATCH", "ชนิดไฟล์ไม่ตรงกับข้อมูลจริงของรูป");
  const old = await avatarRow(userId);
  if (!old) throw new AvatarError(404, "USER_NOT_FOUND", "ไม่พบบัญชีผู้ใช้");
  const key = `user-avatars/${userId}/${randomUUID()}.${TYPES[detected]}`;
  try { await putObject({ key, bytes, contentType: detected }); }
  catch (error) { console.error("Avatar upload storage failure", error); throw new AvatarError(503, "STORAGE_UNAVAILABLE", "ระบบเก็บรูปยังไม่พร้อม"); }
  try {
    await query(`UPDATE users SET avatar_storage_key=$2, avatar_content_type=$3, avatar_updated_at=now() WHERE id=$1`, [userId, key, detected]);
  } catch (error) {
    await deleteObject(key).catch(() => undefined);
    throw error;
  }
  if (old.avatar_storage_key && old.avatar_storage_key !== key) await deleteObject(old.avatar_storage_key).catch((error) => console.error("Old avatar cleanup failed", error));
  return { contentUrl: `/api/users/${userId}/avatar?v=${Date.now()}` };
}

export async function removeAvatar(userId: string): Promise<void> {
  const old = await avatarRow(userId);
  if (!old) throw new AvatarError(404, "USER_NOT_FOUND", "ไม่พบบัญชีผู้ใช้");
  await query(`UPDATE users SET avatar_storage_key=NULL, avatar_content_type=NULL, avatar_updated_at=now() WHERE id=$1`, [userId]);
  if (old.avatar_storage_key) await deleteObject(old.avatar_storage_key).catch((error) => console.error("Avatar cleanup failed", error));
}

export async function readAvatar(userId: string): Promise<{ response: Response; contentType: string } | null> {
  const row = await avatarRow(userId);
  if (!row?.avatar_storage_key || !row.avatar_content_type) return null;
  try { return { response: await getObject(row.avatar_storage_key), contentType: row.avatar_content_type }; }
  catch (error) { console.error("Avatar read storage failure", error); throw new AvatarError(503, "STORAGE_UNAVAILABLE", "ระบบเก็บรูปยังไม่พร้อม"); }
}
