"use client";

import { useState } from "react";

const initial = [
  { id: 1, title: "คำขอยืมได้รับการอนุมัติ", body: "Game House ยอมรับคำขอยืม PlayStation 5 ของคุณ", time: "5 นาทีที่แล้ว", read: false },
  { id: 2, title: "ถึงกำหนดชำระเงิน", body: "กรุณาชำระค่าเช่าและเงินประกันสำหรับ Rental R-0001", time: "20 นาทีที่แล้ว", read: false },
  { id: 3, title: "ยืนยันตัวตนสำเร็จ", body: "บัญชีของคุณได้รับการยืนยันแล้ว", time: "เมื่อวาน", read: true },
];

export default function NotificationsPage() {
  const [items, setItems] = useState(initial);
  const unread = items.filter((x) => !x.read).length;
  return <main className="min-h-screen bg-[#f7f7f5] text-neutral-900"><header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5"><a href="/" className="text-2xl font-black">P2P<span className="text-[#c9a227]">.</span></a><a href="/dashboard" className="rounded-full border px-4 py-2 text-sm font-bold">Dashboard</a></div></header><div className="mx-auto max-w-3xl px-6 py-12"><div className="flex items-end justify-between"><div><span className="text-xs font-black tracking-[3px] text-[#a58316]">NOTIFICATIONS</span><h1 className="mt-2 text-3xl font-black">การแจ้งเตือน</h1><p className="mt-2 text-neutral-500">มี {unread} รายการที่ยังไม่ได้อ่าน</p></div><button onClick={() => setItems(items.map((x) => ({ ...x, read: true })))} className="text-sm font-bold text-[#967718]">อ่านทั้งหมด</button></div><div className="mt-7 space-y-3">{items.map((n) => <button key={n.id} onClick={() => setItems(items.map((x) => x.id === n.id ? { ...x, read: true } : x))} className={`w-full rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${n.read ? "bg-white" : "border-[#e5d49a] bg-[#fffaf0]"}`}><div className="flex gap-4"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? "bg-neutral-200" : "bg-[#c9a227]"}`} /><div className="flex-1"><div className="flex justify-between gap-4"><b>{n.title}</b><span className="text-xs text-neutral-400">{n.time}</span></div><p className="mt-1 text-sm leading-6 text-neutral-500">{n.body}</p></div></div></button>)}</div></div></main>;
}
