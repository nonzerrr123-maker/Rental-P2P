"use client";

import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "สมัครสมาชิกไม่สำเร็จ");
        return;
      }

      setDone(true);
      setPassword("");
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อระบบสมัครสมาชิกได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <Link href="/" className="text-3xl font-black">
          P2P<span className="text-[#D4AF37]">.</span>
        </Link>
        <h1 className="mt-8 text-3xl font-black">สมัครสมาชิก</h1>
        <p className="mt-2 text-gray-500">สร้างบัญชีเพื่อเริ่มยืมของหรือให้ผู้อื่นยืมของ</p>

        {done ? (
          <div className="mt-8 rounded-xl bg-gray-100 p-5 text-center">
            <p className="text-2xl">✓</p>
            <p className="mt-2 font-bold">สร้างบัญชีสำเร็จ</p>
            <p className="mt-2 text-sm text-gray-500">เข้าสู่ระบบเพื่อดำเนินการยืนยันตัวตนต่อ</p>
            <Link href="/login" className="mt-4 inline-block font-bold text-[#B08D18]">
              ไปเข้าสู่ระบบ
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block text-sm font-semibold">
              ชื่อผู้ใช้งาน
              <input
                required
                minLength={2}
                maxLength={80}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="ชื่อที่จะแสดงในระบบ"
                className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-[#D4AF37]"
              />
            </label>
            <label className="block text-sm font-semibold">
              อีเมล
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-[#D4AF37]"
              />
            </label>
            <label className="block text-sm font-semibold">
              รหัสผ่าน
              <input
                required
                minLength={8}
                maxLength={128}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-[#D4AF37]"
              />
            </label>
            <button
              disabled={loading}
              className="w-full rounded-lg bg-black py-3.5 font-bold text-white disabled:opacity-50"
            >
              {loading ? "กำลังสร้างบัญชี..." : "สร้างบัญชี"}
            </button>
          </form>
        )}

        {message && <p className="mt-4 rounded-lg bg-gray-100 p-3 text-center text-sm">{message}</p>}
        <p className="mt-6 text-center text-sm text-gray-500">
          มีบัญชีแล้ว?{" "}
          <Link href="/login" className="font-bold text-[#B08D18]">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
