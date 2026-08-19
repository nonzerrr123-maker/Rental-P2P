import Link from "next/link";
import type { QueryResultRow } from "pg";
import SiteHeader from "@/components/site-header";
import UserAvatar from "@/components/user-avatar";
import { CalendarIcon, LayoutDashboardIcon, PackageIcon, ShieldCheckIcon, StarIcon, UsersIcon } from "@/components/ui/icons";
import { SectionEyebrow, StatusPill } from "@/components/ui/primitives";
import { requireUserPage } from "@/lib/auth/authorization";
import { query } from "@/lib/db";

type ProfileRow = QueryResultRow & {
  email: string;
  display_name: string;
  phone: string | null;
  bio: string | null;
  role: string;
  verification_status: string;
  rating_average: string;
  rating_count: number;
  created_at: Date;
  avatar_storage_key: string | null;
  avatar_updated_at: Date | null;
  active_listings: string;
  borrowed_count: string;
  lent_count: string;
  community_count: string;
};

const date = new Intl.DateTimeFormat("th-TH", { dateStyle: "long" });

export default async function ProfilePage() {
  const user = await requireUserPage("/profile");
  const result = await query<ProfileRow>(
    `SELECT u.email,u.display_name,u.phone,u.bio,u.role::text,u.verification_status::text,u.rating_average,u.rating_count,u.created_at,u.avatar_storage_key,u.avatar_updated_at,
      (SELECT count(*)::text FROM rental_items ri WHERE ri.owner_id=u.id AND ri.status='ACTIVE') AS active_listings,
      (SELECT count(*)::text FROM rental_requests rr WHERE rr.borrower_id=u.id) AS borrowed_count,
      (SELECT count(*)::text FROM rental_requests rr WHERE rr.lender_id=u.id) AS lent_count,
      (SELECT count(*)::text FROM community_requests cr WHERE cr.requester_id=u.id) AS community_count
     FROM users u WHERE u.id=$1 LIMIT 1`,
    [user.id],
  );
  const profile = result.rows[0];
  const completeness = [Boolean(profile.avatar_storage_key), Boolean(profile.bio?.trim()), Boolean(profile.phone), profile.verification_status === "VERIFIED"].filter(Boolean).length;
  const completenessPercent = completeness * 25;

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0"><SectionEyebrow>Account</SectionEyebrow><h1 className="mt-2 break-words text-3xl font-black tracking-[-0.045em]">โปรไฟล์ของฉัน</h1></div>
          <Link href={`/users/${user.id}`} className="shrink-0 whitespace-nowrap text-sm font-black text-[var(--gold-strong)]">ดู Public Profile →</Link>
        </div>

        <div className="mt-5 flex flex-col gap-5 rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:p-7">
          <UserAvatar userId={user.id} displayName={profile.display_name} version={profile.avatar_updated_at?.getTime() ?? 0} className="h-16 w-16 shrink-0 rounded-2xl text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2"><h2 className="min-w-0 break-words text-2xl font-black tracking-[-0.035em] sm:text-3xl">{profile.display_name}</h2>{profile.verification_status === "VERIFIED" && <StatusPill tone="gold">ยืนยันตัวตนแล้ว</StatusPill>}</div>
            <p className="mt-1 truncate text-sm text-[var(--muted)]">{profile.email}</p>
            <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]"><CalendarIcon size={14} className="mt-0.5 shrink-0"/>สมาชิกตั้งแต่ {date.format(profile.created_at)}</p>
          </div>
          <div className="flex w-fit shrink-0 items-center gap-2 rounded-2xl bg-[var(--surface-2)] px-4 py-3"><StarIcon size={18}/><div><p className="font-black">{Number(profile.rating_average).toFixed(1)}</p><p className="whitespace-nowrap text-[10px] text-[var(--muted)]">{profile.rating_count} รีวิว</p></div></div>
        </div>

        <section className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 rounded-[22px] border border-[var(--line)] bg-white p-5">
            <div className="flex items-center justify-between gap-3"><p className="font-black">แนะนำตัว</p><Link href="/settings/profile" className="shrink-0 whitespace-nowrap text-xs font-black text-[var(--gold-strong)]">แก้ไข →</Link></div>
            <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-7 text-[var(--muted-strong)]">{profile.bio || "ยังไม่ได้เขียนคำแนะนำตัว เพิ่มข้อมูลสั้น ๆ เพื่อช่วยสร้างความน่าเชื่อถือก่อนเริ่มยืม/ให้ยืม"}</p>
          </div>
          <div className="min-w-0 rounded-[22px] border border-[var(--gold-line)] bg-[var(--gold-soft)] p-5">
            <div className="flex items-center justify-between gap-3"><p className="font-black">ความสมบูรณ์โปรไฟล์</p><b className="shrink-0">{completenessPercent}%</b></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[var(--gold-strong)]" style={{ width: `${completenessPercent}%` }} /></div>
            <p className="mt-3 text-xs leading-5 text-[var(--muted-strong)]">รูปโปรไฟล์ · แนะนำตัว · เบอร์โทร · ยืนยันตัวตน</p>
            {completenessPercent < 100 && <Link href="/settings/profile" className="mt-3 inline-block text-xs font-black text-[var(--gold-strong)]">เติมโปรไฟล์ให้ครบ →</Link>}
          </div>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[[PackageIcon,"ของให้ยืม",profile.active_listings],[LayoutDashboardIcon,"เคยยืม",profile.borrowed_count],[ShieldCheckIcon,"เคยให้ยืม",profile.lent_count],[UsersIcon,"โพสต์คอมมู",profile.community_count]].map(([Icon,label,value]) => { const Visual=Icon as typeof PackageIcon; return <div key={String(label)} className="min-w-0 rounded-2xl border border-[var(--line)] bg-white p-4"><Visual size={18} className="text-[var(--gold-strong)]"/><p className="mt-3 text-2xl font-black">{String(value)}</p><p className="mt-1 break-words text-xs leading-5 text-[var(--muted)]">{String(label)}</p></div>; })}
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/settings" className="min-w-0 rounded-[22px] border border-[var(--gold-line)] bg-[var(--gold-soft)] p-5 hover:bg-white"><p className="font-black">ตั้งค่าบัญชี</p><p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">โปรไฟล์ ความปลอดภัย การยืนยันตัวตน และการแจ้งเตือน</p></Link>
          <Link href="/dashboard" className="min-w-0 rounded-[22px] border border-[var(--line)] bg-white p-5 hover:border-[var(--gold-line)]"><p className="font-black">Rental Dashboard</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">คำขอยืม การชำระ นัดรับ คืนของ และสถานะทั้งหมด</p></Link>
          <Link href="/lend" className="min-w-0 rounded-[22px] border border-[var(--line)] bg-white p-5 hover:border-[var(--gold-line)]"><p className="font-black">ของที่ฉันปล่อยยืม</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">เพิ่มรายการ จัดการรูป ราคา พื้นที่ และยืมด่วน</p></Link>
          <Link href="/community" className="min-w-0 rounded-[22px] border border-[var(--line)] bg-white p-5 hover:border-[var(--gold-line)]"><p className="font-black">Community</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">ดูคำขอหาของและข้อเสนอจากคนใกล้ตัว</p></Link>
          <Link href="/verification" className="min-w-0 rounded-[22px] border border-[var(--line)] bg-white p-5 hover:border-[var(--gold-line)] sm:col-span-2"><p className="font-black">Trust & identity</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">สถานะ KYC: {profile.verification_status}</p></Link>
        </section>
      </div>
    </main>
  );
}
