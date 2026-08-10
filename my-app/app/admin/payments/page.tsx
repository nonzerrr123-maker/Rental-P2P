"use client";

import { useState } from "react";

const seed = [
  { id: "PAY-0001", rental: "R-0001", user: "Somchai", amount: 3900, type: "RENTAL + DEPOSIT", status: "PAID" },
  { id: "PAY-0002", rental: "R-0002", user: "Nida", amount: 4200, type: "RENTAL + DEPOSIT", status: "PENDING" },
  { id: "PAY-0003", rental: "R-0003", user: "Anan", amount: 1800, type: "RENTAL", status: "REFUNDED" },
];

export default function AdminPayments() {
  const [items, setItems] = useState(seed);
  const markPaid = (id: string) => setItems(items.map(x => x.id === id ? { ...x, status: "PAID" } : x));
  return <main className="min-h-screen bg-[#f7f7f5] text-neutral-900"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl justify-between px-6 py-5"><a href="/admin" className="text-2xl font-black">P2P<span className="text-[#c9a227]">.</span></a><a href="/admin" className="rounded-full border px-4 py-2 text-sm font-bold">Admin</a></div></header><div className="mx-auto max-w-6xl px-6 py-10"><span className="text-xs font-black tracking-[3px] text-[#a58316]">ADMIN / PAYMENTS</span><h1 className="mt-2 text-4xl font-black">การชำระเงิน</h1><p className="mt-2 text-neutral-500">ตรวจสอบรายการชำระเงิน เงินประกัน และสถานะคืนเงิน</p><div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">ยอดที่ชำระแล้ว</p><b className="mt-2 block text-3xl">฿5,700</b></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">รอชำระ</p><b className="mt-2 block text-3xl">฿4,200</b></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">คืนเงิน</p><b className="mt-2 block text-3xl">฿1,800</b></div></div><section className="mt-6 overflow-hidden rounded-3xl border bg-white"><div className="grid grid-cols-2 gap-4 border-b bg-neutral-50 px-6 py-4 text-xs font-black uppercase text-neutral-500 md:grid-cols-6"><span>ID</span><span>Rental</span><span className="col-span-2">ผู้ชำระ</span><span>ยอด</span><span>สถานะ</span></div>{items.map(x => <div key={x.id} className="grid gap-3 border-b p-6 last:border-0 md:grid-cols-6 md:items-center"><b>{x.id}</b><span>{x.rental}</span><div className="col-span-2"><b>{x.user}</b><p className="text-xs text-neutral-500">{x.type}</p></div><b>฿{x.amount.toLocaleString()}</b><div>{x.status === "PENDING" ? <button onClick={() => markPaid(x.id)} className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white">Mark paid</button> : <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{x.status}</span>}</div></div>)}</section></div></main>;
}
