"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      router.push(result.redirect);
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <a href="/" className="text-3xl font-black">P2P<span className="text-[#D4AF37]">.</span></a>
        <h1 className="mt-8 text-3xl font-black">เข้าสู่ระบบ</h1>
        <p className="mt-2 text-gray-500">เข้าสู่บัญชีเพื่อยืมของหรือให้ผู้อื่นยืมของ</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block text-sm font-semibold">อีเมล
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-[#D4AF37]" placeholder="you@example.com" />
          </label>
          <label className="block text-sm font-semibold">รหัสผ่าน
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-[#D4AF37]" placeholder="••••••••" />
          </label>
          <button disabled={loading} className="w-full rounded-lg bg-black py-3.5 font-bold text-white disabled:opacity-50">{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
        </form>
        {message && <p className="mt-4 rounded-lg bg-gray-100 p-3 text-center text-sm">{message}</p>}
        <div className="mt-6 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-3 text-xs text-gray-600">บัญชีผู้ใช้ทั่วไปที่ยังไม่ยืนยันตัวตนจะถูกส่งไปหน้า Verification ก่อนจึงจะยืมหรือให้ยืมของได้</div>
        <p className="mt-6 text-center text-sm text-gray-500">ยังไม่มีบัญชี? <a href="/register" className="font-bold text-[#B08D18]">สมัครสมาชิก</a></p>
      </div>
    </main>
  );
}
