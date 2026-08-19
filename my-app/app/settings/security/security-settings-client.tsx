"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FormDescription, FormField, FormLabel, FormMessage } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { passwordSettingsSchema, type PasswordSettingsInput } from "@/lib/forms/settings";

type SessionSummary = {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
};

const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

export default function SecuritySettingsClient() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordSettingsInput>({
    resolver: zodResolver(passwordSettingsSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await fetch("/api/settings/security/sessions", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "โหลด session ไม่สำเร็จ");
      setSessions(result.sessions ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลด session ไม่สำเร็จ");
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => { void loadSessions(); }, []);

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
    await loadSessions();
    router.refresh();
  });

  const revokeSession = async (sessionId: string) => {
    setMessage("");
    setSuccess("");
    setRevokingSessionId(sessionId);
    try {
      const response = await fetch("/api/settings/security/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "ออกจาก session ไม่สำเร็จ");
        return;
      }
      if (result.currentSessionRevoked) {
        router.replace("/login");
        router.refresh();
        return;
      }
      setSessions((current) => current.filter((session) => session.id !== sessionId));
      setSuccess("ออกจาก session ที่เลือกแล้ว");
      router.refresh();
    } finally {
      setRevokingSessionId("");
    }
  };

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
      <section>
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-black">Session ที่กำลังใช้งาน</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">ตรวจว่ามี session อื่นค้างอยู่หรือไม่ และออกจากระบบเฉพาะ session ที่ไม่ต้องการได้</p></div>
          <button type="button" onClick={() => void loadSessions()} disabled={sessionsLoading} className="shrink-0 text-xs font-black text-[var(--gold-strong)] disabled:opacity-50">รีเฟรช</button>
        </div>
        <div className="mt-4 space-y-2">
          {sessionsLoading && sessions.length === 0 && <div className="rounded-xl bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">กำลังโหลด session...</div>}
          {sessions.map((session) => (
            <div key={session.id} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${session.current ? "border-[var(--gold-line)] bg-[var(--gold-soft)]" : "border-[var(--line)] bg-white"}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black">{session.current ? "อุปกรณ์นี้" : "Session อื่น"}</p>{session.current && <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-[var(--gold-strong)]">CURRENT</span>}</div>
                <p className="mt-1 text-xs text-[var(--muted)]">ใช้งานล่าสุด {dateTime.format(new Date(session.lastSeenAt ?? session.createdAt))}</p>
                <p className="mt-1 text-[10px] text-[var(--muted)]">สร้างเมื่อ {dateTime.format(new Date(session.createdAt))} · หมดอายุ {dateTime.format(new Date(session.expiresAt))}</p>
              </div>
              {!session.current && <Button type="button" variant="outline" size="sm" disabled={revokingSessionId === session.id} onClick={() => void revokeSession(session.id)}>{revokingSessionId === session.id ? "กำลังออก..." : "ออกจาก session นี้"}</Button>}
            </div>
          ))}
          {!sessionsLoading && sessions.length === 0 && <div className="rounded-xl bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">ไม่พบ session ที่ยังใช้งานได้</div>}
        </div>
      </section>

      <form onSubmit={changePassword} className="space-y-4 border-t border-[var(--line)] pt-7" noValidate>
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
