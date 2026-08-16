import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, user: null }, { status: 401 });
    }

    return NextResponse.json(
      { ok: true, user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Current user lookup failed", error);
    return NextResponse.json({ ok: false, user: null }, { status: 500 });
  }
}
