"use client";

import { useState } from "react";

const initialRequests = [
  { id: "V-0001", name: "Somchai", email: "somchai@example.com", submitted: "10 Aug 2026", status: "PENDING" },
  { id: "V-0002", name: "Anan", email: "anan@example.com", submitted: "10 Aug 2026", status: "PENDING" },
  { id: "V-0003", name: "Nida", email: "nida@example.com", submitted: "9 Aug 2026", status: "APPROVED" },
];

export default function AdminPage() {
  const [requests, setRequests] = useState(initialRequests);

  const updateStatus = (id: string, status: "APPROVED" | "REJECTED") => {
    setRequests((current) => current.map((request) => request.id === id ? { ...request, status } : request));
  };

  const pending = requests.filter((request) => request.status === "PENDING").length;

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12 text-black">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><p className="text-sm font-bold tracking-[3px] text-[#B08D18]">ADMIN CONSOLE</p><h1 className="mt-2 text-4xl font-black">Rental-P2P Admin</h1><p className="mt-2 text-gray-500">ตรวจสอบคำขอยืนยันตัวตนก่อนเปิดสิทธิ์การยืมและให้ยืม</p></div>
          <a href="/" className="font-semibold hover:text-[#B08D18]">← กลับหน้าหลัก</a>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6"><p className="text-sm text-gray-500">รอตรวจสอบ</p><p className="mt-2 text-4xl font-black text-[#B08D18]">{pending}</p></div>
          <div className="rounded-2xl border bg-white p-6"><p className="text-sm text-gray-500">อนุมัติแล้ว</p><p className="mt-2 text-4xl font-black">{requests.filter((r) => r.status === "APPROVED").length}</p></div>
          <div className="rounded-2xl border bg-white p-6"><p className="text-sm text-gray-500">ปฏิเสธ</p><p className="mt-2 text-4xl font-black">{requests.filter((r) => r.status === "REJECTED").length}</p></div>
        </div>

        <section className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-6"><h2 className="text-xl font-bold">Verification Requests</h2><p className="mt-1 text-sm text-gray-500">Admin ตรวจสอบคำขอจากผู้ใช้ แล้วเลือก Approve หรือ Reject</p></div>
          <div className="divide-y">
            {requests.map((request) => (
              <div key={request.id} className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
                <div><div className="flex items-center gap-3"><h3 className="font-bold">{request.name}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${request.status === "PENDING" ? "bg-yellow-100 text-yellow-800" : request.status === "APPROVED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{request.status}</span></div><p className="mt-1 text-sm text-gray-500">{request.email} · {request.id} · ส่งคำขอ {request.submitted}</p></div>
                {request.status === "PENDING" ? <div className="flex gap-3"><button onClick={() => updateStatus(request.id, "REJECTED")} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">Reject</button><button onClick={() => updateStatus(request.id, "APPROVED")} className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white hover:bg-gray-800">Approve</button></div> : <span className="text-sm text-gray-400">ดำเนินการแล้ว</span>}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-5 text-sm leading-6 text-gray-700"><strong>Prototype:</strong> สถานะในหน้านี้ยังเป็น NoSQL-style mock state เพื่อทำ flow ให้ครบก่อนต่อฐานข้อมูลจริง เมื่อเชื่อม production database การ Approve/Reject จะบันทึกลง verification request และเปลี่ยนสิทธิ์ผู้ใช้ผ่าน server-side authorization</div>
      </div>
    </main>
  );
}
