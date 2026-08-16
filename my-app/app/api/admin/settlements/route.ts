import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";
import { listPlatformSettlements } from "@/lib/payments/settlements";

export async function GET() {
  try {
    await requireAdmin();
    const settlements = await listPlatformSettlements();
    return NextResponse.json({ ok: true, settlements });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to list settlements", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to list settlements" }, { status: 500 });
  }
}
