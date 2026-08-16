import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAdmin();
    return NextResponse.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Admin session lookup failed", error);
    return NextResponse.json({ ok: false, message: "Unable to resolve admin session" }, { status: 500 });
  }
}
