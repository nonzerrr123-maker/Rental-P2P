import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { MapPinIcon } from "@/components/ui/icons";
import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import { listRentalListingsForOwner } from "@/lib/rental/listings";
import LocationEditor from "./location-editor";

export default async function LendLocationPage() {
  const user = await requireVerifiedUserPage("/lend/location");
  const items = await listRentalListingsForOwner(user.id);
  const missingCoordinates = items.filter((item) => !item.latitude || !item.longitude).length;

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <p className="bb-label">Listing location</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">จัดการตำแหน่งของประกาศ</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">จังหวัดช่วยให้ค้นหาพื้นที่ได้ ส่วนพิกัด GPS ทำให้ประกาศถูกพบในการค้นหา Nearby 5–50 กม. พิกัดจริงไม่ถูกส่งออกใน Public Marketplace API</p>

        {missingCoordinates > 0 && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <MapPinIcon size={18} className="mt-1 shrink-0" />
            <div><p className="font-black">มี {missingCoordinates} ประกาศที่ยังไม่มีพิกัด Nearby</p><p className="mt-1 text-xs">ระบบเรียงประกาศที่ยังขาดพิกัดไว้บนสุด กดใช้ตำแหน่งปัจจุบันแล้วบันทึกทีละรายการเพื่อให้ค้นหาด้วยระยะทางเจอ</p></div>
          </div>
        )}

        <div className="mt-7"><LocationEditor items={items.map((item) => ({ id: item.id, title: item.title, province: item.province, district: item.district, subdistrict: item.subdistrict, locationLabel: item.locationLabel, latitude: item.latitude, longitude: item.longitude }))} /></div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/lend" className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-bold">กลับไปลงของ</Link>
          <Link href="/rent" className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-black text-white">เปิด Marketplace</Link>
        </div>
      </div>
    </main>
  );
}
