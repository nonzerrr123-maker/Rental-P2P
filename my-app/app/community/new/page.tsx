import Link from "next/link";
import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import CommunityRequestForm from "./community-request-form";

export default async function NewCommunityRequestPage() {
  await requireVerifiedUserPage("/community/new");
  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 md:px-6">
          <Link href="/community" className="text-sm font-bold text-neutral-500 hover:text-neutral-950">← กลับคอมมูหาของ</Link>
          <Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-5 py-10 md:px-6 md:py-14">
        <p className="text-xs font-black tracking-[0.28em] text-[#9d7d13]">POST A REQUEST</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">หาไม่เจอ? บอกคอมมูว่าต้องการอะไร</h1>
        <p className="mt-4 leading-7 text-neutral-500">เมื่อมีคนเสนอของและคุณตอบรับ ระบบจะสร้าง Rental จริงในสถานะรอชำระเงินให้อัตโนมัติ</p>
        <CommunityRequestForm />
      </section>
    </main>
  );
}
