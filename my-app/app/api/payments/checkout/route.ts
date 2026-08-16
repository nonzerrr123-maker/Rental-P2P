import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { getCheckoutForUser, PaymentError, startCheckout } from "@/lib/payments/service";

function paymentErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof PaymentError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
}

export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const rentalRequestId = new URL(request.url).searchParams.get("rentalRequestId");
    const checkout = await getCheckoutForUser(user.id, rentalRequestId);
    return NextResponse.json({ ok: true, checkout });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const paymentResponse = paymentErrorResponse(error);
    if (paymentResponse) return paymentResponse;
    console.error("Failed to load checkout", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to load checkout" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 });
    }
    const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const rentalRequestId = data.rentalRequestId;
    const origin = new URL(request.url).origin;
    const checkout = await startCheckout(user.id, rentalRequestId, `${origin}/checkout/${String(rentalRequestId ?? "")}`);
    return NextResponse.json({ ok: true, checkout });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const paymentResponse = paymentErrorResponse(error);
    if (paymentResponse) return paymentResponse;
    console.error("Failed to start checkout", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to start checkout" }, { status: 500 });
  }
}
