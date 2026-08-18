import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { AvatarError, removeAvatar, uploadAvatar } from "@/lib/profile/avatar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function avatarError(error: unknown): NextResponse | null {
  if (!(error instanceof AvatarError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, code: "IMAGE_REQUIRED", message: "กรุณาเลือกรูปโปรไฟล์" }, { status: 400 });
    const avatar = await uploadAvatar(user.id, file);
    return NextResponse.json({ ok: true, avatar });
  } catch (error) {
    const auth = authorizationErrorResponse(error); if (auth) return auth;
    const avatar = avatarError(error); if (avatar) return avatar;
    console.error("Avatar upload failed", error);
    return NextResponse.json({ ok: false, code: "AVATAR_UPLOAD_FAILED", message: "อัปโหลดรูปโปรไฟล์ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await removeAvatar(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authorizationErrorResponse(error); if (auth) return auth;
    const avatar = avatarError(error); if (avatar) return avatar;
    console.error("Avatar removal failed", error);
    return NextResponse.json({ ok: false, code: "AVATAR_REMOVE_FAILED", message: "ลบรูปโปรไฟล์ไม่สำเร็จ" }, { status: 500 });
  }
}
