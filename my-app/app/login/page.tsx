"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/ui/primitives";
import { ArrowRightIcon, ShieldCheckIcon } from "@/components/ui/icons";

function safeNextPath(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok || !result.ok) { setMessage(result.message ?? "เข้าสู่ระบบไม่สำเร็จ"); return; }
      const isPrivileged = result.user?.role === "ADMIN" || result.user?.role === "SUPERADMIN";
      const canContinue = isPrivileged || result.user?.verificationStatus === "VERIFIED";
      const next = canContinue ? safeNextPath() : null;
      router.push(next ?? result.redirect ?? "/");
      router.refresh();
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-6 text-[var(--ink)] sm:grid sm:place-items-center sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between"><Link href="/"><BrandMark/></Link><Link href="/register" className="text-xs font-black text-[var(--gold-strong)]">สมัครสมาชิก</Link></div>
        <section className="mt-8 rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-8">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]"><ShieldCheckIcon size={22}/></div>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em]">ยินดีต้อนรับกลับ</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">เข้าสู่บัญชีเพื่อจัดการการยืม แชต การชำระ และของที่คุณปล่อยให้ยืม</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-sm font-bold">อีเมล<input required type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} className="bb-input mt-2 min-h-12" placeholder="you@example.com" /></label>
            <label className="block text-sm font-bold">รหัสผ่าน<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="bb-input mt-2 min-h-12" placeholder="••••••••" /></label>
            {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}
            <button disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-black text-white disabled:opacity-50">{loading ? "กำลังเข้าสู่ระบบ..." : <>เข้าสู่ระบบ<ArrowRightIcon size={17}/></>}</button>
          </form>
          <div className="mt-5 rounded-xl bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--muted-strong)]">บัญชีที่ยังไม่ผ่าน KYC จะถูกพาไปยืนยันตัวตนก่อนปลดล็อกการยืมและปล่อยของ</div>
        </section>
        <p className="mt-5 text-center text-xs text-[var(--muted)]">ยังไม่มีบัญชี? <Link href="/register" className="font-black text-[var(--ink)] underline decoration-[var(--gold)] underline-offset-4">สร้างบัญชี Borow Borow</Link></p>
      </div>
    </main>
  );
}
