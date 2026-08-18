"use client";

import { useRef, useState } from "react";
import UserAvatar from "@/components/user-avatar";
import { Button } from "@/components/ui/button";

export default function AvatarSettings({ userId, displayName }: { userId: string; displayName: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const announceAvatarUpdate = () => {
    setVersion((current) => current + 1);
    window.dispatchEvent(new Event("borow:avatar-updated"));
  };

  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/settings/profile/avatar", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "อัปโหลดรูปไม่สำเร็จ");
      announceAvatarUpdate();
      setMessage("อัปเดตรูปโปรไฟล์แล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings/profile/avatar", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "ลบรูปไม่สำเร็จ");
      announceAvatarUpdate();
      setMessage("ลบรูปโปรไฟล์แล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ลบรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 flex flex-col gap-4 rounded-2xl bg-[var(--surface-2)] p-4 sm:flex-row sm:items-center">
      <UserAvatar userId={userId} displayName={displayName} version={version} className="h-20 w-20 rounded-2xl text-xl" />
      <div className="flex-1">
        <p className="font-black">รูปโปรไฟล์</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">JPEG / PNG / WebP · สูงสุด 3 MB · รูปถูก proxy ผ่าน Borow Borow โดยไม่เปิด storage key</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "กำลังบันทึก..." : "เลือกรูป"}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void remove()} disabled={busy}>ลบรูป</Button>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
        {message && <p role="status" className="mt-2 text-xs font-bold text-[var(--muted-strong)]">{message}</p>}
      </div>
    </section>
  );
}
