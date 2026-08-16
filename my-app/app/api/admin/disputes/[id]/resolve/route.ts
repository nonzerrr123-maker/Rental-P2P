import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";
import { DisputeError, resolveDispute } from "@/lib/rental/disputes";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 }); }
    const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const dispute = await resolveDispute(admin, id, {
      resolution: data.resolution,
      notes: data.notes,
      partialRefundAmount: data.partialRefundAmount,
      manualRefundReference: data.manualRefundReference,
    });
    return NextResponse.json({ ok: true, dispute });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof DisputeError) return NextResponse.json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
    console.error("Failed to resolve dispute", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to resolve dispute" }, { status: 500 });
  }
}
