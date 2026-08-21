import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import { getCommunityRequest } from "@/lib/community/service";
import CommunityEditForm from "./community-edit-form";

export default async function CommunityEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireVerifiedUserPage(`/community/${id}/edit`);
  const item = await getCommunityRequest(id);
  if (!item || item.requesterId !== user.id) notFound();

  return <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
    <SiteHeader/>
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
      <Link href={`/community/${item.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-black text-[var(--muted-strong)] hover:bg-white"><ChevronLeftIcon size={17}/>กลับโพสต์</Link>
      <div className="mt-3 mb-6"><p className="bb-label">Edit community request</p><h1 className="mt-2 text-3xl font-black tracking-[-0.045em]">แก้ไขโพสต์หาของ</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">แก้ได้เฉพาะตอนโพสต์ยังเปิดรับข้อเสนอ (OPEN) เท่านั้น</p></div>
      {item.status === "OPEN" ? <CommunityEditForm item={item}/> : <div className="rounded-[28px] border border-[var(--line)] bg-white p-7 text-center"><h2 className="text-xl font-black">โพสต์นี้แก้ไขไม่ได้แล้ว</h2><p className="mt-2 text-sm text-[var(--muted)]">สถานะปัจจุบันคือ {item.status} ข้อมูลธุรกรรมที่จับคู่แล้วจะถูกเก็บตามเดิม</p><Link href={`/community/${item.id}`} className="mt-5 inline-flex rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-black text-white">ดูโพสต์</Link></div>}
    </div>
  </main>;
}
