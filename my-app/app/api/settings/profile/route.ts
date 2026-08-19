import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { query } from "@/lib/db";
import { profileSettingsSchema } from "@/lib/forms/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = QueryResultRow & {
  display_name: string;
  phone: string | null;
  bio: string | null;
};

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = profileSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, code: "INVALID_PROFILE", message: parsed.error.issues[0]?.message ?? "ข้อมูลโปรไฟล์ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const phone = parsed.data.phone === "" ? null : parsed.data.phone;
    const bio = parsed.data.bio?.trim() ? parsed.data.bio : null;
    const result = await query<ProfileRow>(
      `UPDATE users
       SET display_name = $2,
           phone = $3,
           bio = $4
       WHERE id = $1
       RETURNING display_name, phone, bio`,
      [user.id, parsed.data.displayName, phone, bio],
    );

    return NextResponse.json({
      ok: true,
      profile: {
        displayName: result.rows[0].display_name,
        phone: result.rows[0].phone,
        bio: result.rows[0].bio,
      },
    });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    if ((error as { code?: string })?.code === "23505") {
      return NextResponse.json({ ok: false, code: "PHONE_IN_USE", message: "เบอร์โทรนี้ถูกใช้กับบัญชีอื่นแล้ว" }, { status: 409 });
    }
    console.error("Profile settings update failed", error);
    return NextResponse.json({ ok: false, code: "PROFILE_UPDATE_FAILED", message: "บันทึกโปรไฟล์ไม่สำเร็จ" }, { status: 500 });
  }
}
