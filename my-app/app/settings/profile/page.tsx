import Link from "next/link";
import type { QueryResultRow } from "pg";
import SiteHeader from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionEyebrow } from "@/components/ui/primitives";
import { requireUserPage } from "@/lib/auth/authorization";
import { query } from "@/lib/db";
import ProfileSettingsForm from "./profile-settings-form";

type ProfileSettingsRow = QueryResultRow & { display_name: string; phone: string | null; email: string };

export default async function ProfileSettingsPage() {
  const user = await requireUserPage("/settings/profile");
  const result = await query<ProfileSettingsRow>(
    `SELECT display_name, phone, email FROM users WHERE id = $1 LIMIT 1`,
    [user.id],
  );
  const profile = result.rows[0];

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/settings" className="text-xs font-black text-[var(--gold-strong)]">← การตั้งค่า</Link>
        <SectionEyebrow className="mt-6">Profile settings</SectionEyebrow>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em]">โปรไฟล์ของคุณ</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">แก้ข้อมูลที่ใช้แสดงตัวตนใน Borow Borow โดยไม่แตะข้อมูล KYC ที่ผ่านการตรวจแล้ว</p>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>ข้อมูลโปรไฟล์</CardTitle>
            <CardDescription>อีเมล <span className="font-bold text-[var(--ink)]">{profile.email}</span> เปลี่ยนจากหน้านี้ไม่ได้เพื่อป้องกันการสวมบัญชี</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileSettingsForm displayName={profile.display_name} phone={profile.phone} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
