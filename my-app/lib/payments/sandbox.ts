import { randomUUID } from "node:crypto";
import type {
  PaymentProvider,
  ProviderCreatePaymentInput,
  ProviderCreatePaymentResult,
  ProviderRefundInput,
  ProviderRefundResult,
} from "@/lib/payments/provider";

export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "SANDBOX";

  async createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResult> {
    return {
      provider: this.name,
      providerReference: `sandbox_${input.paymentId}_${randomUUID()}`,
      state: "REQUIRES_ACTION",
      action: {
        kind: "SANDBOX",
        confirmPath: `/api/payments/sandbox/${input.paymentId}/confirm`,
      },
      metadata: {
        sandbox: true,
        amountMinor: input.amountMinor,
        currency: input.currency,
      },
    };
  }

  async refundPayment(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    return {
      providerReference: `sandbox_refund_${input.paymentId}_${randomUUID()}`,
      state: "SUCCEEDED",
    };
  }
}

export function sandboxPaymentsEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.SANDBOX_PAYMENT_ENABLED?.trim().toLowerCase() === "true";
}
