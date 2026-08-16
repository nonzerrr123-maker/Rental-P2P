import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { ChevronLeftIcon, UsersIcon } from "@/components/ui/icons";
import { SectionEyebrow } from "@/components/ui/primitives";
import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import CommunityRequestForm from "./community-request-form";

export default async function NewCommunityRequestPage() {
  await requireVerifiedUserPage("/community/new");
  return <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]"><SiteHeader/><section className="mx-auto max-w-3xl px-4 py-7 sm:px-6 sm:py-10"><Link href="/community" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-black text-[var(--muted-strong)] hover:bg-white"><ChevronLeftIcon size={17}/>กลับคอมมู</Link><div className="mt-4 flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]"><UsersIcon size={21}/></span><div><SectionEyebrow>Post a request</SectionEyebrow><h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">หาไม่เจอ? บอกคอมมูว่าต้องการอะไร</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">เมื่อคุณตอบรับข้อเสนอ ระบบจะสร้าง Rental จริงในสถานะรอชำระเงิน โดยไม่ต้องกรอกข้อมูลซ้ำ</p></div></div><CommunityRequestForm/></section></main>;
}
