import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("กรอกอีเมลให้ถูกต้อง").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "กรอกรหัสผ่าน"),
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, "ชื่ออย่างน้อย 2 ตัวอักษร").max(80, "ชื่อยาวเกิน 80 ตัวอักษร"),
  email: z.string().trim().email("กรอกอีเมลให้ถูกต้อง").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร").max(128, "รหัสผ่านยาวเกิน 128 ตัวอักษร"),
});

export const emailOnlySchema = z.object({
  email: z.string().trim().email("กรอกอีเมลให้ถูกต้อง").transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร").max(128, "รหัสผ่านยาวเกิน 128 ตัวอักษร"),
    confirmPassword: z.string().min(1, "ยืนยันรหัสผ่านอีกครั้ง"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.input<typeof loginSchema>;
export type RegisterFormValues = z.input<typeof registerSchema>;
export type EmailOnlyFormValues = z.input<typeof emailOnlySchema>;
export type ResetPasswordFormValues = z.input<typeof resetPasswordSchema>;
