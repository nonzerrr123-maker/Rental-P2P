import { NextResponse } from "next/server";
import {
  getPersonaConfiguration,
  parsePersonaWebhookEvent,
  verifyPersonaWebhookSignature,
} from "@/lib/verification/persona";
import { processPersonaWebhook } from "@/lib/verification/provider";

export async function POST(request: Request) {
  const config = getPersonaConfiguration();
  if (!config) {
    return NextResponse.json(
      { ok: false, code: "PERSONA_NOT_CONFIGURED", message: "Persona webhook is not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("Persona-Signature");
  const authentic = verifyPersonaWebhookSignature({
    rawBody,
    signatureHeader,
    secret: config.webhookSecret,
    toleranceSeconds: config.webhookToleranceSeconds,
  });
  if (!authentic) {
    return NextResponse.json(
      { ok: false, code: "INVALID_SIGNATURE", message: "Invalid Persona webhook signature" },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_PAYLOAD", message: "Webhook body must be valid JSON" },
      { status: 400 },
    );
  }

  const event = parsePersonaWebhookEvent(payload);
  if (!event) {
    return NextResponse.json(
      { ok: false, code: "INVALID_EVENT", message: "Webhook does not contain a valid Persona inquiry event" },
      { status: 400 },
    );
  }

  try {
    const result = await processPersonaWebhook({ event, rawBody });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Failed to process Persona webhook", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to process Persona webhook" },
      { status: 500 },
    );
  }
}
