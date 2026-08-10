"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState("");
  const submit = (e: React.FormEvent) => { e.preventDefault(); setMessage(email && password ? "เข้าสู่ระบบสำเร็จ (โหมดทดลอง)" : "กรุณากรอกอีเมลและรหัสผ่าน"); };
  return <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5"><div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm"><a href="/" className="text-3xl font-black">P2P<span className="text-[#D4AF37]">.</span></a><h1 className="mt-8 text-3xl font-black">เข้าสู่ระบบ</h1><p className="mt-2 text-gray-500">เข้าสู่บัญชีเพื่อจัดการการซื้อขายของคุณ</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-semibold">อีเมล<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-[#D4AF37]" placeholder="you@example.com" /></label><label className="block text-sm font-semibold">รหัสผ่าน<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-[#D4AF37]" placeholder="••••••••" /></label><button className="w-full rounded-lg bg-black py-3.5 font-bold text-white">เข้าสู่ระบบ</button></form>{message && <p className="mt-4 rounded-lg bg-gray-100 p-3 text-center text-sm">{message}</p>}<p className="mt-6 text-center text-sm text-gray-500">ยังไม่มีบัญชี? <a href="/register" className="font-bold text-[#B08D18]">สมัครสมาชิก</a></p></div></main>;
}
