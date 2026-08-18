"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FormField, FormLabel, FormMessage } from "@/components/ui/form-field";
import { userModerationSchema, type UserModerationInput } from "@/lib/forms/moderation";

export default function UserModerationControl({ userId, isActive, protectedAccount = false }: { userId: string; isActive: boolean; protectedAccount?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const action = isActive ? "BAN" : "UNBAN";
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserModerationInput>({
    resolver: zodResolver(userModerationSchema),
    defaultValues: { action, reason: "" },
  });

  const submit = handleSubmit(async (values) => {
    setMessage("");
    const response = await fetch(`/api/admin/users/${userId}/moderation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, action }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "จัดการผู้ใช้ไม่สำเร็จ");
      return;
    }
    reset({ action, reason: "" });
    router.refresh();
  });

  if (protectedAccount) {
    return <p className="text-xs font-bold text-[var(--muted)]">บัญชี SUPERADMIN ได้รับการป้องกันจาก moderation</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <input type="hidden" value={action} {...register("action")} />
      <FormField>
        <FormLabel htmlFor={`reason-${userId}`}>เหตุผล</FormLabel>
        <textarea id={`reason-${userId}`} rows={2} placeholder={isActive ? "เหตุผลที่ระงับบัญชี..." : "เหตุผลที่เปิดบัญชีกลับ..."} className="bb-input resize-y text-sm" aria-invalid={Boolean(errors.reason)} {...register("reason")} />
        <FormMessage>{errors.reason?.message}</FormMessage>
      </FormField>
      {message && <p role="alert" className="text-xs font-bold text-red-700">{message}</p>}
      <Button type="submit" size="sm" variant={isActive ? "destructive" : "outline"} disabled={isSubmitting}>
        {isSubmitting ? "กำลังบันทึก..." : isActive ? "แบนผู้ใช้" : "ปลดแบน"}
      </Button>
    </form>
  );
}
