import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { QueryResultRow } from "pg";
import SiteHeader from "@/components/site-header";
import UserAvatar from "@/components/user-avatar";
import { CalendarIcon, MapPinIcon, PackageIcon, ShieldCheckIcon, StarIcon } from "@/components/ui/icons";
import { SectionEyebrow, StatusPill } from "@/components/ui/primitives";
import { query } from "@/lib/db";

type PublicProfileRow = QueryResultRow & {
  id: string;
  display_name: string;
  bio: string | null;
  verification_status: string;
  rating_average: string;
  rating_count: number;
  created_at: Date;
  avatar_updated_at: Date | null;
  active_listings: string;
  completed_rentals: string;
};

type ListingRow = QueryResultRow & {
  id: string;
  title: string;
  category: string;
  province: string;
  hourly_rate: string | null;
  daily_rate: string | null;
  cover_image_id: string | null;
};

type ReviewRow = QueryResultRow & {
  id: string;
  rating: number;
  comment: string | null;
  created_at: Date;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar_updated_at: Date | null;
};

const date = new Intl.DateTimeFormat("th-TH", { dateStyle: "long" });
const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PublicUserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const [profileResult, listingsResult, reviewsResult] = await Promise.all([
    query<PublicProfileRow>(
      `SELECT u.id,u.display_name,u.bio,u.verification_status::text,u.rating_average,u.rating_count,u.created_at,u.avatar_updated_at,
        (SELECT count(*)::text FROM rental_items ri WHERE ri.owner_id=u.id AND ri.status='ACTIVE') AS active_listings,
        (SELECT count(*)::text FROM rental_requests rr WHERE (rr.borrower_id=u.id OR rr.lender_id=u.id) AND rr.status='COMPLETED') AS completed_rentals
       FROM users u
       WHERE u.id=$1 AND u.is_active=true
       LIMIT 1`,
      [id],
    ),
    query<ListingRow>(
      `SELECT ri.id,ri.title,ri.category,ri.province,ri.hourly_rate,ri.daily_rate,cover.id AS cover_image_id
       FROM rental_items ri
       LEFT JOIN LATERAL (
         SELECT id FROM rental_images WHERE item_id=ri.id ORDER BY sort_order ASC, created_at ASC LIMIT 1
       ) cover ON true
       WHERE ri.owner_id=$1 AND ri.status='ACTIVE'
       ORDER BY ri.created_at DESC
       LIMIT 6`,
      [id],
    ),
    query<ReviewRow>(
      `SELECT r.id,r.rating,r.comment,r.created_at,r.reviewer_id,
              reviewer.display_name AS reviewer_name,
              reviewer.avatar_updated_at AS reviewer_avatar_updated_at
       FROM reviews r
       JOIN users reviewer ON reviewer.id=r.reviewer_id
       WHERE r.reviewee_id=$1
       ORDER BY r.created_at DESC
       LIMIT 6`,
      [id],
    ),
  ]);

  const profile = profileResult.rows[0];
  if (!profile) notFound();

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <SectionEyebrow>Public profile</SectionEyebrow>
        <section className="mt-3 overflow-hidden rounded-[30px] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)]">
          <div className="h-24 bg-[linear-gradient(120deg,var(--gold-soft),white_65%)] sm:h-32" />
          <div className="px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                <UserAvatar userId={profile.id} displayName={profile.display_name} version={profile.avatar_updated_at?.getTime() ?? 0} className="h-20 w-20 rounded-[24px] border-4 border-white text-2xl shadow-sm sm:h-24 sm:w-24" />
                <div className="min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-black tracking-[-0.04em] sm:text-3xl">{profile.display_name}</h1>
                    {profile.verification_status === "VERIFIED" && <StatusPill tone="gold"><span className="inline-flex items-center gap-1"><ShieldCheckIcon size={13}/>ยืนยันตัวตนแล้ว</span></StatusPill>}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]"><CalendarIcon size={14}/>สมาชิกตั้งแต่ {date.format(profile.created_at)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="rounded-2xl bg-[var(--surface-2)] px-4 py-3"><p className="text-[10px] font-bold text-[var(--muted)]">คะแนน</p><p className="mt-1 flex items-center gap-1 text-lg font-black"><StarIcon size={16}/>{Number(profile.rating_average).toFixed(1)}</p></div>
                <div className="rounded-2xl bg-[var(--surface-2)] px-4 py-3"><p className="text-[10px] font-bold text-[var(--muted)]">รีวิว</p><p className="mt-1 text-lg font-black">{profile.rating_count}</p></div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-2xl border border-[var(--line)] p-4 sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">เกี่ยวกับฉัน</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted-strong)]">{profile.bio || "ผู้ใช้นี้ยังไม่ได้เขียนคำแนะนำตัว"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                <div className="rounded-2xl border border-[var(--line)] p-4"><PackageIcon size={18} className="text-[var(--gold-strong)]"/><p className="mt-3 text-2xl font-black">{profile.active_listings}</p><p className="text-xs text-[var(--muted)]">ของที่กำลังปล่อยยืม</p></div>
                <div className="rounded-2xl border border-[var(--line)] p-4"><ShieldCheckIcon size={18} className="text-[var(--gold-strong)]"/><p className="mt-3 text-2xl font-black">{profile.completed_rentals}</p><p className="text-xs text-[var(--muted)]">รายการที่จบสมบูรณ์</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3"><div><p className="bb-label">Listings</p><h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">ของที่กำลังปล่อยยืม</h2></div>{listingsResult.rows.length > 0 && <Link href="/rent" className="text-xs font-black text-[var(--gold-strong)]">ดู Marketplace →</Link>}</div>
          {listingsResult.rows.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">ยังไม่มีรายการที่เปิดให้ยืมในตอนนี้</div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listingsResult.rows.map((item) => (
                <Link key={item.id} href={`/rent/${item.id}`} className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white transition hover:-translate-y-0.5 hover:border-[var(--gold-line)] hover:shadow-[var(--shadow-soft)]">
                  <div className="relative aspect-[16/10] bg-[var(--surface-2)]">
                    {item.cover_image_id ? <Image src={`/api/rental-images/${item.cover_image_id}/content`} alt={item.title} fill unoptimized sizes="(max-width:768px) 100vw,33vw" className="object-cover" /> : <div className="grid h-full place-items-center text-xs font-bold text-[var(--muted)]">ยังไม่มีรูป</div>}
                  </div>
                  <div className="p-4"><div className="flex items-center justify-between gap-2"><StatusPill>{item.category}</StatusPill><span className="flex items-center gap-1 text-[10px] text-[var(--muted)]"><MapPinIcon size={12}/>{item.province}</span></div><h3 className="mt-3 line-clamp-2 font-black">{item.title}</h3><p className="mt-2 text-sm font-black text-[var(--gold-strong)]">{item.daily_rate ? `฿${money.format(Number(item.daily_rate))}/วัน` : `฿${money.format(Number(item.hourly_rate ?? 0))}/ชม.`}</p></div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-9">
          <div><p className="bb-label">Trust</p><h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">รีวิวล่าสุด</h2></div>
          {reviewsResult.rows.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">ยังไม่มีรีวิวจากการยืมที่เสร็จสมบูรณ์</div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {reviewsResult.rows.map((review) => (
                <article key={review.id} className="rounded-[22px] border border-[var(--line)] bg-white p-5">
                  <div className="flex items-center gap-3"><UserAvatar userId={review.reviewer_id} displayName={review.reviewer_name} version={review.reviewer_avatar_updated_at?.getTime() ?? 0} className="h-10 w-10 rounded-xl"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{review.reviewer_name}</p><p className="mt-0.5 text-[10px] text-[var(--muted)]">{date.format(review.created_at)}</p></div><div className="flex items-center gap-1 text-sm font-black"><StarIcon size={14}/>{review.rating}</div></div>
                  <p className="mt-4 text-sm leading-6 text-[var(--muted-strong)]">{review.comment || "ผู้รีวิวไม่ได้เขียนความคิดเห็นเพิ่มเติม"}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
