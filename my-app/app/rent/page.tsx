"use client";

import { useMemo, useState } from "react";

const items = [
  { id: 1, title: "PlayStation 5", category: "เกม", price: 300, deposit: 3000, location: "อุบลราชธานี", owner: "Game House", rating: 4.9, emoji: "🎮" },
  { id: 2, title: "เต็นท์ 4 คน", category: "แคมป์ปิ้ง", price: 250, deposit: 1500, location: "อุบลราชธานี", owner: "Camp Gear", rating: 4.8, emoji: "⛺" },
  { id: 3, title: "โปรเจคเตอร์ Full HD", category: "อิเล็กทรอนิกส์", price: 400, deposit: 2500, location: "ศรีสะเกษ", owner: "Movie Night", rating: 5.0, emoji: "📽️" },
  { id: 4, title: "สว่านไร้สาย", category: "เครื่องมือ", price: 180, deposit: 1000, location: "อุบลราชธานี", owner: "Tool Share", rating: 4.7, emoji: "🔧" },
];

export default function RentPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const filtered = useMemo(() => items.filter((item) => (category === "ทั้งหมด" || item.category === category) && `${item.title} ${item.location} ${item.owner}`.toLowerCase().includes(query.toLowerCase())), [query, category]);
  const categories = ["ทั้งหมด", ...Array.from(new Set(items.map((i) => i.category)))];

  return <main className="min-h-screen bg-gray-50 text-black">
    <header className="border-b bg-black px-6 py-5 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between"><a href="/" className="text-2xl font-black">P2P<span className="text-[#D4AF37]">.</span></a><a href="/verification" className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:border-[#D4AF37]">ยืนยันตัวตน</a></div></header>
    <section className="bg-white px-6 py-14"><div className="mx-auto max-w-7xl"><p className="text-sm font-bold tracking-[3px] text-[#B08D18]">RENTAL MARKETPLACE</p><h1 className="mt-3 text-4xl font-black">ของที่ต้องการ อาจอยู่ใกล้กว่าที่คิด</h1><p className="mt-3 text-gray-500">ค้นหาของจากคนในพื้นที่ แล้วส่งคำขอยืมได้เมื่อยืนยันตัวตนแล้ว</p><div className="mt-8 flex flex-col gap-3 md:flex-row"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาเต็นท์ กล้อง เครื่องมือ เกม..." className="flex-1 rounded-lg border px-4 py-3 outline-none focus:border-[#D4AF37]" /><select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border bg-white px-4 py-3">{categories.map((c) => <option key={c}>{c}</option>)}</select></div></div></section>
    <section className="px-6 py-12"><div className="mx-auto max-w-7xl"><div className="mb-7 flex items-end justify-between"><div><h2 className="text-2xl font-black">ของให้ยืมใกล้คุณ</h2><p className="mt-1 text-sm text-gray-500">พบ {filtered.length} รายการ</p></div></div><div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">{filtered.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex h-48 items-center justify-center bg-gray-100 text-6xl">{item.emoji}</div><div className="p-5"><div className="flex justify-between gap-2"><span className="text-xs font-bold text-[#B08D18]">{item.category}</span><span className="text-xs text-gray-500">📍 {item.location}</span></div><h3 className="mt-2 text-lg font-bold">{item.title}</h3><p className="mt-1 text-sm text-gray-500">โดย {item.owner} · ⭐ {item.rating}</p><div className="mt-4"><span className="text-xl font-black">฿{item.price.toLocaleString()}</span><span className="text-sm text-gray-500"> / วัน</span></div><p className="mt-1 text-xs text-gray-500">เงินประกัน ฿{item.deposit.toLocaleString()}</p><a href={`/rent/${item.id}`} className="mt-4 block rounded-lg bg-black px-4 py-3 text-center text-sm font-bold text-white hover:bg-gray-800">ดูรายละเอียด / ขอยืม</a></div></article>)}</div>{filtered.length === 0 && <div className="mt-6 rounded-xl border border-dashed bg-white p-12 text-center text-gray-500">ไม่พบของที่ต้องการ</div>}</div></section>
  </main>;
}
