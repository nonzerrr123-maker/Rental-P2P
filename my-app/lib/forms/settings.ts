import { z } from "zod";

const optionalPhone = z
  .string()
  .trim()
  .max(24, "เบอร์โทรยาวเกินไป")
  .refine((value) => value === "" || /^[0-9+()\-\s]{8,24}$/.test(value), "กรอกเบอร์โทรให้ถูกต้อง");

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(2, "ชื่ออย่างน้อย 2 ตัวอักษร").max(80, "ชื่อยาวเกิน 80 ตัวอักษร"),
  phone: optionalPhone,
});

export const passwordSettingsSchema = z
  .object({
    currentPassword: z.string().min(1, "กรอกรหัสผ่านปัจจุบัน"),
    newPassword: z.string().min(8, "รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร").max(128, "รหัสผ่านยาวเกิน 128 ตัวอักษร"),
    confirmPassword: z.string().min(1, "ยืนยันรหัสผ่านใหม่"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "รหัสผ่านใหม่ไม่ตรงกัน",
    path: ["confirmPassword"],
  });

export type ProfileSettingsInput = z.input<typeof profileSettingsSchema>;
export type ProfileSettingsOutput = z.output<typeof profileSettingsSchema>;
export type PasswordSettingsInput = z.input<typeof passwordSettingsSchema>;
