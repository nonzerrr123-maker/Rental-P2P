import Link from "next/link";
import type { QueryResultRow } from "pg";
import SiteHeader from "@/components/site-header";
import UserAvatar from "@/components/user-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionEyebrow } from "@/components/ui/primitives";
import { requireUserPage } from "@/lib/auth/authorization";
import { query } from "@/lib/db";
import AvatarSettings from "./avatar-settings";
import ProfileSettingsForm from "./profile-settings-form";

type ProfileSettingsRow = QueryResultRow & {
  display_name: string;
  phone: string | null;
  email: string;
  bio: string | null;
  avatar_updated_at: Date | null;
};

export default async function ProfileSettingsPage() {
  const user = await requireUserPage("/settings/profile");
  const result = await query<ProfileSettingsRow>(
    `SELECT display_name, phone, email, bio, avatar_updated_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [user.id],
  );
  const profile = result.rows[0];

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/settings" className="text-xs font-black text-[var(--gold-strong)]">← การตั้งค่า</Link>
        <div className="mt-6"><SectionEyebrow>Profile settings</SectionEyebrow></div>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.045em]">โปรไฟล์ของคุณ</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">จัดการข้อมูลที่ใช้สร้างความน่าเชื่อถือใน Borow Borow โดยไม่แตะข้อมูล KYC ที่ผ่านการตรวจแล้ว</p>
          </div>
          <Link href={`/users/${user.id}`} className="text-sm font-black text-[var(--gold-strong)]">ดู Public Profile →</Link>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <UserAvatar userId={user.id} displayName={profile.display_name} version={profile.avatar_updated_at?.getTime() ?? 0} className="h-12 w-12 rounded-2xl" />
              <div className="min-w-0">
                <CardTitle>{profile.display_name}</CardTitle>
                <CardDescription className="truncate">{profile.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-7">
            <AvatarSettings userId={user.id} displayName={profile.display_name} />
            <div className="border-t border-[var(--line)] pt-6">
              <ProfileSettingsForm displayName={profile.display_name} phone={profile.phone} bio={profile.bio} />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
