import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";
import { DisputeError, listDisputesForAdmin } from "@/lib/rental/disputes";

export async function GET() {
  try {
    const admin = await requireAdmin();
    return NextResponse.json({ ok: true, disputes: await listDisputesForAdmin(admin) });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof DisputeError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    console.error("Failed to list admin disputes", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to list disputes" }, { status: 500 });
  }
}
