export default function AdminPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12 text-black">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><p className="text-sm font-bold tracking-[3px] text-[#B08D18]">ADMIN CONSOLE</p><h1 className="mt-2 text-4xl font-black">Rental-P2P Admin</h1><p className="mt-2 text-gray-500">จัดการผู้ใช้ การยืนยันตัวตน รายการให้ยืม และข้อพิพาท</p></div>
          <a href="/" className="font-semibold hover:text-[#B08D18]">← กลับหน้าหลัก</a>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[['👤','ผู้ใช้','จัดการบัญชีผู้ใช้งาน'],['🪪','Verification','ตรวจสอบสถานะยืนยันตัวตน'],['📦','รายการให้ยืม','ตรวจสอบรายการและรายงาน'],['⚠️','Dispute','จัดการข้อพิพาท']].map(([icon,title,desc]) => <div key={title} className="rounded-2xl border bg-white p-6 shadow-sm"><div className="text-3xl">{icon}</div><h2 className="mt-5 text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-gray-500">{desc}</p></div>)}
        </div>
        <div className="mt-8 rounded-2xl border bg-white p-7"><h2 className="text-xl font-bold">ระบบ Admin</h2><p className="mt-2 text-gray-500">หน้านี้เป็น foundation ของ Admin Dashboard ระบบจริงจะตรวจสิทธิ์จาก session ฝั่ง server และเชื่อม PostgreSQL ในขั้นถัดไป</p></div>
      </div>
    </main>
  );
}
