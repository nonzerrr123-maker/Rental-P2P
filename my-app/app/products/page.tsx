"use client";

import { useMemo, useState } from "react";

const products = [
  { id: 1, name: "MacBook Pro M2", category: "อิเล็กทรอนิกส์", price: 32900, seller: "Nont Store", condition: "มือสองสภาพดี", emoji: "💻" },
  { id: 2, name: "Vintage Jacket", category: "แฟชั่น", price: 1590, seller: "Vintage Hub", condition: "สภาพดีมาก", emoji: "🧥" },
  { id: 3, name: "PlayStation 5", category: "เกมและงานอดิเรก", price: 15900, seller: "Game House", condition: "พร้อมกล่อง", emoji: "🎮" },
  { id: 4, name: "iPhone 15 Pro", category: "อิเล็กทรอนิกส์", price: 23900, seller: "Mobile Corner", condition: "ประกันเหลือ", emoji: "📱" },
  { id: 5, name: "เก้าอี้ทำงาน Ergonomic", category: "บ้านและของใช้", price: 3490, seller: "Home Select", condition: "ใช้งาน 6 เดือน", emoji: "🪑" },
  { id: 6, name: "Mechanical Keyboard", category: "เกมและงานอดิเรก", price: 2290, seller: "KeyLab", condition: "เหมือนใหม่", emoji: "⌨️" },
];

export default function ProductsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const [sort, setSort] = useState("ล่าสุด");
  const [favorites, setFavorites] = useState<number[]>([]);

  const result = useMemo(() => {
    const list = products.filter((p) => (category === "ทั้งหมด" || p.category === category) && `${p.name} ${p.seller}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === "ราคาต่ำสุด") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "ราคาสูงสุด") return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [query, category, sort]);

  return <main className="min-h-screen bg-gray-50 text-black">
    <header className="bg-black px-[6%] py-6 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between"><a href="/" className="text-3xl font-black">P2P<span className="text-[#D4AF37]">.</span></a><div className="flex gap-3"><a href="/login" className="rounded-md border border-gray-700 px-4 py-2 text-sm">เข้าสู่ระบบ</a><a href="/sell" className="rounded-md bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black">ลงขาย</a></div></div></header>
    <section className="px-[6%] py-12"><div className="mx-auto max-w-7xl"><p className="text-sm font-bold tracking-[3px] text-[#B08D18]">MARKETPLACE</p><h1 className="mt-2 text-4xl font-black">สินค้าทั้งหมด</h1><div className="mt-8 grid gap-3 md:grid-cols-[1fr_220px_180px]"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสินค้า..." className="rounded-lg border bg-white px-4 py-3 outline-none focus:border-[#D4AF37]"/><select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border bg-white px-4 py-3"><option>ทั้งหมด</option><option>อิเล็กทรอนิกส์</option><option>แฟชั่น</option><option>บ้านและของใช้</option><option>เกมและงานอดิเรก</option></select><select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border bg-white px-4 py-3"><option>ล่าสุด</option><option>ราคาต่ำสุด</option><option>ราคาสูงสุด</option></select></div></div></section>
    <section className="px-[6%] pb-20"><div className="mx-auto max-w-7xl"><p className="mb-6 text-sm text-gray-500">พบ {result.length} รายการ</p><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{result.map((p) => <article key={p.id} className="overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><a href={`/products/${p.id}`}><div className="flex h-60 items-center justify-center bg-gray-100 text-7xl">{p.emoji}</div></a><div className="p-6"><div className="flex justify-between text-xs"><span className="font-bold text-[#B08D18]">{p.category}</span><span className="text-gray-400">{p.condition}</span></div><a href={`/products/${p.id}`}><h2 className="mt-2 text-xl font-bold hover:text-[#B08D18]">{p.name}</h2></a><p className="mt-2 text-sm text-gray-500">โดย {p.seller}</p><div className="mt-5 flex items-center justify-between"><span className="text-2xl font-black">฿{p.price.toLocaleString()}</span><button onClick={() => setFavorites((f) => f.includes(p.id) ? f.filter((x) => x !== p.id) : [...f, p.id])} className="rounded-full border px-3 py-2">{favorites.includes(p.id) ? "♥" : "♡"}</button></div></div></article>)}</div></div></section>
  </main>;
}
