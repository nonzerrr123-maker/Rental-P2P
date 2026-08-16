import Link from "next/link";
import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import { listRentalListingsForOwner } from "@/lib/rental/listings";
import LocationEditor from "./location-editor";

export default async function LendLocationPage() {
  const user = await requireVerifiedUserPage("/lend/location");
  const items = await listRentalListingsForOwner(user.id);

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-5">
          <Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link>
          <div className="flex gap-2">
            <Link href="/lend" className="rounded-xl border px-4 py-2 text-sm font-bold">ลงของให้ยืม</Link>
            <Link href="/rent" className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white">Marketplace</Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-black tracking-[0.25em] text-[#9d7d13]">LISTING LOCATION</p>
        <h1 className="mt-2 text-4xl font-black">จัดการพื้นที่ของประกาศ</h1>
        <p className="mt-3 max-w-3xl text-neutral-500">กำหนดจังหวัด/อำเภอ/ตำบลและพิกัดโดยประมาณเพื่อให้ค้นหา Nearby ได้ พิกัดจริงของผู้ลงของจะไม่ถูกส่งออกใน Public Marketplace API</p>
        <div className="mt-8">
          <LocationEditor
            items={items.map((item) => ({
              id: item.id,
              title: item.title,
              province: item.province,
              district: item.district,
              subdistrict: item.subdistrict,
              locationLabel: item.locationLabel,
              latitude: item.latitude,
              longitude: item.longitude,
            }))}
          />
        </div>
      </div>
    </main>
  );
}
