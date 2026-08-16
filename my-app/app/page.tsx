"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AuthNavActions from "@/components/auth-nav-actions";

const items = [
  { id: 1, name: "PlayStation 5", category: "เกม", price: 300, owner: "Game House", emoji: "🎮", rating: 4.9 },
  { id: 2, name: "กล้อง Sony A7III", category: "อิเล็กทรอนิกส์", price: 850, owner: "Photo Lab", emoji: "📷", rating: 4.8 },
  { id: 3, name: "เต็นท์ 4 คน", category: "แคมป์ปิ้ง", price: 250, owner: "Camp Ubon", emoji: "⛺", rating: 4.9 },
  { id: 4, name: "เครื่องฉีดน้ำแรงดันสูง", category: "เครื่องมือ", price: 400, owner: "Tool Share", emoji: "🧰", rating: 4.7 },
  { id: 5, name: "เลนส์ 24-70mm", category: "อิเล็กทรอนิกส์", price: 500, owner: "Photo Lab", emoji: "🔭", rating: 4.8 },
  { id: 6, name: "จักรยานเสือภูเขา", category: "กีฬา", price: 350, owner: "Ride Hub", emoji: "🚲", rating: 4.9 },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const filtered = useMemo(
    () => items.filter((item) => (category === "ทั้งหมด" || item.category === category) && `${item.name} ${item.owner}`.toLowerCase().includes(searchQuery.toLowerCase())),
    [category, searchQuery],
  );

  return (
    <main className="min-h-screen bg-white text-gray-950">
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 py-3">
          <Link href="/" className="shrink-0 text-3xl font-black">P2P<span className="text-[#C9A227]">.</span></Link>
          <div className="hidden gap-8 text-sm font-semibold lg:flex">
            <a href="#items" className="hover:text-[#B08D18]">ของให้ยืม</a>
            <a href="#how" className="hover:text-[#B08D18]">วิธีใช้งาน</a>
            <Link href="/dashboard" className="hover:text-[#B08D18]">Dashboard</Link>
          </div>
          <AuthNavActions />
        </div>
      </nav>

      <section className="border-b bg-gradient-to-b from-[#fffdf7] to-white px-6 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[#e6d7a8] bg-[#fbf7e9] px-4 py-2 text-xs font-black tracking-[2px] text-[#9b7914]">PEER TO PEER RENTAL</span>
            <h1 className="mt-6 text-5xl font-black leading-tight md:text-7xl">ของที่อยากใช้<br /><span className="text-[#C9A227]">ไม่จำเป็นต้องซื้อ</span></h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-500">แพลตฟอร์มยืมของระหว่างคนกับคน ยืนยันตัวตนก่อนใช้งาน พูดคุย นัดรับ และจัดการการยืมได้ในที่เดียว</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#items" className="rounded-xl bg-black px-7 py-3.5 font-bold text-white hover:bg-gray-800">ค้นหาของให้ยืม</a>
              <Link href="/lend" className="rounded-xl border border-gray-200 bg-white px-7 py-3.5 font-bold hover:border-[#C9A227]">ฉันมีของให้ยืม</Link>
            </div>
          </div>
          <div className="mt-16 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-2xl font-black">1,200+</p><p className="mt-1 text-sm text-gray-500">รายการ</p></div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-2xl font-black">850+</p><p className="mt-1 text-sm text-gray-500">สมาชิก</p></div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-2xl font-black">4.9/5</p><p className="mt-1 text-sm text-gray-500">ความพึงพอใจ</p></div>
          </div>
        </div>
      </section>

      <section id="items" className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><p className="text-xs font-black tracking-[3px] text-[#C9A227]">DISCOVER</p><h2 className="mt-2 text-4xl font-black">ของให้ยืมใกล้คุณ</h2></div>
            <Link href="/rent" className="font-bold hover:text-[#B08D18]">ดูทั้งหมด →</Link>
          </div>
          <div className="mt-8 flex flex-col gap-3 md:flex-row">
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="ค้นหาของที่อยากยืม..." className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-5 py-3.5 outline-none focus:border-[#C9A227] focus:bg-white" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-5 py-3.5 outline-none focus:border-[#C9A227]"><option>ทั้งหมด</option><option>เกม</option><option>อิเล็กทรอนิกส์</option><option>แคมป์ปิ้ง</option><option>เครื่องมือ</option><option>กีฬา</option></select>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:-translate-y-1 hover:shadow-xl">
                <div className="flex h-52 items-center justify-center bg-gray-50 text-7xl">{item.emoji}</div>
                <div className="p-6">
                  <div className="flex justify-between"><span className="text-xs font-black text-[#A17E17]">{item.category}</span><span className="text-sm">⭐ {item.rating}</span></div>
                  <h3 className="mt-3 text-xl font-black">{item.name}</h3><p className="mt-1 text-sm text-gray-500">โดย {item.owner}</p>
                  <div className="mt-5 flex items-end justify-between gap-3"><p><span className="text-2xl font-black">฿{item.price.toLocaleString()}</span><span className="text-sm text-gray-500"> / วัน</span></p><Link href={`/rent/${item.id}`} className="rounded-lg bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800">ดูรายละเอียด</Link></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-7xl"><div className="text-center"><p className="text-xs font-black tracking-[3px] text-[#C9A227]">HOW IT WORKS</p><h2 className="mt-2 text-4xl font-black">ยืมของอย่างมั่นใจ</h2></div><div className="mt-12 grid gap-6 md:grid-cols-4">{[["01","ยืนยันตัวตน","บัตรประชาชน + สแกนหน้า"],["02","เลือกของ","ดูราคาและช่วงวันที่ว่าง"],["03","พูดคุยและตกลง","Chat กับเจ้าของโดยตรง"],["04","ยืมและคืน","ชำระเงิน รับของ และคืนตามกำหนด"]].map(([number,title,detail]) => <div key={number} className="rounded-2xl border bg-white p-7"><span className="text-3xl font-black text-[#C9A227]">{number}</span><h3 className="mt-5 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-gray-500">{detail}</p></div>)}</div></div>
      </section>

      <section className="px-6 py-20"><div className="mx-auto max-w-7xl rounded-3xl bg-black p-8 text-white md:p-14"><div className="max-w-2xl"><p className="text-xs font-black tracking-[3px] text-[#D4AF37]">LEND & EARN</p><h2 className="mt-3 text-4xl font-black md:text-5xl">มีของที่ไม่ได้ใช้?<br /><span className="text-[#D4AF37]">ปล่อยให้คนอื่นยืมได้</span></h2><p className="mt-5 leading-7 text-gray-400">ตั้งราคา กำหนดเงินประกัน และจัดการคำขอยืมผ่าน Dashboard ของคุณ</p><Link href="/lend" className="mt-7 inline-block rounded-xl bg-[#C9A227] px-6 py-3 font-black text-black">ลงของให้ยืม →</Link></div></div></section>
      <footer className="border-t bg-white px-6 py-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-sm text-gray-500 sm:flex-row"><span className="font-black text-gray-950">P2P<span className="text-[#C9A227]">.</span></span><span>Peer-to-Peer Rental Prototype</span></div></footer>
    </main>
  );
}
