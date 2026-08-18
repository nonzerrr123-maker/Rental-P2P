"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FormDescription, FormField, FormLabel, FormMessage } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { profileSettingsSchema, type ProfileSettingsInput } from "@/lib/forms/settings";

export default function ProfileSettingsForm({ displayName, phone }: { displayName: string; phone: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset } = useForm<ProfileSettingsInput>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: { displayName, phone: phone ?? "" },
  });

  const submit = handleSubmit(async (values) => {
    setMessage("");
    setSuccess(false);
    const response = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "บันทึกโปรไฟล์ไม่สำเร็จ");
      return;
    }
    reset({ displayName: result.profile.displayName, phone: result.profile.phone ?? "" });
    setSuccess(true);
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormField>
        <FormLabel htmlFor="settings-display-name">ชื่อที่แสดง</FormLabel>
        <Input id="settings-display-name" autoComplete="name" aria-invalid={Boolean(errors.displayName)} {...register("displayName")} />
        <FormDescription>ชื่อนี้จะแสดงใน Marketplace, Community, Chat และหน้าที่เกี่ยวข้องกับการยืม</FormDescription>
        <FormMessage>{errors.displayName?.message}</FormMessage>
      </FormField>
      <FormField>
        <FormLabel htmlFor="settings-phone">เบอร์โทร</FormLabel>
        <Input id="settings-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="เช่น 0812345678" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
        <FormDescription>ใช้เป็นข้อมูลบัญชีภายใน ระบบจะไม่แสดงเบอร์โทรใน Public Marketplace</FormDescription>
        <FormMessage>{errors.phone?.message}</FormMessage>
      </FormField>
      {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">บันทึกโปรไฟล์แล้ว</p>}
      <Button type="submit" size="lg" disabled={isSubmitting || !isDirty}>{isSubmitting ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</Button>
    </form>
  );
}
