import { z } from "zod";

const localDateTime = z.string().min(1, "เลือกวันและเวลา");

export const bookingFormSchema = z
  .object({
    pricingMode: z.enum(["HOUR", "DAY"]),
    startsAt: localDateTime,
    endsAt: localDateTime,
  })
  .refine((value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(), {
    message: "เวลาคืนต้องอยู่หลังเวลาเริ่มยืม",
    path: ["endsAt"],
  });

export const reviewFormSchema = z.object({
  rating: z.number().int().min(1, "เลือกคะแนน 1–5 ดาว").max(5),
  comment: z.string().trim().max(1500, "รีวิวยาวเกิน 1,500 ตัวอักษร"),
});

export const communityRequestFormSchema = z
  .object({
    title: z.string().trim().min(3, "ชื่อสิ่งของอย่างน้อย 3 ตัวอักษร").max(120),
    category: z.string().trim().min(1, "เลือกหมวดหมู่").max(80),
    description: z.string().trim().min(10, "รายละเอียดอย่างน้อย 10 ตัวอักษร").max(3000),
    targetPrice: z.string().trim().refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 10_000_000), "งบเป้าหมายไม่ถูกต้อง"),
    neededStartsAt: localDateTime,
    neededEndsAt: localDateTime,
    province: z.string().trim().min(1, "กรอกจังหวัด").max(100),
    district: z.string().trim().max(100),
    subdistrict: z.string().trim().max(100),
    isUrgent: z.boolean(),
  })
  .refine((value) => new Date(value.neededEndsAt).getTime() > new Date(value.neededStartsAt).getTime(), {
    message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มใช้",
    path: ["neededEndsAt"],
  });

export const disputeOpenFormSchema = z.object({
  reason: z.string().trim().min(1, "เลือกสาเหตุ").max(200),
  details: z.string().trim().min(10, "อธิบายปัญหาอย่างน้อย 10 ตัวอักษร").max(3000),
});

export const disputeEvidenceFormSchema = z.object({
  description: z.string().trim().max(3000, "คำอธิบายยาวเกิน 3,000 ตัวอักษร"),
});

export type BookingFormInput = z.infer<typeof bookingFormSchema>;
export type ReviewFormInput = z.infer<typeof reviewFormSchema>;
export type CommunityRequestFormInput = z.infer<typeof communityRequestFormSchema>;
export type DisputeOpenFormInput = z.infer<typeof disputeOpenFormSchema>;
export type DisputeEvidenceFormInput = z.infer<typeof disputeEvidenceFormSchema>;
