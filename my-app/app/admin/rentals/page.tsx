import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/authorization";
import { listRentalsForAdmin } from "@/lib/rental/fulfillment";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminRentals() {
  await requireAdminPage("/admin/rentals");
  const rentals = await listRentalsForAdmin();
  const active = rentals.filter((rental) => !["REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"].includes(rental.status)).length;
  const returned = rentals.filter((rental) => rental.status === "RETURNED").length;
  const completed = rentals.filter((rental) => rental.status === "COMPLETED").length;
  return <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><Link href="/admin" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link><div className="flex gap-2"><Link href="/admin/settlements" className="rounded-xl border px-4 py-2 text-sm font-bold">Settlements</Link><Link href="/admin" className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white">Admin</Link></div></div></header>
    <div className="mx-auto max-w-7xl px-6 py-10"><p className="text-xs font-black tracking-[0.25em] text-[#9d7d13]">ADMIN / RENTALS</p><h1 className="mt-2 text-4xl font-black">Rental operations</h1><p className="mt-2 text-neutral-500">อ่าน lifecycle, คู่สัญญา และยอดจาก PostgreSQL จริง ไม่มีปุ่มข้ามสถานะโดยตรง</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">กำลังดำเนินการ</p><b className="mt-2 block text-3xl">{active}</b></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">RETURNED รอการเงิน</p><b className="mt-2 block text-3xl">{returned}</b></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">COMPLETED</p><b className="mt-2 block text-3xl">{completed}</b></div></div>
      <section className="mt-6 overflow-hidden rounded-3xl border bg-white"><div className="hidden grid-cols-[100px_1.2fr_1fr_130px_150px] gap-4 border-b bg-neutral-50 px-6 py-4 text-xs font-black uppercase text-neutral-500 md:grid"><span>ID</span><span>สินค้า / เวลา</span><span>คู่สัญญา</span><span>ยอด</span><span>สถานะ</span></div>{rentals.map((rental) => <Link href={`/rental/${rental.id}`} key={rental.id} className="grid gap-3 border-b p-6 last:border-0 hover:bg-neutral-50 md:grid-cols-[100px_1.2fr_1fr_130px_150px] md:items-center md:gap-4"><code className="text-xs font-bold">{rental.id.slice(0, 8)}</code><div><b>{rental.itemTitle}</b><p className="mt-1 text-xs text-neutral-500">{dateTime.format(new Date(rental.startsAt))} → {dateTime.format(new Date(rental.endsAt))}</p></div><div className="text-sm"><p>ยืม: {rental.borrowerName}</p><p className="text-neutral-500">ให้ยืม: {rental.lenderName}</p></div><div className="text-sm"><b>฿{money.format(Number(rental.rentalAmount))}</b><p className="text-xs text-neutral-500">ประกัน ฿{money.format(Number(rental.depositAmount))}</p></div><span className="w-fit rounded-full bg-neutral-100 px-3 py-1 text-xs font-black">{rental.status}</span></Link>)}{rentals.length === 0 && <div className="p-12 text-center text-neutral-500">ยังไม่มี Rental</div>}</section>
    </div>
  </main>;
}
