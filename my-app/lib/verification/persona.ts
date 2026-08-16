import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_PERSONA_API_BASE_URL = "https://api.withpersona.com";
const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

export type PersonaConfiguration = {
  apiBaseUrl: string;
  apiKey: string;
  inquiryTemplateId: string;
  webhookSecret: string;
  apiVersion?: string;
  webhookToleranceSeconds: number;
  requestTimeoutMs: number;
};

export type PersonaInquiryStart = {
  inquiryId: string;
  redirectUrl: string;
};

export type PersonaWebhookEvent = {
  eventId: string;
  eventName: string;
  inquiryId: string;
  referenceId: string | null;
  inquiryStatus: string | null;
};

export class PersonaProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "PersonaProviderError";
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getPersonaConfiguration(): PersonaConfiguration | null {
  const apiKey = process.env.PERSONA_API_KEY?.trim();
  const inquiryTemplateId = process.env.PERSONA_INQUIRY_TEMPLATE_ID?.trim();
  const webhookSecret = process.env.PERSONA_WEBHOOK_SECRET?.trim();

  if (!apiKey || !inquiryTemplateId || !webhookSecret) return null;

  return {
    apiBaseUrl: (process.env.PERSONA_API_BASE_URL?.trim() || DEFAULT_PERSONA_API_BASE_URL).replace(/\/$/, ""),
    apiKey,
    inquiryTemplateId,
    webhookSecret,
    apiVersion: process.env.PERSONA_API_VERSION?.trim() || undefined,
    webhookToleranceSeconds: positiveInteger(
      process.env.PERSONA_WEBHOOK_TOLERANCE_SECONDS,
      DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
    ),
    requestTimeoutMs: positiveInteger(
      process.env.PERSONA_REQUEST_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS,
    ),
  };
}

function personaHeaders(config: PersonaConfiguration, idempotencyKey?: string): HeadersInit {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    ...(config.apiVersion ? { "Persona-Version": config.apiVersion } : {}),
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  };
}

async function fetchPersona(
  config: PersonaConfiguration,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new PersonaProviderError(`Persona request timed out after ${config.requestTimeoutMs}ms`);
    }
    throw error;
  }
}

async function parsePersonaResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new PersonaProviderError(
      `Persona request failed with HTTP ${response.status}`,
      response.status,
    );
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new PersonaProviderError("Persona returned an invalid JSON response", response.status);
  }
}

export async function createPersonaInquiry(input: {
  config: PersonaConfiguration;
  userId: string;
  idempotencyKey: string;
}): Promise<PersonaInquiryStart> {
  const response = await fetchPersona(
    input.config,
    `${input.config.apiBaseUrl}/api/v1/inquiries?auto-create-one-time-link=true`,
    {
      method: "POST",
      headers: personaHeaders(input.config, input.idempotencyKey),
      body: JSON.stringify({
        data: {
          attributes: {
            "inquiry-template-id": input.config.inquiryTemplateId,
            "reference-id": input.userId,
          },
        },
      }),
    },
  );

  const result = (await parsePersonaResponse(response)) as {
    data?: { id?: string };
    meta?: { "one-time-link"?: string; "one-time-link-short"?: string };
  };

  const inquiryId = result.data?.id?.trim();
  const redirectUrl =
    result.meta?.["one-time-link"]?.trim() || result.meta?.["one-time-link-short"]?.trim();

  if (!inquiryId || !redirectUrl) {
    throw new PersonaProviderError("Persona inquiry response is missing an inquiry ID or hosted-flow link");
  }

  return { inquiryId, redirectUrl };
}

export async function generatePersonaOneTimeLink(input: {
  config: PersonaConfiguration;
  inquiryId: string;
  idempotencyKey: string;
}): Promise<string> {
  const response = await fetchPersona(
    input.config,
    `${input.config.apiBaseUrl}/api/v1/inquiries/${encodeURIComponent(input.inquiryId)}/generate-one-time-link`,
    {
      method: "POST",
      headers: personaHeaders(input.config, input.idempotencyKey),
      body: "{}",
    },
  );

  const result = (await parsePersonaResponse(response)) as {
    meta?: { "one-time-link"?: string; "one-time-link-short"?: string };
  };
  const redirectUrl =
    result.meta?.["one-time-link"]?.trim() || result.meta?.["one-time-link-short"]?.trim();
  if (!redirectUrl) {
    throw new PersonaProviderError("Persona did not return a one-time link");
  }
  return redirectUrl;
}

function safeHexEqual(actualHex: string, expectedHex: string): boolean {
  if (!/^[a-f0-9]+$/i.test(actualHex) || !/^[a-f0-9]+$/i.test(expectedHex)) return false;
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyPersonaWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds: number;
  nowSeconds?: number;
}): boolean {
  if (!input.signatureHeader) return false;

  const pairs = input.signatureHeader.trim().split(/\s+/).filter(Boolean);
  const timestampText = pairs[0]?.split(",").find((part) => part.startsWith("t="))?.slice(2);
  const timestamp = Number.parseInt(timestampText ?? "", 10);
  if (!Number.isFinite(timestamp)) return false;

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > input.toleranceSeconds) return false;

  const expected = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest("hex");

  const signatures = pairs
    .map((pair) => pair.match(/(?:^|,)v1=([a-f0-9]+)/i)?.[1])
    .filter((value): value is string => Boolean(value));

  return signatures.some((signature) => safeHexEqual(signature, expected));
}

export function parsePersonaWebhookEvent(payload: unknown): PersonaWebhookEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as {
    data?: {
      id?: unknown;
      attributes?: {
        name?: unknown;
        payload?: {
          data?: {
            id?: unknown;
            attributes?: {
              status?: unknown;
              "reference-id"?: unknown;
            };
          };
        };
      };
    };
  };

  const eventId = typeof root.data?.id === "string" ? root.data.id : null;
  const eventName = typeof root.data?.attributes?.name === "string" ? root.data.attributes.name : null;
  const inquiry = root.data?.attributes?.payload?.data;
  const inquiryId = typeof inquiry?.id === "string" ? inquiry.id : null;
  const referenceId =
    typeof inquiry?.attributes?.["reference-id"] === "string"
      ? inquiry.attributes["reference-id"]
      : null;
  const inquiryStatus = typeof inquiry?.attributes?.status === "string" ? inquiry.attributes.status : null;

  if (!eventId || !eventName || !inquiryId) return null;
  return { eventId, eventName, inquiryId, referenceId, inquiryStatus };
}
