import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { FulfillmentError, getRentalFulfillment } from "@/lib/rental/fulfillment";

function fulfillmentErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof FulfillmentError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const rental = await getRentalFulfillment(user, id);
    return NextResponse.json({ ok: true, rental });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const fulfillmentResponse = fulfillmentErrorResponse(error);
    if (fulfillmentResponse) return fulfillmentResponse;
    console.error("Failed to load rental fulfillment", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to load rental" }, { status: 500 });
  }
}
