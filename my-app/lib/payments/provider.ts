export type ProviderPaymentState = "PENDING" | "REQUIRES_ACTION" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type ProviderAction =
  | { kind: "NONE" }
  | { kind: "SANDBOX"; confirmPath: string }
  | { kind: "REDIRECT"; url: string }
  | { kind: "QR"; imageUrl: string };

export type ProviderCreatePaymentInput = {
  paymentId: string;
  rentalRequestId: string;
  type: "RENTAL" | "DEPOSIT" | "URGENT_RESERVATION_FEE" | "PLATFORM_FEE";
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  payerEmail?: string | null;
  returnUrl?: string | null;
};

export type ProviderCreatePaymentResult = {
  provider: string;
  providerReference: string;
  state: ProviderPaymentState;
  action: ProviderAction;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ProviderRefundInput = {
  paymentId: string;
  providerReference: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
};

export type ProviderRefundResult = {
  providerReference: string;
  state: ProviderPaymentState;
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResult>;
  refundPayment(input: ProviderRefundInput): Promise<ProviderRefundResult>;
}
