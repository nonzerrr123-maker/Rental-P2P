export type ResendConfiguration = {
  apiBaseUrl: string;
  apiKey: string;
  from: string;
  requestTimeoutMs: number;
};

export type ResendConfigurationState = {
  configured: boolean;
  config: ResendConfiguration | null;
  reason: string | null;
};

export class ResendProviderError extends Error {
  constructor(message: string, public readonly status?: number, public readonly providerType?: string) {
    super(message);
    this.name = "ResendProviderError";
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

function normalizeConfiguredBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    const secure = url.protocol === "https:";
    const localLoopback = url.protocol === "http:" && isLoopbackHostname(url.hostname);
    if (!secure && !localLoopback) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveEmailPublicBaseUrl(request: Request): string {
  const configured = normalizeConfiguredBaseUrl(process.env.APP_BASE_URL);
  if (configured) return configured;

  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionHost) {
    const vercelUrl = normalizeConfiguredBaseUrl(`https://${vercelProductionHost}`);
    if (vercelUrl) return vercelUrl;
  }

  const requestUrl = new URL(request.url);
  const requestIsSecure = requestUrl.protocol === "https:";
  const requestIsLoopback = requestUrl.protocol === "http:" && isLoopbackHostname(requestUrl.hostname);
  if (requestIsSecure || requestIsLoopback) return requestUrl.origin;
  throw new Error("A secure public application URL is required for auth email links");
}

export function getResendConfigurationState(): ResendConfigurationState {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return { configured: false, config: null, reason: "RESEND_API_KEY is required" };
  }
  return {
    configured: true,
    reason: null,
    config: {
      apiBaseUrl: (process.env.RESEND_API_BASE_URL?.trim() || "https://api.resend.com").replace(/\/$/, ""),
      apiKey,
      from: process.env.EMAIL_FROM?.trim() || "Borow Borow <onboarding@resend.dev>",
      requestTimeoutMs: positiveInteger(process.env.RESEND_REQUEST_TIMEOUT_MS, 8_000),
    },
  };
}

export function isEmailVerificationRequired(): boolean {
  return process.env.EMAIL_REQUIRE_VERIFICATION?.trim().toLowerCase() === "true";
}

export function emailVerificationTtlSeconds(): number {
  return positiveInteger(process.env.EMAIL_VERIFICATION_TTL_MINUTES, 24 * 60) * 60;
}

export function passwordResetTtlSeconds(): number {
  return positiveInteger(process.env.PASSWORD_RESET_TTL_MINUTES, 30) * 60;
}

export function authEmailCooldownSeconds(): number {
  return positiveInteger(process.env.AUTH_EMAIL_RESEND_COOLDOWN_SECONDS, 60);
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<{ id: string }> {
  const state = getResendConfigurationState();
  if (!state.config) throw new ResendProviderError(state.reason ?? "Resend is not configured");

  const response = await fetch(`${state.config.apiBaseUrl}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${state.config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "borow-borow/1.0",
      "Idempotency-Key": input.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from: state.config.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    signal: AbortSignal.timeout(state.config.requestTimeoutMs),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Do not surface provider response bodies to application users.
  }

  if (!response.ok) {
    const providerType =
      payload && typeof payload === "object" && "name" in payload && typeof payload.name === "string"
        ? payload.name
        : undefined;
    throw new ResendProviderError(`Resend API request failed with status ${response.status}`, response.status, providerType);
  }

  if (!payload || typeof payload !== "object" || !("id" in payload) || typeof payload.id !== "string") {
    throw new ResendProviderError("Resend returned an invalid email response", response.status);
  }
  return { id: payload.id };
}
