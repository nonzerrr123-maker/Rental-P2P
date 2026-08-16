import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireVerifiedUser();
    return NextResponse.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Rental access lookup failed", error);
    return NextResponse.json({ ok: false, message: "Unable to resolve rental access" }, { status: 500 });
  }
}
