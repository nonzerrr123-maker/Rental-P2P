import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/authorization";
import { listPlatformSettlements } from "@/lib/payments/settlements";

const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function AdminSettlementsPage() {
  await requireAdminPage("/admin/settlements");
  const settlements = await listPlatformSettlements();
  const held = settlements.filter((entry) => entry.status === "PLATFORM_HELD").reduce((sum, entry) => sum + Number(entry.amount), 0);

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><Link href="/admin" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link><div className="flex gap-2"><Link href="/admin/payments" className="rounded-xl border px-4 py-2 text-sm font-black">Payments</Link><Link href="/admin" className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-black text-white">Admin</Link></div></div></header>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-black tracking-[0.24em] text-[#9d7d13]">PLATFORM SETTLEMENTS</p>
        <h1 className="mt-2 text-4xl font-black">ยอดที่แพลตฟอร์มถือไว้ก่อน payout</h1>
        <p className="mt-3 max-w-3xl text-neutral-500">เฉพาะค่าเช่าแบบปกติที่ Omise ยืนยันแล้ว เงินประกันยังแยกเป็น HELD collateral และรายการยืมด่วนยังคงเก็บเฉพาะค่าจองด่วน + เงินประกันตามนโยบาย MVP</p>
        <div className="mt-7 rounded-3xl border bg-white p-6"><p className="text-sm text-neutral-500">ยอดรอ settlement</p><p className="mt-2 text-4xl font-black">฿{money.format(held)}</p><p className="mt-2 text-xs text-neutral-400">สถานะ PLATFORM_HELD ไม่ได้หมายความว่าโอนเข้าธนาคารผู้ให้ยืมแล้ว</p></div>
        <section className="mt-6 overflow-hidden rounded-3xl border bg-white">
          {settlements.map((entry) => (
            <article key={entry.paymentId} className="grid gap-4 border-b p-6 last:border-0 md:grid-cols-[1.2fr_1fr_1fr_1.2fr] md:items-center">
              <div><p className="font-black">{entry.lender.displayName}</p><p className="text-xs text-neutral-400">{entry.lender.email}</p><code className="mt-1 block text-[11px] text-neutral-400">Rental {entry.rentalRequestId.slice(0, 8)}</code></div>
              <div><p className="text-xs text-neutral-500">Payout amount</p><p className="font-black">฿{money.format(Number(entry.amount))}</p></div>
              <div><p className="text-xs text-neutral-500">Balance state</p><span className="mt-1 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">{entry.status}</span></div>
              <div><p className="text-xs text-neutral-500">Bank payout</p><p className="font-black">{entry.livePayoutsEnabled && entry.recipientProviderReference ? "Provider-ready" : entry.payoutMode}</p><p className="mt-1 text-xs leading-5 text-neutral-400">{entry.reason ?? "รอ recipient / transfer confirmation"}</p></div>
            </article>
          ))}
          {settlements.length === 0 && <div className="p-12 text-center text-neutral-500">ยังไม่มียอด Omise ที่รอ settlement</div>}
        </section>
      </div>
    </main>
  );
}
