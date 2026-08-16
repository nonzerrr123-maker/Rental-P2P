import type { PaymentProvider } from "@/lib/payments/provider";
import { SandboxPaymentProvider } from "@/lib/payments/sandbox";

const sandbox = new SandboxPaymentProvider();

export type PaymentProviderState = {
  mode: "SANDBOX";
  configured: boolean;
  provider: PaymentProvider;
  reason: string | null;
};

export function getPaymentProviderState(): PaymentProviderState {
  const requested = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || "sandbox";
  if (requested !== "sandbox") {
    return {
      mode: "SANDBOX",
      configured: false,
      provider: sandbox,
      reason: `PAYMENT_PROVIDER=${requested} is not configured yet; using sandbox provider`,
    };
  }
  return { mode: "SANDBOX", configured: true, provider: sandbox, reason: null };
}
