"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/ui/primitives";
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from "@/components/ui/icons";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(""); setLoading(true);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, email, password }) });
      const result = await response.json();
      if (!response.ok || !result.ok) { setMessage(result.message ?? "สมัครสมาชิกไม่สำเร็จ"); return; }
      setDone(true); setPassword("");
    } catch { setMessage("ไม่สามารถเชื่อมต่อระบบสมัครสมาชิกได้"); }
    finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-6 text-[var(--ink)] sm:grid sm:place-items-center sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between"><Link href="/"><BrandMark/></Link><Link href="/login" className="text-xs font-black text-[var(--gold-strong)]">เข้าสู่ระบบ</Link></div>
        <section className="mt-8 rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-8">
          {done ? (
            <div className="py-5 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon size={26}/></div><h1 className="mt-5 text-2xl font-black tracking-[-0.035em]">สร้างบัญชีเรียบร้อย</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">ขั้นต่อไปเข้าสู่ระบบ แล้วทำ KYC เพื่อปลดล็อกการยืมและปล่อยของ</p><Link href="/login" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-black text-white">ไปเข้าสู่ระบบ<ArrowRightIcon size={17}/></Link></div>
          ) : (
            <><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]"><ShieldCheckIcon size={22}/></div><h1 className="mt-5 text-3xl font-black tracking-[-0.045em]">เริ่มใช้ Borow Borow</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">บัญชีเดียวใช้ได้ทั้งยืมของ ปล่อยของ และโพสต์หาใน Community</p>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block text-sm font-bold">ชื่อที่แสดง<input required minLength={2} maxLength={80} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="ชื่อที่คนอื่นจะเห็น" className="bb-input mt-2 min-h-12" /></label>
              <label className="block text-sm font-bold">อีเมล<input required type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="bb-input mt-2 min-h-12" /></label>
              <label className="block text-sm font-bold">รหัสผ่าน<input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" className="bb-input mt-2 min-h-12" /></label>
              {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}
              <button disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-black text-white disabled:opacity-50">{loading ? "กำลังสร้างบัญชี..." : <>สร้างบัญชี<ArrowRightIcon size={17}/></>}</button>
            </form></>)}
        </section>
        <p className="mt-5 text-center text-xs text-[var(--muted)]">มีบัญชีแล้ว? <Link href="/login" className="font-black text-[var(--ink)] underline decoration-[var(--gold)] underline-offset-4">เข้าสู่ระบบ</Link></p>
      </div>
    </main>
  );
}
