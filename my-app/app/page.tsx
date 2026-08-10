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

const categories = [
  { name: "อิเล็กทรอนิกส์", emoji: "📱", desc: "โทรศัพท์ คอมพิวเตอร์ และอุปกรณ์ไอที" },
  { name: "แฟชั่น", emoji: "👕", desc: "เสื้อผ้า รองเท้า และเครื่องประดับ" },
  { name: "บ้านและของใช้", emoji: "🏠", desc: "เฟอร์นิเจอร์ ของตกแต่ง และของใช้" },
  { name: "เกมและงานอดิเรก", emoji: "🎮", desc: "เกม ของสะสม และอุปกรณ์ต่าง ๆ" },
];

const money = (value: number) => `฿${value.toLocaleString("th-TH")}`;

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [cart, setCart] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = category === "ทั้งหมด" || product.category === category;
      const matchesQuery = `${product.name} ${product.category} ${product.seller}`.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const toggleFavorite = (id: number) => {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const addToCart = (id: number) => {
    setCart((current) => current.includes(id) ? current : [...current, id]);
  };

  return (
    <main className="min-h-screen bg-white text-black">
      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-black px-[6%] text-white shadow-lg">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6">
          <a href="/" className="shrink-0 text-3xl font-black tracking-tight">P2P<span className="text-[#D4AF37]">.</span></a>
          <div className="hidden items-center gap-7 text-sm md:flex">
            <a href="#home" className="hover:text-[#D4AF37]">หน้าหลัก</a>
            <a href="#products" className="hover:text-[#D4AF37]">สินค้า</a>
            <a href="#how" className="hover:text-[#D4AF37]">วิธีใช้งาน</a>
            <a href="#about" className="hover:text-[#D4AF37]">เกี่ยวกับเรา</a>
          </div>
          <div className="flex items-center gap-2">
            <a href="/login" className="hidden rounded-md border border-gray-600 px-4 py-2 text-sm hover:border-[#D4AF37] sm:block">เข้าสู่ระบบ</a>
            <a href="/sell" className="rounded-md bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black hover:bg-[#e5c04a]">ลงขายสินค้า</a>
            <button onClick={() => setMenuOpen(!menuOpen)} className="relative rounded-md border border-gray-700 px-3 py-2 md:hidden">☰</button>
          </div>
        </div>
        {menuOpen && <div className="border-t border-gray-800 py-4 md:hidden"><div className="flex flex-col gap-4 text-sm"><a href="#products">สินค้า</a><a href="#how">วิธีใช้งาน</a><a href="/login">เข้าสู่ระบบ</a></div></div>}
      </nav>

      <section id="home" className="relative overflow-hidden bg-black px-[6%] py-24 text-white md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="mb-5 text-sm font-bold tracking-[4px] text-[#D4AF37]">PEER TO PEER MARKETPLACE</p>
            <h1 className="text-5xl font-black leading-tight md:text-7xl">ซื้อขายง่าย<br /><span className="text-[#D4AF37]">ระหว่างคนกับคน</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-gray-400">ตลาดซื้อขายของมือหนึ่งและมือสองที่เชื่อมผู้ซื้อกับผู้ขายโดยตรง ค้นหาของที่ใช่ในราคาที่ใช่</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <a href="#products" className="rounded-md bg-[#D4AF37] px-7 py-3.5 font-bold text-black hover:bg-[#e5c04a]">เริ่มช้อปปิ้ง</a>
              <a href="/sell" className="rounded-md border border-gray-600 px-7 py-3.5 font-semibold hover:border-white">เริ่มขายสินค้า</a>
            </div>
          </div>
          <div className="mt-16 grid max-w-3xl grid-cols-3 gap-4 border-t border-gray-800 pt-8 text-center sm:text-left">
            <div><p className="text-2xl font-bold">1,200+</p><p className="text-sm text-gray-500">สินค้าที่ลงขาย</p></div>
            <div><p className="text-2xl font-bold">850+</p><p className="text-sm text-gray-500">ผู้ใช้งาน</p></div>
            <div><p className="text-2xl font-bold">4.9/5</p><p className="text-sm text-gray-500">ความพึงพอใจ</p></div>
          </div>
        </div>
      </section>

      <section className="border-b bg-white px-[6%] py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row">
          <div className="relative flex-1"><span className="absolute left-4 top-3.5 text-gray-400">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสินค้า ชื่อร้าน หรือหมวดหมู่..." className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 outline-none focus:border-[#D4AF37]" /></div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-5 py-3 outline-none focus:border-[#D4AF37]"><option>ทั้งหมด</option>{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select>
          <a href="/products" className="rounded-lg bg-black px-6 py-3 text-center font-semibold text-white hover:bg-gray-800">ค้นหาสินค้าทั้งหมด</a>
        </div>
      </section>

      <section className="bg-gray-50 px-[6%] py-20">
        <div className="mx-auto max-w-7xl"><div className="mb-10"><p className="mb-3 text-sm font-bold tracking-[3px] text-[#D4AF37]">EXPLORE</p><h2 className="text-4xl font-black">เลือกดูตามหมวดหมู่</h2></div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{categories.map((item) => <button key={item.name} onClick={() => { setCategory(item.name); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }} className="rounded-xl border border-gray-200 bg-white p-7 text-left transition hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-lg"><div className="mb-5 text-4xl">{item.emoji}</div><h3 className="mb-2 text-xl font-bold">{item.name}</h3><p className="text-sm leading-6 text-gray-500">{item.desc}</p></button>)}</div>
        </div>
      </section>

      <section id="products" className="px-[6%] py-20">
        <div className="mx-auto max-w-7xl"><div className="mb-10 flex items-end justify-between gap-4"><div><p className="mb-3 text-sm font-bold tracking-[3px] text-[#D4AF37]">TRENDING</p><h2 className="text-4xl font-black">สินค้าน่าสนใจ</h2></div><a href="/products" className="font-semibold hover:text-[#D4AF37]">ดูทั้งหมด →</a></div>
          {filteredProducts.length === 0 ? <div className="rounded-xl border border-dashed p-12 text-center text-gray-500">ไม่พบสินค้าที่ค้นหา ลองเปลี่ยนคำค้นหรือหมวดหมู่</div> : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{filteredProducts.map((product) => <article key={product.id} className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-xl"><div className="relative flex h-60 items-center justify-center bg-gray-100 text-7xl"><span>{product.emoji}</span><button aria-label="favorite" onClick={() => toggleFavorite(product.id)} className="absolute right-4 top-4 rounded-full bg-white p-2 shadow hover:scale-105">{favorites.includes(product.id) ? "♥" : "♡"}</button></div><div className="p-6"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-[#B08D18]">{product.category}</span><span className="text-xs text-gray-400">{product.condition}</span></div><h3 className="text-xl font-bold">{product.name}</h3><p className="mt-2 text-sm text-gray-500">ขายโดย {product.seller}</p><div className="mt-5 flex items-center justify-between"><span className="text-2xl font-black">{money(product.price)}</span><button onClick={() => addToCart(product.id)} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">{cart.includes(product.id) ? "เพิ่มแล้ว ✓" : "สนใจสินค้า"}</button></div></div></article>)}</div>}
        </div>
      </section>

      <section id="how" className="bg-gray-50 px-[6%] py-20"><div className="mx-auto max-w-7xl"><div className="mb-12 text-center"><p className="mb-3 text-sm font-bold tracking-[3px] text-[#D4AF37]">HOW IT WORKS</p><h2 className="text-4xl font-black">ซื้อขายใน 3 ขั้นตอน</h2></div><div className="grid gap-6 md:grid-cols-3">{[["01","ค้นหาสินค้า","ค้นหาสินค้าที่ต้องการและเปรียบเทียบราคา"],["02","พูดคุยกับผู้ขาย","สอบถามรายละเอียด นัดรับ หรือเลือกวิธีจัดส่ง"],["03","ซื้อขายอย่างมั่นใจ","ตรวจสอบข้อมูลและตกลงการซื้อขายกับคู่ค้า"]].map(([n,t,d]) => <div key={n} className="rounded-xl border bg-white p-8"><span className="text-4xl font-black text-[#D4AF37]">{n}</span><h3 className="mt-5 text-xl font-bold">{t}</h3><p className="mt-2 leading-7 text-gray-500">{d}</p></div>)}</div></div></section>

      <section id="about" className="bg-black px-[6%] py-24 text-white"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-12 md:flex-row md:items-center"><div className="max-w-2xl"><p className="mb-4 text-sm font-bold tracking-[3px] text-[#D4AF37]">SELL WITH US</p><h2 className="text-4xl font-black md:text-6xl">มีของที่ไม่ได้ใช้?<br /><span className="text-[#D4AF37]">เปลี่ยนมันเป็นเงิน</span></h2><p className="mt-6 leading-7 text-gray-400">สร้างประกาศสินค้า กำหนดราคา และติดต่อกับผู้ซื้อได้จากที่เดียว</p></div><a href="/sell" className="w-fit rounded-md bg-[#D4AF37] px-7 py-3.5 font-bold text-black hover:bg-[#e5c04a]">ลงขายสินค้า →</a></div></section>

      <footer className="bg-black px-[6%] py-10 text-gray-500"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 border-t border-gray-800 pt-8 md:flex-row"><div><div className="text-2xl font-black text-white">P2P<span className="text-[#D4AF37]">.</span></div><p className="mt-2 text-sm">Peer to Peer Marketplace</p></div><div className="flex gap-5 text-sm"><a href="/login" className="hover:text-white">บัญชีของฉัน</a><a href="/sell" className="hover:text-white">ลงขายสินค้า</a><span>ตะกร้า {cart.length}</span><span>ถูกใจ {favorites.length}</span></div></div></footer>
    </main>
  );
}
