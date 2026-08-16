import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { BookingError } from "@/lib/rental/bookings";
import { applyRentalLifecycleAction } from "@/lib/rental/lifecycle";

function bookingErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof BookingError)) return null;
  return NextResponse.json(
    { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors },
    { status: error.status },
  );
}

function concurrentDecisionResponse(error: unknown): NextResponse | null {
  const code = error && typeof error === "object" && "code" in error
    ? (error as { code?: string }).code
    : undefined;
  if (code !== "40P01" && code !== "23P01") return null;
  return NextResponse.json(
    { ok: false, code: "AVAILABILITY_CONFLICT", message: "Another accepted rental blocks this period", fieldErrors: {} },
    { status: 409 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 });
    }
    const decision = body && typeof body === "object" ? (body as Record<string, unknown>).decision : undefined;
    const rentalRequest = await applyRentalLifecycleAction(user, id, decision);
    return NextResponse.json({ ok: true, request: rentalRequest });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const bookingResponse = bookingErrorResponse(error);
    if (bookingResponse) return bookingResponse;
    const concurrentResponse = concurrentDecisionResponse(error);
    if (concurrentResponse) return concurrentResponse;
    console.error("Failed to decide rental request", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to decide rental request" }, { status: 500 });
  }
}
