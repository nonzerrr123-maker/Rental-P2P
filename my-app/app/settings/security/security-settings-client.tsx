"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FormDescription, FormField, FormLabel, FormMessage } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { passwordSettingsSchema, type PasswordSettingsInput } from "@/lib/forms/settings";

export default function SecuritySettingsClient() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordSettingsInput>({
    resolver: zodResolver(passwordSettingsSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const changePassword = handleSubmit(async (values) => {
    setMessage("");
    setSuccess("");
    const response = await fetch("/api/settings/security/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setMessage(result.message ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      return;
    }
    reset();
    setSuccess(`เปลี่ยนรหัสผ่านแล้ว และออกจากระบบ ${result.revokedSessions ?? 0} session อื่นเพื่อความปลอดภัย`);
    router.refresh();
  });

  const revokeAllSessions = async () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    setRevoking(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings/security/sessions", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "ออกจากระบบทุกอุปกรณ์ไม่สำเร็จ");
        return;
      }
      router.replace("/login");
      router.refresh();
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={changePassword} className="space-y-4" noValidate>
        <div>
          <h2 className="text-lg font-black">เปลี่ยนรหัสผ่าน</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">เมื่อเปลี่ยนสำเร็จ ระบบจะคง session ปัจจุบันและ revoke session อื่นทั้งหมด</p>
        </div>
        <FormField>
          <FormLabel htmlFor="current-password">รหัสผ่านปัจจุบัน</FormLabel>
          <Input id="current-password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.currentPassword)} {...register("currentPassword")} />
          <FormMessage>{errors.currentPassword?.message}</FormMessage>
        </FormField>
        <FormField>
          <FormLabel htmlFor="new-password">รหัสผ่านใหม่</FormLabel>
          <Input id="new-password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.newPassword)} {...register("newPassword")} />
          <FormDescription>อย่างน้อย 8 ตัวอักษร และไม่ควรใช้รหัสเดียวกับบริการอื่น</FormDescription>
          <FormMessage>{errors.newPassword?.message}</FormMessage>
        </FormField>
        <FormField>
          <FormLabel htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</FormLabel>
          <Input id="confirm-password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
          <FormMessage>{errors.confirmPassword?.message}</FormMessage>
        </FormField>
        {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{success}</p>}
        <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}</Button>
      </form>

      <div className="border-t border-[var(--line)] pt-7">
        <h2 className="text-lg font-black">ออกจากระบบทุกอุปกรณ์</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">ใช้เมื่อทำอุปกรณ์หายหรือสงสัยว่ามีคนอื่นเข้าบัญชี การกดครั้งนี้จะรวมอุปกรณ์ปัจจุบันด้วย</p>
        <Button variant="destructive" className="mt-4" onClick={revokeAllSessions} disabled={revoking}>
          {revoking ? "กำลังออกจากระบบ..." : confirmRevoke ? "ยืนยันออกจากระบบทุกอุปกรณ์" : "ออกจากระบบทุกอุปกรณ์"}
        </Button>
        {confirmRevoke && !revoking && <button type="button" className="ml-3 text-xs font-black text-[var(--muted)]" onClick={() => setConfirmRevoke(false)}>ยกเลิก</button>}
      </div>
    </div>
  );
}
