import { NextResponse } from "next/server";
import { z } from "zod";
import { AvatarError, readAvatar } from "@/lib/profile/avatar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId: raw } = await params;
    const parsed = uuid.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ ok: false, code: "INVALID_USER_ID" }, { status: 400 });
    const avatar = await readAvatar(parsed.data);
    if (!avatar) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
    return new NextResponse(avatar.response.body, {
      status: 200,
      headers: {
        "Content-Type": avatar.contentType,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AvatarError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    console.error("Avatar proxy failed", error);
    return NextResponse.json({ ok: false, code: "AVATAR_READ_FAILED" }, { status: 500 });
  }
}
