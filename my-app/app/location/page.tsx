import Image from "next/image";
import Link from "next/link";
import {
  listMarketplaceFacets,
  MarketplaceValidationError,
  parseMarketplaceFilters,
  searchPublicRentalItems,
  type MarketplaceFilters,
} from "@/lib/rental/marketplace";
import NearbyControls from "./nearby-controls";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toUrlSearchParams(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else if (value !== undefined) params.set(key, value);
  }
  if (!params.has("limit")) params.set("limit", "12");
  return params;
}

function locationText(item: { province: string; district: string | null; subdistrict: string | null }) {
  return [item.subdistrict, item.district, item.province].filter(Boolean).join(" · ");
}

function controlsInitial(filters: MarketplaceFilters) {
  return {
    province: filters.province,
    district: filters.district,
    subdistrict: filters.subdistrict,
    urgent: filters.urgent,
    latitude: filters.latitude,
    longitude: filters.longitude,
    radiusKm: filters.radiusKm,
  };
}

export default async function LocationPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams;
  const params = toUrlSearchParams(resolved);
  let filters: MarketplaceFilters;
  let validationMessage = "";

  try {
    filters = parseMarketplaceFilters(params);
  } catch (error) {
    if (!(error instanceof MarketplaceValidationError)) throw error;
    validationMessage = Object.values(error.fieldErrors)[0] ?? "ตัวกรองพื้นที่ไม่ถูกต้อง";
    filters = parseMarketplaceFilters(new URLSearchParams("limit=12"));
  }

  const [result, facets] = await Promise.all([
    searchPublicRentalItems(filters),
    listMarketplaceFacets(),
  ]);

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link>
          <div className="flex gap-2">
            <Link href="/lend/location" className="rounded-xl border px-4 py-2 text-sm font-bold">จัดการตำแหน่งของฉัน</Link>
            <Link href="/rent" className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white">Marketplace</Link>
          </div>
        </div>
      </header>

      <section className="border-b bg-white px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black tracking-[0.28em] text-[#9d7d13]">REAL NEARBY RENTALS</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">ค้นหาของใกล้คุณจากรายการจริง</h1>
          <p className="mt-4 max-w-3xl text-neutral-500">ใช้ตำแหน่งอุปกรณ์เพื่อค้นหา 5–50 กม. หรือเลือกจังหวัด/อำเภอ/ตำบลแทนได้ ระบบคำนวณระยะทางฝั่ง server และไม่เปิดพิกัดจริงของเจ้าของต่อสาธารณะ</p>
          <div className="mt-8"><NearbyControls initial={controlsInitial(filters)} provinces={facets.provinces} /></div>
          {validationMessage && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{validationMessage} — แสดงผลเริ่มต้นแทน</p>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">ผลการค้นหา Nearby</h2>
            <p className="mt-1 text-sm text-neutral-500">พบ {money.format(result.total)} รายการจาก PostgreSQL</p>
          </div>
          {filters.radiusKm !== null && <span className="rounded-full bg-[#faf5df] px-4 py-2 text-sm font-black text-[#806515]">📍 {filters.radiusKm} กม. · ใกล้สุดก่อน</span>}
        </div>

        {result.items.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <Link href={`/rent/${item.id}`} className="block">
                  <div className="relative aspect-[4/3] bg-neutral-100">
                    {item.coverImageUrl ? <Image src={item.coverImageUrl} alt={item.title} fill unoptimized sizes="(max-width:640px) 100vw, 25vw" className="object-cover" /> : <div className="grid h-full place-items-center text-5xl text-neutral-300">📦</div>}
                    {item.urgentAvailableNow && <span className="absolute left-3 top-3 rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-black text-white">⚡ ยืมด่วน · ว่างตอนนี้</span>}
                    {item.distanceKm !== null && <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black shadow">{item.distanceKm.toFixed(1)} กม.</span>}
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-black text-[#9d7d13]">{item.category}</p>
                    <h3 className="mt-2 line-clamp-2 text-lg font-black">{item.title}</h3>
                    <p className="mt-2 truncate text-xs text-neutral-500">📍 {locationText(item)}</p>
                    <p className="mt-2 text-sm text-neutral-600">{item.owner.displayName} {item.owner.verified && "✓"}</p>
                    <div className="mt-4 flex flex-wrap gap-3 border-t pt-4 text-sm">
                      {item.hourlyRate && <p><b>฿{money.format(Number(item.hourlyRate))}</b> <span className="text-xs text-neutral-500">/ชม.</span></p>}
                      {item.dailyRate && <p><b>฿{money.format(Number(item.dailyRate))}</b> <span className="text-xs text-neutral-500">/วัน</span></p>}
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed bg-white p-12 text-center">
            <div className="text-5xl">📍</div>
            <h3 className="mt-4 text-xl font-black">ยังไม่พบของในพื้นที่นี้</h3>
            <p className="mt-2 text-sm text-neutral-500">ลองเพิ่มระยะทางหรือเลือกพื้นที่อื่น ไม่มีข้อมูล mock ถูกนำมาแสดงแทน</p>
          </div>
        )}
      </section>
    </main>
  );
}
