import { NextResponse } from "next/server";
import { getOmiseConfigurationState, OmiseProviderError, verifyOmiseWebhookSignature } from "@/lib/payments/omise";
import { processOmiseWebhook } from "@/lib/payments/omise-events";

export async function POST(request: Request) {
  const configState = getOmiseConfigurationState();
  if (!configState.configured || !configState.config) {
    return NextResponse.json({ ok: false, code: "OMISE_NOT_CONFIGURED", message: "Omise webhook is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();

  // Opn/Omise's documented webhook authenticity flow is to use the event's charge
  // reference and retrieve that charge independently with the merchant secret key.
  // processOmiseWebhook does that before any payment state mutation and also verifies
  // amount/currency against the server-owned checkout snapshot. If a deployment adds
  // an HMAC-signing proxy or another trusted signer, OMISE_WEBHOOK_SECRET keeps the
  // stricter legacy signature gate available without making it a provider requirement.
  if (
    configState.config.webhookSecret &&
    !verifyOmiseWebhookSignature(
      rawBody,
      request.headers.get("Omise-Signature"),
      request.headers.get("Omise-Signature-Timestamp"),
    )
  ) {
    return NextResponse.json({ ok: false, code: "INVALID_SIGNATURE", message: "Invalid Omise webhook signature" }, { status: 401 });
  }

  try {
    const result = await processOmiseWebhook(rawBody);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof OmiseProviderError) {
      if (error.status) {
        console.error("Omise webhook provider verification failed", error);
        return NextResponse.json({ ok: false, code: "PROVIDER_UNAVAILABLE", message: "Unable to verify Omise charge" }, { status: 503 });
      }
      return NextResponse.json({ ok: false, code: "INVALID_EVENT", message: error.message }, { status: 400 });
    }
    console.error("Failed to process Omise webhook", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to process Omise webhook" }, { status: 500 });
  }
}
