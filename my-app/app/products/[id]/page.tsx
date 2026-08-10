"use client";

import { useState } from "react";

const data: Record<string, { name: string; price: number; category: string; seller: string; condition: string; emoji: string; description: string }> = {
  "1": { name: "MacBook Pro M2", price: 32900, category: "อิเล็กทรอนิกส์", seller: "Nont Store", condition: "มือสองสภาพดี", emoji: "💻", description: "MacBook Pro ชิป M2 เหมาะสำหรับทำงาน เขียนโปรแกรม และงานสร้างสรรค์ เครื่องใช้งานปกติและดูแลอย่างดี" },
  "2": { name: "Vintage Jacket", price: 1590, category: "แฟชั่น", seller: "Vintage Hub", condition: "สภาพดีมาก", emoji: "🧥", description: "แจ็กเก็ตวินเทจดีไซน์คลาสสิก สภาพดี เหมาะกับการแต่งตัวหลายสไตล์" },
  "3": { name: "PlayStation 5", price: 15900, category: "เกมและงานอดิเรก", seller: "Game House", condition: "พร้อมกล่อง", emoji: "🎮", description: "PlayStation 5 พร้อมอุปกรณ์พื้นฐานและกล่อง เหมาะสำหรับผู้ที่ต้องการเริ่มต้นเล่นเกมคอนโซล" },
  "4": { name: "iPhone 15 Pro", price: 23900, category: "อิเล็กทรอนิกส์", seller: "Mobile Corner", condition: "ประกันเหลือ", emoji: "📱", description: "iPhone 15 Pro สภาพดี มีประกันเหลือ พร้อมใช้งาน" },
  "5": { name: "เก้าอี้ทำงาน Ergonomic", price: 3490, category: "บ้านและของใช้", seller: "Home Select", condition: "ใช้งาน 6 เดือน", emoji: "🪑", description: "เก้าอี้ทำงานเพื่อสุขภาพ ใช้งานมา 6 เดือน เหมาะกับโต๊ะทำงานที่บ้านหรือออฟฟิศ" },
  "6": { name: "Mechanical Keyboard", price: 2290, category: "เกมและงานอดิเรก", seller: "KeyLab", condition: "เหมือนใหม่", emoji: "⌨️", description: "Mechanical Keyboard สภาพเหมือนใหม่ เสียงและสัมผัสดี เหมาะสำหรับเล่นเกมและทำงาน" },
};

export default function ProductDetail({ params }: { params: { id: string } }) {
  const [added, setAdded] = useState(false);
  const product = data[params.id];
  if (!product) return <main className="min-h-screen p-12 text-center"><h1 className="text-3xl font-bold">ไม่พบสินค้า</h1><a href="/products" className="mt-5 inline-block text-[#B08D18]">← กลับไปหน้าสินค้า</a></main>;
  return <main className="min-h-screen bg-white text-black"><header className="bg-black px-[6%] py-6 text-white"><div className="mx-auto flex max-w-7xl justify-between"><a href="/" className="text-3xl font-black">P2P<span className="text-[#D4AF37]">.</span></a><a href="/products" className="text-sm hover:text-[#D4AF37]">← สินค้าทั้งหมด</a></div></header><section className="px-[6%] py-14"><div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2"><div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-gray-100 text-[10rem]">{product.emoji}</div><div><p className="text-sm font-bold tracking-[2px] text-[#B08D18]">{product.category}</p><h1 className="mt-3 text-4xl font-black md:text-5xl">{product.name}</h1><p className="mt-4 text-3xl font-black">฿{product.price.toLocaleString()}</p><div className="mt-6 rounded-xl border p-5"><p className="font-bold">ผู้ขาย: {product.seller}</p><p className="mt-2 text-sm text-gray-500">สภาพสินค้า: {product.condition}</p><p className="mt-2 text-sm text-gray-500">คะแนนผู้ขาย: ★ 4.9 / 5</p></div><h2 className="mt-8 text-xl font-bold">รายละเอียดสินค้า</h2><p className="mt-3 leading-7 text-gray-600">{product.description}</p><div className="mt-8 flex gap-3"><button onClick={() => setAdded(true)} className="flex-1 rounded-lg bg-black px-6 py-4 font-bold text-white">{added ? "เพิ่มลงตะกร้าแล้ว ✓" : "เพิ่มลงตะกร้า"}</button><button className="rounded-lg border px-6 py-4">♡</button></div><button className="mt-3 w-full rounded-lg border border-[#D4AF37] px-6 py-4 font-bold hover:bg-[#D4AF37]">💬 ติดต่อผู้ขาย</button></div></div></section></main>;
}
