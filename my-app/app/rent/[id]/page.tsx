"use client";

import { useMemo, useState } from "react";
import { existingBookings, overlaps } from "./availability";

const item = { title: "PlayStation 5", category: "เกม", location: "อุบลราชธานี", owner: "Game House", price: 300, deposit: 3000, rating: 4.9, emoji: "🎮" };

export default function RentalDetail() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [requested, setRequested] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  const days = useMemo(() => {
    if (!start || !end) return 0;
    const diff = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  }, [start, end]);

  const total = days * item.price;
  const unavailable = start && end ? overlaps(start, end, existingBookings) : false;

  const requestRental = () => {
    if (!start || !end || !days) return;
    if (overlaps(start, end, existingBookings)) {
      setAvailabilityError("ช่วงวันที่เลือกมีคนจองแล้ว กรุณาเลือกวันอื่น");
      return;
    }
    setAvailabilityError("");
    setRequested(true);
  };

  return <main className="min-h-screen bg-gray-50 text-black">
    <header className="border-b bg-black px-6 py-5 text-white"><div className="mx-auto flex max-w-6xl items-center justify-between"><a href="/rent" className="text-sm text-gray-300 hover:text-white">← กลับไปดูของให้ยืม</a><a href="/" className="text-2xl font-black">P2P<span className="text-[#D4AF37]">.</span></a></div></header>
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-2">
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-gray-200 text-9xl">{item.emoji}</div>
      <section className="rounded-2xl border bg-white p-8">
        <span className="text-sm font-bold text-[#B08D18]">{item.category} · {item.location}</span><h1 className="mt-3 text-4xl font-black">{item.title}</h1><p className="mt-3 text-gray-500">เครื่องพร้อมใช้งาน เหมาะสำหรับเล่นเกมหรือจัดกิจกรรม สามารถนัดรับในพื้นที่ได้</p>
        <div className="my-8 grid grid-cols-2 gap-4"><div className="rounded-lg bg-gray-50 p-4"><p className="text-xs text-gray-500">ค่าเช่า</p><p className="mt-1 text-2xl font-black">฿{item.price} <span className="text-sm font-normal">/ วัน</span></p></div><div className="rounded-lg bg-gray-50 p-4"><p className="text-xs text-gray-500">เงินประกัน</p><p className="mt-1 text-2xl font-black">฿{item.deposit.toLocaleString()}</p></div></div>
        <div className="rounded-xl border p-5"><div className="flex items-center justify-between"><div><b>{item.owner}</b><p className="mt-1 text-sm text-gray-500">🟢 ยืนยันตัวตนแล้ว · ⭐ {item.rating}</p></div><button onClick={() => setChatOpen(true)} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:border-[#D4AF37]">💬 พูดคุย</button></div></div>
        <div className="mt-6 rounded-xl border p-5"><h2 className="font-bold">📅 เลือกช่วงเวลายืม</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">วันเริ่มยืม<input type="date" value={start} onChange={(e) => { setStart(e.target.value); setAvailabilityError(""); }} min={new Date().toISOString().slice(0,10)} className="mt-2 w-full rounded-lg border px-3 py-3 font-normal" /></label><label className="text-sm font-semibold">วันคืน<input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setAvailabilityError(""); }} min={start || new Date().toISOString().slice(0,10)} className="mt-2 w-full rounded-lg border px-3 py-3 font-normal" /></label></div>{unavailable && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">🔴 ช่วงวันที่นี้ไม่ว่าง มีรายการจองอยู่แล้ว</p>}{!unavailable && days > 0 && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">🟢 ช่วงวันที่นี้ว่าง</p>}</div>
        {days > 0 && <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm"><div className="flex justify-between"><span>ระยะเวลา</span><b>{days} วัน</b></div><div className="mt-2 flex justify-between"><span>ค่าเช่า</span><b>฿{total.toLocaleString()}</b></div><div className="mt-2 flex justify-between"><span>เงินประกัน</span><b>฿{item.deposit.toLocaleString()}</b></div></div>}
        {availabilityError && <p className="mt-4 text-sm font-bold text-red-600">{availabilityError}</p>}
        {requested ? <div className="mt-5 rounded-xl border border-[#D4AF37] bg-[#fffaf0] p-5"><b>ส่งคำขอยืมแล้ว ✓</b><p className="mt-1 text-sm text-gray-600">สถานะ: PENDING · รอผู้ให้ยืมตอบรับ</p><a href="/chat" className="mt-3 inline-block font-bold text-[#9b7b12]">เปิดแชต →</a></div> : <button disabled={!days || !!unavailable} onClick={requestRental} className="mt-6 w-full rounded-lg bg-[#D4AF37] px-5 py-4 font-black text-black enabled:hover:bg-[#e5c04a] disabled:cursor-not-allowed disabled:opacity-40">{unavailable ? "ช่วงเวลานี้ไม่ว่าง" : days ? `ขอยืม ${days} วัน · ฿${total.toLocaleString()}` : "เลือกวันยืมและวันคืนก่อน"}</button>}
        {chatOpen && <div className="mt-5 rounded-xl border bg-black p-5 text-white"><div className="flex items-center justify-between"><b>💬 Chat · {item.owner}</b><button onClick={() => setChatOpen(false)} className="text-gray-400">ปิด</button></div><p className="mt-4 rounded-lg bg-gray-800 p-3 text-sm">สวัสดีครับ สอบถามรายละเอียดการยืมได้เลยครับ</p><div className="mt-3 flex gap-2"><input placeholder="พิมพ์ข้อความ..." className="flex-1 rounded-lg px-3 py-2 text-black" /><button className="rounded-lg bg-[#D4AF37] px-4 py-2 font-bold text-black">ส่ง</button></div></div>}
        <p className="mt-4 text-center text-xs text-gray-400">Prototype: production จะตรวจ availability จาก server/transaction เพื่อป้องกันการจองซ้อนพร้อมกัน</p>
      </section>
    </div>
  </main>;
}
