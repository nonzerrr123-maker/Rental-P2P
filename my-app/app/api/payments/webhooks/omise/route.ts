import { NextResponse } from "next/server";
import { getOmiseConfigurationState, OmiseProviderError, verifyOmiseWebhookSignature } from "@/lib/payments/omise";
import { processOmiseWebhook } from "@/lib/payments/omise-events";

export async function POST(request: Request) {
  const configState = getOmiseConfigurationState();
  if (!configState.configured) {
    return NextResponse.json({ ok: false, code: "OMISE_NOT_CONFIGURED", message: "Omise webhook is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyOmiseWebhookSignature(
    rawBody,
    request.headers.get("Omise-Signature"),
    request.headers.get("Omise-Signature-Timestamp"),
  )) {
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
