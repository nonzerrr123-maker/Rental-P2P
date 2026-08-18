import { z } from "zod";

const reason = z.string().trim().min(3, "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร").max(500, "เหตุผลยาวเกิน 500 ตัวอักษร");

export const userModerationSchema = z.object({
  action: z.enum(["BAN", "UNBAN"]),
  reason,
});

export const listingModerationSchema = z.object({
  action: z.enum(["HIDE", "RESTORE"]),
  reason,
});

export type UserModerationInput = z.input<typeof userModerationSchema>;
export type ListingModerationInput = z.input<typeof listingModerationSchema>;
