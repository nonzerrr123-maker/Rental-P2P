import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/authorization";
import { listPaymentsForAdmin } from "@/lib/payments/service";

const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function AdminPayments() {
  await requireAdminPage("/admin/payments");
  const payments = await listPaymentsForAdmin();
  const succeeded = payments.filter((payment) => payment.status === "SUCCEEDED").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const pending = payments.filter((payment) => ["PENDING", "REQUIRES_ACTION"].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const refunded = payments.filter((payment) => payment.type === "REFUND" && payment.status === "SUCCEEDED").reduce((sum, payment) => sum + Number(payment.amount), 0);

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-900">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5"><Link href="/admin" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link><div className="flex gap-2"><Link href="/admin/settlements" className="rounded-full border border-[#d8c16d] bg-[#fffaf0] px-4 py-2 text-sm font-bold text-[#806515]">Settlements</Link><Link href="/admin" className="rounded-full border px-4 py-2 text-sm font-bold">Admin</Link></div></div></header>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <span className="text-xs font-black tracking-[3px] text-[#a58316]">ADMIN / PAYMENTS</span><h1 className="mt-2 text-4xl font-black">การชำระเงินจริงจาก PostgreSQL</h1><p className="mt-2 text-neutral-500">อ่านสถานะ payment/deposit ที่ระบบสร้างจริง โดยหน้าเว็บไม่สามารถบังคับเปลี่ยนรายการเป็น PAID ได้ และ Omise PromptPay ที่คืนผ่าน API ไม่ได้จะถูกส่งไป manual refund boundary แทน</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">สำเร็จ</p><b className="mt-2 block text-3xl">฿{money.format(succeeded)}</b></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">รอดำเนินการ</p><b className="mt-2 block text-3xl">฿{money.format(pending)}</b></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">คืนเงินแล้ว</p><b className="mt-2 block text-3xl">฿{money.format(refunded)}</b></div></div>
        <section className="mt-6 overflow-hidden rounded-3xl border bg-white"><div className="grid grid-cols-2 gap-4 border-b bg-neutral-50 px-6 py-4 text-xs font-black uppercase text-neutral-500 md:grid-cols-6"><span>ID</span><span>Rental</span><span>Type</span><span>Provider</span><span>Amount</span><span>Status</span></div>{payments.map((payment) => <div key={payment.id} className="grid gap-3 border-b p-6 last:border-0 md:grid-cols-6 md:items-center"><code className="text-xs">{payment.id.slice(0, 8)}</code><code className="text-xs">{payment.rentalRequestId.slice(0, 8)}</code><b className="text-sm">{payment.type}</b><span className="text-sm">{payment.provider}</span><b>฿{money.format(Number(payment.amount))}</b><span className="rounded-full bg-neutral-100 px-3 py-1 text-center text-xs font-bold">{payment.status}</span></div>)}{payments.length === 0 && <div className="p-12 text-center text-neutral-500">ยังไม่มีรายการชำระเงิน</div>}</section>
      </div>
    </main>
  );
}
