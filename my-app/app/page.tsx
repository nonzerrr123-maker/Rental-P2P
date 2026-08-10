export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black">
      {/* ================= NAVBAR ================= */}
      <nav className="flex h-20 items-center justify-between bg-black px-[8%] text-white">
        {/* Logo */}
        <div className="text-3xl font-bold tracking-tight">
          P2P<span className="text-[#D4AF37]">.</span>
        </div>

        {/* Menu */}
        <div className="hidden items-center gap-8 text-sm md:flex">
          <a href="#" className="transition hover:text-[#D4AF37]">
            หน้าหลัก
          </a>

          <a href="#" className="transition hover:text-[#D4AF37]">
            สินค้าทั้งหมด
          </a>

          <a href="#" className="transition hover:text-[#D4AF37]">
            วิธีใช้งาน
          </a>

          <a href="#" className="transition hover:text-[#D4AF37]">
            เกี่ยวกับเรา
          </a>
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          <button className="hidden rounded-md border border-gray-600 px-4 py-2 text-sm transition hover:border-[#D4AF37] md:block">
            เข้าสู่ระบบ
          </button>

          <button className="rounded-md bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e5c04a]">
            สมัครสมาชิก
          </button>
        </div>
      </nav>

      {/* ================= HERO ================= */}
      <section className="flex min-h-[620px] items-center px-[8%] py-20">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-bold tracking-[4px] text-[#D4AF37]">
            PEER TO PEER MARKETPLACE
          </p>

          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            ซื้อขายง่าย
            <br />
            <span className="text-[#D4AF37]">ระหว่างคนกับคน</span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-gray-500">
            พื้นที่สำหรับซื้อ ขาย และแลกเปลี่ยนสินค้า โดยตรงระหว่างผู้ใช้งาน
            <br />
            ง่าย ปลอดภัย และเป็นธรรม
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <button className="rounded-md bg-black px-7 py-3.5 font-semibold text-white transition hover:bg-gray-800">
              เริ่มซื้อขาย
            </button>

            <button className="rounded-md border border-gray-300 px-7 py-3.5 font-semibold transition hover:border-black">
              ดูสินค้าทั้งหมด
            </button>
          </div>
        </div>
      </section>

      {/* ================= CATEGORY ================= */}
      <section className="bg-gray-50 px-[8%] py-24">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="mb-3 text-sm font-bold tracking-[3px] text-[#D4AF37]">
              EXPLORE
            </p>

            <h2 className="text-4xl font-bold">หมวดหมู่สินค้า</h2>
          </div>

          <a
            href="#"
            className="hidden font-semibold transition hover:text-[#D4AF37] md:block"
          >
            ดูทั้งหมด →
          </a>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Category 1 */}
          <div className="group rounded-xl border border-gray-200 bg-white p-7 transition hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-lg">
            <div className="mb-6 text-4xl">📱</div>

            <h3 className="mb-2 text-xl font-bold">อิเล็กทรอนิกส์</h3>

            <p className="text-sm leading-6 text-gray-500">
              โทรศัพท์ คอมพิวเตอร์ และอุปกรณ์ไอที
            </p>
          </div>

          {/* Category 2 */}
          <div className="group rounded-xl border border-gray-200 bg-white p-7 transition hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-lg">
            <div className="mb-6 text-4xl">👕</div>

            <h3 className="mb-2 text-xl font-bold">แฟชั่น</h3>

            <p className="text-sm leading-6 text-gray-500">
              เสื้อผ้า รองเท้า และเครื่องประดับ
            </p>
          </div>

          {/* Category 3 */}
          <div className="group rounded-xl border border-gray-200 bg-white p-7 transition hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-lg">
            <div className="mb-6 text-4xl">🏠</div>

            <h3 className="mb-2 text-xl font-bold">บ้านและของใช้</h3>

            <p className="text-sm leading-6 text-gray-500">
              เฟอร์นิเจอร์ ของตกแต่ง และของใช้
            </p>
          </div>

          {/* Category 4 */}
          <div className="group rounded-xl border border-gray-200 bg-white p-7 transition hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-lg">
            <div className="mb-6 text-4xl">🎮</div>

            <h3 className="mb-2 text-xl font-bold">เกมและงานอดิเรก</h3>

            <p className="text-sm leading-6 text-gray-500">
              เกม ของสะสม และอุปกรณ์ต่าง ๆ
            </p>
          </div>
        </div>
      </section>

      {/* ================= PRODUCTS ================= */}
      <section className="px-[8%] py-24">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="mb-3 text-sm font-bold tracking-[3px] text-[#D4AF37]">
              TRENDING
            </p>

            <h2 className="text-4xl font-bold">สินค้าน่าสนใจ</h2>
          </div>

          <a
            href="#"
            className="hidden font-semibold transition hover:text-[#D4AF37] md:block"
          >
            ดูทั้งหมด →
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Product 1 */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-64 items-center justify-center bg-gray-100 text-sm text-gray-400">
              PRODUCT IMAGE
            </div>

            <div className="p-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                Electronics
              </p>

              <h3 className="mb-5 text-xl font-bold">MacBook Pro M2</h3>

              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">฿32,900</span>

                <button className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800">
                  ดูสินค้า
                </button>
              </div>
            </div>
          </div>

          {/* Product 2 */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-64 items-center justify-center bg-gray-100 text-sm text-gray-400">
              PRODUCT IMAGE
            </div>

            <div className="p-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                Fashion
              </p>

              <h3 className="mb-5 text-xl font-bold">Vintage Jacket</h3>

              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">฿1,590</span>

                <button className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800">
                  ดูสินค้า
                </button>
              </div>
            </div>
          </div>

          {/* Product 3 */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-64 items-center justify-center bg-gray-100 text-sm text-gray-400">
              PRODUCT IMAGE
            </div>

            <div className="p-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                Gaming
              </p>

              <h3 className="mb-5 text-xl font-bold">PlayStation 5</h3>

              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">฿15,900</span>

                <button className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800">
                  ดูสินค้า
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SELL CTA ================= */}
      <section className="bg-black px-[8%] py-28 text-white">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-bold tracking-[3px] text-[#D4AF37]">
            SELL WITH US
          </p>

          <h2 className="text-4xl font-bold leading-tight md:text-6xl">
            มีของที่ไม่ได้ใช้?
            <br />
            <span className="text-[#D4AF37]">เปลี่ยนมันเป็นเงิน</span>
          </h2>

          <p className="mt-6 max-w-xl leading-7 text-gray-400">
            ลงประกาศสินค้าได้ง่าย ๆ และเริ่มขายให้กับผู้ซื้อบนแพลตฟอร์มของเรา
          </p>

          <button className="mt-8 rounded-md bg-[#D4AF37] px-7 py-3.5 font-bold text-black transition hover:bg-[#e5c04a]">
            ลงขายสินค้า
          </button>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-black px-[8%] py-12 text-gray-500">
        <div className="flex flex-col justify-between gap-5 border-t border-gray-800 pt-8 md:flex-row">
          <div>
            <div className="text-2xl font-bold text-white">
              P2P<span className="text-[#D4AF37]">.</span>
            </div>

            <p className="mt-2 text-sm">Peer to Peer Marketplace</p>
          </div>

          <p className="text-sm">© 2026 P2P Marketplace</p>
        </div>
      </footer>
    </main>
  );
}
