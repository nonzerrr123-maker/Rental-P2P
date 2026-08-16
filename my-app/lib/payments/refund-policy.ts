import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";

export type RefundPolicy = {
  exists: boolean;
  automated: boolean;
  reason: string | null;
};

type RefundPolicyRow = QueryResultRow & {
  provider: string;
  type: string;
  metadata: Record<string, unknown> | null;
};

export async function getRefundPolicy(paymentId: string): Promise<RefundPolicy> {
  const result = await query<RefundPolicyRow>(
    `SELECT provider, type::text AS type, metadata FROM payments WHERE id = $1 LIMIT 1`,
    [paymentId],
  );
  const payment = result.rows[0];
  if (!payment) return { exists: false, automated: false, reason: "Payment not found" };
  const paymentMethod = typeof payment.metadata?.paymentMethod === "string" ? payment.metadata.paymentMethod : null;
  const bundledPromptPay = payment.metadata?.bundledCheckout === true;
  if (payment.provider === "OMISE" && (paymentMethod === "PROMPTPAY" || bundledPromptPay)) {
    return {
      exists: true,
      automated: false,
      reason: "Omise PromptPay does not support API refunds; handle the customer refund operationally and reconcile it before changing payment/deposit state",
    };
  }
  return { exists: true, automated: true, reason: null };
}
