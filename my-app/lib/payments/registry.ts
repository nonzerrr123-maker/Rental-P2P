import type { PaymentProvider } from "@/lib/payments/provider";
import { getOmiseConfigurationState, OmisePaymentProvider } from "@/lib/payments/omise";
import { SandboxPaymentProvider } from "@/lib/payments/sandbox";

const sandbox = new SandboxPaymentProvider();
const omise = new OmisePaymentProvider();

export type PaymentProviderState = {
  mode: "SANDBOX" | "OMISE";
  configured: boolean;
  provider: PaymentProvider;
  reason: string | null;
};

export function getPaymentProviderState(): PaymentProviderState {
  const requested = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || "sandbox";
  if (requested === "omise") {
    const state = getOmiseConfigurationState();
    return {
      mode: "OMISE",
      configured: state.configured,
      provider: omise,
      reason: state.reason,
    };
  }
  if (requested !== "sandbox") {
    return {
      mode: "SANDBOX",
      configured: false,
      provider: sandbox,
      reason: `Unknown PAYMENT_PROVIDER=${requested}; set sandbox or omise explicitly`,
    };
  }
  return { mode: "SANDBOX", configured: true, provider: sandbox, reason: null };
}
