"use client";

import { useState } from "react";

const data = [
  { id: "R-0001", item: "PlayStation 5", borrower: "Somchai", lender: "Game House", total: 3900, status: "BORROWING" },
  { id: "R-0002", item: "เต็นท์ 4 คน", borrower: "Nida", lender: "Camp Ubon", total: 4200, status: "WAITING_PICKUP" },
  { id: "R-0003", item: "กล้อง Sony", borrower: "Anan", lender: "Photo Hub", total: 1800, status: "COMPLETED" },
];

export default function AdminRentals() {
  const [filter, setFilter] = useState("ALL");
  const statuses = ["ALL", "WAITING_PICKUP", "BORROWING", "RETURN_PENDING", "COMPLETED"];
  const visible = filter === "ALL" ? data : data.filter((x) => x.status === filter);
  return <main className="min-h-screen bg-[#f7f7f5] text-neutral-900"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><a href="/admin" className="text-2xl font-black">P2P<span className="text-[#c9a227]">.</span></a><a href="/admin" className="rounded-full border px-4 py-2 text-sm font-bold">Admin</a></div></header><div className="mx-auto max-w-6xl px-6 py-10"><span className="text-xs font-black tracking-[3px] text-[#a58316]">ADMIN / RENTALS</span><h1 className="mt-2 text-4xl font-black">รายการยืมทั้งหมด</h1><p className="mt-2 text-neutral-500">ติดตามสถานะ Rental ทุกรายการ</p><div className="mt-7 flex flex-wrap gap-2">{statuses.map((s) => <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-4 py-2 text-xs font-bold ${filter === s ? "bg-neutral-900 text-white" : "border bg-white hover:border-[#c9a227]"}`}>{s}</button>)}</div><section className="mt-6 overflow-hidden rounded-3xl border bg-white"><div className="hidden grid-cols-[110px_1fr_1fr_140px_160px] gap-4 border-b bg-neutral-50 px-6 py-4 text-xs font-black uppercase tracking-wide text-neutral-500 md:grid"><span>ID</span><span>สินค้า</span><span>คู่สัญญา</span><span>ยอดรวม</span><span>สถานะ</span></div>{visible.map((x) => <div key={x.id} className="grid gap-3 border-b p-6 last:border-0 md:grid-cols-[110px_1fr_1fr_140px_160px] md:items-center md:gap-4"><b>{x.id}</b><div><b>{x.item}</b><p className="text-xs text-neutral-500">ผู้ให้ยืม: {x.lender}</p></div><p className="text-sm text-neutral-600">ผู้ยืม: {x.borrower}</p><b>฿{x.total.toLocaleString()}</b><span className="w-fit rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{x.status}</span></div>)}</section></div></main>;
}
