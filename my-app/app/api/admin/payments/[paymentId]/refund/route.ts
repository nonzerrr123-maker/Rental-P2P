import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";
import { PaymentError, refundPayment } from "@/lib/payments/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { paymentId } = await params;
    const refund = await refundPayment(admin.id, paymentId);
    return NextResponse.json({ ok: true, refund });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof PaymentError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    console.error("Failed to refund payment", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to refund payment" }, { status: 500 });
  }
}
