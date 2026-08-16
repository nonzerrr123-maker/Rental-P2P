import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentProvider,
  ProviderCreatePaymentInput,
  ProviderCreatePaymentResult,
  ProviderRefundResult,
} from "@/lib/payments/provider";

export type OmiseConfiguration = {
  apiBaseUrl: string;
  secretKey: string;
  webhookSecret: string;
  requestTimeoutMs: number;
  webhookToleranceSeconds: number;
  livePayoutsEnabled: boolean;
};

export type OmiseConfigurationState = {
  configured: boolean;
  config: OmiseConfiguration | null;
  reason: string | null;
};

export type OmiseCharge = {
  id: string;
  status: "pending" | "successful" | "failed" | "expired" | string;
  amount: number;
  currency: string;
  qrImageUrl: string | null;
  livemode: boolean;
};

export type OmiseWebhookEvent = {
  id: string;
  key: string;
  chargeId: string;
};

export class OmiseProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "OmiseProviderError";
  }
}

export class OmiseManualRefundRequiredError extends Error {
  constructor() {
    super("PromptPay refunds cannot be issued through Omise; refund must be handled operationally and reconciled manually");
    this.name = "OmiseManualRefundRequiredError";
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getOmiseConfigurationState(): OmiseConfigurationState {
  const secretKey = process.env.OMISE_SECRET_KEY?.trim() ?? "";
  const webhookSecret = process.env.OMISE_WEBHOOK_SECRET?.trim() ?? "";
  if (!secretKey || !webhookSecret) {
    return {
      configured: false,
      config: null,
      reason: "OMISE_SECRET_KEY and OMISE_WEBHOOK_SECRET are required",
    };
  }
  return {
    configured: true,
    reason: null,
    config: {
      apiBaseUrl: (process.env.OMISE_API_BASE_URL?.trim() || "https://api.omise.co").replace(/\/$/, ""),
      secretKey,
      webhookSecret,
      requestTimeoutMs: positiveInteger(process.env.OMISE_REQUEST_TIMEOUT_MS, 8_000),
      webhookToleranceSeconds: positiveInteger(process.env.OMISE_WEBHOOK_TOLERANCE_SECONDS, 300),
      livePayoutsEnabled: process.env.OMISE_ENABLE_LIVE_PAYOUTS?.trim().toLowerCase() === "true",
    },
  };
}

function requireOmiseConfig(): OmiseConfiguration {
  const state = getOmiseConfigurationState();
  if (!state.config) throw new OmiseProviderError(state.reason ?? "Omise is not configured");
  return state.config;
}

function authHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`, "utf8").toString("base64")}`;
}

function getNested(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function normalizeCharge(payload: unknown): OmiseCharge {
  if (!payload || typeof payload !== "object") throw new OmiseProviderError("Omise returned an invalid charge payload");
  const row = payload as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.status !== "string" || typeof row.amount !== "number" || typeof row.currency !== "string") {
    throw new OmiseProviderError("Omise charge response is missing required fields");
  }
  const qrCandidates = [
    getNested(row, ["source", "scannable_code", "image", "download_uri"]),
    getNested(row, ["source", "barcode", "image", "download_uri"]),
    getNested(row, ["source", "qr_code", "image", "download_uri"]),
  ];
  const qrImageUrl = qrCandidates.find((entry): entry is string => typeof entry === "string" && entry.length > 0) ?? null;
  return {
    id: row.id,
    status: row.status,
    amount: row.amount,
    currency: row.currency.toUpperCase(),
    qrImageUrl,
    livemode: row.livemode === true,
  };
}

async function omiseRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const config = requireOmiseConfig();
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(config.secretKey),
      ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(config.requestTimeoutMs),
    cache: "no-store",
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Provider response bodies are intentionally not surfaced to clients.
  }
  if (!response.ok) {
    throw new OmiseProviderError(`Omise API request failed with status ${response.status}`, response.status);
  }
  return payload;
}

export async function retrieveOmiseCharge(chargeId: string): Promise<OmiseCharge> {
  if (!/^chrg(?:_test)?_[0-9a-z]+$/i.test(chargeId)) throw new OmiseProviderError("Omise charge reference is invalid");
  return normalizeCharge(await omiseRequest(`/charges/${encodeURIComponent(chargeId)}`));
}

export class OmisePaymentProvider implements PaymentProvider {
  readonly name = "OMISE";

