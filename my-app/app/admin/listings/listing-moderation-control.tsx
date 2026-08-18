"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FormField, FormLabel, FormMessage } from "@/components/ui/form-field";
import { listingModerationSchema, type ListingModerationInput } from "@/lib/forms/moderation";

export default function ListingModerationControl({ itemId, status }: { itemId: string; status: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const archived = status === "ARCHIVED";
  const action = status === "PAUSED" ? "RESTORE" : "HIDE";
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ListingModerationInput>({
    resolver: zodResolver(listingModerationSchema),
    defaultValues: { action, reason: "" },
  });

  const submit = handleSubmit(async (values) => {
    setMessage("");
    const response = await fetch(`/api/admin/listings/${itemId}/moderation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, action }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "จัดการประกาศไม่สำเร็จ");
      return;
    }
    reset({ action, reason: "" });
    router.refresh();
  });

  if (archived) return <p className="text-xs font-bold text-[var(--muted)]">รายการ Archive แล้ว ไม่เปิดคืนจากหน้านี้</p>;

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <input type="hidden" value={action} {...register("action")} />
      <FormField>
        <FormLabel htmlFor={`listing-reason-${itemId}`}>เหตุผล</FormLabel>
        <textarea id={`listing-reason-${itemId}`} rows={2} placeholder={action === "HIDE" ? "เหตุผลที่ซ่อนประกาศ..." : "เหตุผลที่คืนประกาศ..."} className="bb-input resize-y text-sm" aria-invalid={Boolean(errors.reason)} {...register("reason")} />
        <FormMessage>{errors.reason?.message}</FormMessage>
      </FormField>
      {message && <p role="alert" className="text-xs font-bold text-red-700">{message}</p>}
      <Button type="submit" size="sm" variant={action === "HIDE" ? "destructive" : "outline"} disabled={isSubmitting}>
        {isSubmitting ? "กำลังบันทึก..." : action === "HIDE" ? "ซ่อนประกาศ" : "คืนประกาศ"}
      </Button>
    </form>
  );
}
