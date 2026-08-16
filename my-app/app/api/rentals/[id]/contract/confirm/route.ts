import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { confirmRentalContract, FulfillmentError } from "@/lib/rental/fulfillment";

function fulfillmentErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof FulfillmentError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const rental = await confirmRentalContract(user, id);
    return NextResponse.json({ ok: true, rental });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const fulfillmentResponse = fulfillmentErrorResponse(error);
    if (fulfillmentResponse) return fulfillmentResponse;
    console.error("Failed to confirm rental contract", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to confirm contract" }, { status: 500 });
  }
}