  async createPayment(input: ProviderCreatePaymentInput): Promise<ProviderCreatePaymentResult> {
    if (input.currency.toUpperCase() !== "THB") throw new OmiseProviderError("Omise PromptPay checkout requires THB");
    const params = new URLSearchParams();
    params.set("amount", String(input.amountMinor));
    params.set("currency", "THB");
    params.set("source[type]", "promptpay");
    params.set("description", `Borow Borow ${input.type} ${input.rentalRequestId}`);
    params.set("metadata[payment_id]", input.paymentId);
    params.set("metadata[rental_request_id]", input.rentalRequestId);
    params.set("metadata[idempotency_key]", input.idempotencyKey);
    const charge = normalizeCharge(await omiseRequest("/charges", { method: "POST", body: params }));
    if (!charge.qrImageUrl) throw new OmiseProviderError("Omise PromptPay charge did not return a QR image");

    // Never trust create-charge as final payment authority. The local payment stays
    // actionable until a signed webhook is received and the charge is retrieved again.
    return {
      provider: this.name,
      providerReference: charge.id,
      state: "REQUIRES_ACTION",
      action: { kind: "QR", imageUrl: charge.qrImageUrl },
      metadata: {
        paymentMethod: "PROMPTPAY",
        providerObservedStatus: charge.status,
        providerLivemode: charge.livemode,
      },
    };
  }

  async refundPayment(): Promise<ProviderRefundResult> {
    throw new OmiseManualRefundRequiredError();
  }
}

export function verifyOmiseWebhookSignature(rawBody: string, signatureHeader: string | null, timestampHeader: string | null): boolean {
  const state = getOmiseConfigurationState();
  if (!state.config || !signatureHeader || !timestampHeader) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > state.config.webhookToleranceSeconds) return false;

  let secret: Buffer;
  try {
    secret = Buffer.from(state.config.webhookSecret, "base64");
  } catch {
    return false;
  }
  if (secret.length === 0) return false;
  const expected = createHmac("sha256", secret).update(`${timestampHeader}.${rawBody}`, "utf8").digest();
  for (const candidate of signatureHeader.split(",").map((value) => value.trim()).filter(Boolean)) {
    if (!/^[0-9a-f]{64}$/i.test(candidate)) continue;
    const actual = Buffer.from(candidate, "hex");
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true;
  }
  return false;
}

export function parseOmiseWebhookEvent(rawBody: string): OmiseWebhookEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new OmiseProviderError("Webhook body is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new OmiseProviderError("Webhook payload is invalid");
  const event = parsed as Record<string, unknown>;
  const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
  if (typeof event.id !== "string" || typeof event.key !== "string" || typeof data.id !== "string") {
    throw new OmiseProviderError("Webhook event is missing id, key, or charge reference");
  }
  return { id: event.id, key: event.key, chargeId: data.id };
}

export type OmiseTransferResult = {
  id: string;
  amount: number;
  recipient: string | null;
  sent: boolean;
  paid: boolean;
  failureCode: string | null;
};

export async function createOmiseTransfer(input: { recipientId: string; amountMinor: number; idempotencyKey: string }): Promise<OmiseTransferResult> {
  const config = requireOmiseConfig();
  if (!config.livePayoutsEnabled) throw new OmiseProviderError("Live Omise payouts are disabled pending recipient onboarding and bank verification");
  if (!/^recp(?:_test)?_[0-9a-z]+$/i.test(input.recipientId)) throw new OmiseProviderError("Omise recipient reference is invalid");
  const params = new URLSearchParams();
  params.set("recipient", input.recipientId);
  params.set("amount", String(input.amountMinor));
  params.set("idemp_key", input.idempotencyKey);
  params.set("fail_fast", "true");
  const payload = await omiseRequest("/transfers", { method: "POST", body: params });
  if (!payload || typeof payload !== "object") throw new OmiseProviderError("Omise returned an invalid transfer payload");
  const row = payload as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.amount !== "number") throw new OmiseProviderError("Omise transfer response is missing required fields");
  return {
    id: row.id,
    amount: row.amount,
    recipient: typeof row.recipient === "string" ? row.recipient : null,
    sent: row.sent === true,
    paid: row.paid === true,
    failureCode: typeof row.failure_code === "string" ? row.failure_code : null,
  };
}