import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionEyebrow, StatusPill } from "@/components/ui/primitives";
import { requireUserPage } from "@/lib/auth/authorization";

export default async function SettingsPage() {
  const user = await requireUserPage("/settings");

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="bb-container py-8 sm:py-12">
        <SectionEyebrow>Settings</SectionEyebrow>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">ตั้งค่าบัญชี</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">จัดการข้อมูลที่คนอื่นเห็น ความปลอดภัยของบัญชี และสถานะการยืนยันตัวตนจากจุดเดียว</p>
          </div>
          <StatusPill tone={user.verificationStatus === "VERIFIED" ? "gold" : "neutral"}>{user.verificationStatus}</StatusPill>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <Link href="/settings/profile" className="block">
            <Card className="h-full hover:border-[var(--gold-line)]">
              <CardHeader>
                <CardTitle>โปรไฟล์</CardTitle>
                <CardDescription>แก้ชื่อที่แสดงและเบอร์โทรที่ใช้กับบัญชี</CardDescription>
              </CardHeader>
              <CardContent><span className="text-sm font-black text-[var(--gold-strong)]">จัดการโปรไฟล์ →</span></CardContent>
            </Card>
          </Link>
          <Link href="/settings/security" className="block">
            <Card className="h-full hover:border-[var(--gold-line)]">
              <CardHeader>
                <CardTitle>ความปลอดภัย</CardTitle>
                <CardDescription>เปลี่ยนรหัสผ่านและออกจากระบบทุกอุปกรณ์</CardDescription>
              </CardHeader>
              <CardContent><span className="text-sm font-black text-[var(--gold-strong)]">จัดการความปลอดภัย →</span></CardContent>
            </Card>
          </Link>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>ข้อมูลบัญชี</CardTitle>
              <CardDescription>ข้อมูลส่วนนี้ใช้ระบุตัวบัญชีและไม่แสดงเป็นข้อมูลสาธารณะโดยตรง</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-bold text-[var(--muted)]">อีเมล</p><p className="mt-1 truncate text-sm font-black">{user.email}</p></div>
              <div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-bold text-[var(--muted)]">บทบาท</p><p className="mt-1 text-sm font-black">{user.role}</p></div>
              <div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-bold text-[var(--muted)]">KYC</p><p className="mt-1 text-sm font-black">{user.verificationStatus}</p></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
