import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";
import { confirmManualDepositRefund, FulfillmentError } from "@/lib/rental/fulfillment";

function fulfillmentErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof FulfillmentError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 });
    }
    const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const rental = await confirmManualDepositRefund(admin, id, data.providerReference, data.notes);
    return NextResponse.json({ ok: true, rental });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const fulfillmentResponse = fulfillmentErrorResponse(error);
    if (fulfillmentResponse) return fulfillmentResponse;
    console.error("Failed to reconcile manual deposit refund", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to reconcile manual deposit refund" }, { status: 500 });
  }
}
