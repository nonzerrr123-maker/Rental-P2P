import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { confirmSandboxPayment, PaymentError } from "@/lib/payments/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const user = await requireVerifiedUser();
    const { paymentId } = await params;
    const checkout = await confirmSandboxPayment(user.id, paymentId);
    return NextResponse.json({ ok: true, checkout });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof PaymentError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    console.error("Failed to confirm sandbox payment", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to confirm payment" }, { status: 500 });
  }
}
