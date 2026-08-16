import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";
import { listPaymentsForAdmin } from "@/lib/payments/service";

export async function GET() {
  try {
    await requireAdmin();
    const payments = await listPaymentsForAdmin();
    return NextResponse.json({ ok: true, payments });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to list payments for admin", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to list payments" }, { status: 500 });
  }
}
