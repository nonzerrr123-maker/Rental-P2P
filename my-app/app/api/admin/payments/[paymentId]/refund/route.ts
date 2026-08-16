import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";
import { getRefundPolicy } from "@/lib/payments/refund-policy";
import { PaymentError, refundPayment } from "@/lib/payments/service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { paymentId } = await params;
    if (!UUID_PATTERN.test(paymentId)) {
      return NextResponse.json({ ok: false, code: "VALIDATION_ERROR", message: "Payment id is invalid" }, { status: 400 });
    }
    const policy = await getRefundPolicy(paymentId);
    if (!policy.exists) {
      return NextResponse.json({ ok: false, code: "PAYMENT_NOT_FOUND", message: "Payment not found" }, { status: 404 });
    }
    if (!policy.automated) {
      return NextResponse.json({ ok: false, code: "MANUAL_REFUND_REQUIRED", message: policy.reason }, { status: 409 });
    }
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
