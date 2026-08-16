import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getCommunityRequest, listCommunityOffersForViewer } from "@/lib/community/service";
import CommunityActions from "./community-actions";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const statusLabels: Record<string, string> = { OPEN: "เปิดรับข้อเสนอ", MATCHED: "จับคู่แล้ว", CLOSED: "ปิดแล้ว", CANCELLED: "ยกเลิก", EXPIRED: "หมดอายุ" };

export default async function CommunityRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getCommunityRequest(id);
  if (!item) notFound();
  const user = await getCurrentUser();
  const canAct = Boolean(user && (user.verificationStatus === "VERIFIED" || user.role === "ADMIN" || user.role === "SUPERADMIN"));
  const isRequester = Boolean(user && user.id === item.requesterId);
  const offers = canAct && user ? await listCommunityOffersForViewer(user.id, item.id) : [];
  const location = [item.subdistrict, item.district, item.province].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 md:px-6">
          <Link href="/community" className="text-sm font-bold text-neutral-500 hover:text-neutral-950">← กลับคอมมูหาของ</Link>
          <Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 md:px-6 md:py-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-6">
          <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              {item.isUrgent && <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-black text-white">⚡ ต้องการด่วน</span>}
              <span className="rounded-full bg-[#faf5df] px-3 py-1 text-xs font-black text-[#84680c]">{item.category}</span>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{statusLabels[item.status] ?? item.status}</span>
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight md:text-4xl">{item.title}</h1>
            {item.description && <p className="mt-5 whitespace-pre-wrap leading-7 text-neutral-600">{item.description}</p>}

            <div className="mt-6 grid gap-3 rounded-2xl bg-neutral-50 p-5 sm:grid-cols-2">
              <div><p className="text-xs font-bold text-neutral-500">เริ่มต้องการ</p><p className="mt-1 font-black">{dateTime.format(new Date(item.neededStartsAt))}</p></div>
              <div><p className="text-xs font-bold text-neutral-500">คืน / สิ้นสุด</p><p className="mt-1 font-black">{dateTime.format(new Date(item.neededEndsAt))}</p></div>
              <div><p className="text-xs font-bold text-neutral-500">พื้นที่โดยประมาณ</p><p className="mt-1 font-black">📍 {location}</p></div>
              <div><p className="text-xs font-bold text-neutral-500">งบเป้าหมาย</p><p className="mt-1 font-black">{item.targetPrice ? `฿${money.format(Number(item.targetPrice))}` : "เปิดรับข้อเสนอ"}</p></div>
            </div>
            <p className="mt-4 text-xs text-neutral-400">ตำแหน่งสาธารณะแสดงเพียงพื้นที่โดยประมาณ พิกัดจริงของผู้ขอไม่ถูกส่งออกจาก API</p>
          </article>

          <CommunityActions
            requestId={item.id}
            requestTitle={item.title}
            requestStatus={item.status}
            isRequester={isRequester}
            canAct={canAct}
            currentUserId={user?.id ?? null}
            initialOffers={offers}
          />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black tracking-[0.2em] text-[#9d7d13]">REQUESTER</p>
            <h2 className="mt-2 text-xl font-black">{item.requester.displayName}</h2>
            <p className="mt-2 text-sm text-neutral-500">{item.requester.verified ? "✓ ยืนยันตัวตนแล้ว" : "ยังไม่ยืนยันตัวตน"}{item.requester.ratingCount > 0 ? ` · ⭐ ${Number(item.requester.ratingAverage).toFixed(1)} (${item.requester.ratingCount})` : ""}</p>
            <div className="mt-5 border-t pt-4 text-sm"><span className="text-neutral-500">ข้อเสนอที่รอพิจารณา</span><b className="float-right">{item.offerCount}</b></div>
          </section>
          <section className="rounded-3xl border border-[#c9a227]/30 bg-[#fffaf0] p-5 text-sm leading-6">
            <b>🔒 Match แล้วไป Rental จริง</b>
            <p className="mt-2 text-neutral-600">เมื่อผู้ขอ Accept ข้อเสนอ ระบบจะ recheck ของ/ช่วงเวลาอีกครั้ง แล้วสร้าง Rental สถานะ WAITING_PAYMENT พร้อมแชตและการแจ้งเตือนทันที</p>
          </section>
          {!isRequester && <Link href="/lend" className="block rounded-2xl border bg-white p-4 text-center text-sm font-bold">ยังไม่มีของลงประกาศ? ไปลงของให้ยืม →</Link>}
        </aside>
      </div>
    </main>
  );
}
