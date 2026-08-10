"use client";

import { useState } from "react";

const initial = [
  { id: "D-0001", rental: "R-0001", user: "Somchai", reason: "ของเสียหาย", detail: "พบรอยบนเครื่องหลังรับคืน", status: "PENDING_REVIEW" },
  { id: "D-0002", rental: "R-0007", user: "Nida", reason: "คืนล่าช้า", detail: "คืนของช้ากว่ากำหนด 2 วัน", status: "RESOLVED" },
];

export default function AdminDisputes() {
  const [items, setItems] = useState(initial);
  const resolve = (id: string) => setItems(items.map((x) => x.id === id ? { ...x, status: "RESOLVED" } : x));
  return <main className="min-h-screen bg-[#f7f7f5] text-neutral-900"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><a href="/admin" className="text-2xl font-black">P2P<span className="text-[#c9a227]">.</span></a><div className="flex gap-3"><a href="/admin" className="rounded-full border px-4 py-2 text-sm font-bold">Admin</a><a href="/dashboard" className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-bold text-white">Dashboard</a></div></div></header><div className="mx-auto max-w-6xl px-6 py-10"><span className="text-xs font-black tracking-[3px] text-[#a58316]">ADMIN / DISPUTES</span><h1 className="mt-2 text-4xl font-black">จัดการข้อพิพาท</h1><p className="mt-2 text-neutral-500">ตรวจสอบปัญหาจากรายการยืมและบันทึกผลการแก้ไข</p><div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">รอตรวจสอบ</p><b className="mt-2 block text-3xl">{items.filter(x => x.status === "PENDING_REVIEW").length}</b></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">แก้ไขแล้ว</p><b className="mt-2 block text-3xl">{items.filter(x => x.status === "RESOLVED").length}</b></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">ทั้งหมด</p><b className="mt-2 block text-3xl">{items.length}</b></div></div><section className="mt-6 divide-y overflow-hidden rounded-3xl border bg-white">{items.map((x) => <div key={x.id} className="p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row"><div><div className="flex flex-wrap items-center gap-3"><b className="text-lg">{x.id}</b><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{x.status}</span></div><p className="mt-2 text-sm text-neutral-500">Rental {x.rental} · {x.user}</p><p className="mt-4 font-bold">{x.reason}</p><p className="mt-1 text-sm leading-6 text-neutral-500">{x.detail}</p></div>{x.status === "PENDING_REVIEW" && <button onClick={() => resolve(x.id)} className="self-start rounded-xl bg-neutral-900 px-5 py-3 text-sm font-black text-white hover:bg-neutral-700">ตรวจสอบและปิดเคส</button>}</div></div>)}</section></div></main>;
}
