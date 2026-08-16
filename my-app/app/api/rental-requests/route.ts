import { NextResponse } from "next/server";
import {
  authorizationErrorResponse,
  requireUser,
  requireVerifiedUser,
} from "@/lib/auth/authorization";
import {
  BookingError,
  createRentalRequest,
  listRentalRequestsForUser,
} from "@/lib/rental/bookings";
import {
  synchronizeCommunicationForUser,
  synchronizeRentalRequestCommunication,
} from "@/lib/rental/communication";
import { expireStaleUrgentReservations, createUrgentRentalRequest } from "@/lib/rental/urgent";

function bookingErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof BookingError)) return null;
  return NextResponse.json(
    {
      ok: false,
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
    },
    { status: error.status },
  );
}

function wantsUrgent(input: unknown): boolean {
  return Boolean(input && typeof input === "object" && (input as Record<string, unknown>).isUrgent === true);
}

async function syncCommunicationBestEffort(userId: string): Promise<void> {
  try {
    await synchronizeCommunicationForUser(userId);
  } catch (error) {
    console.error("Failed to synchronize rental communication", error);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    await expireStaleUrgentReservations();
    await syncCommunicationBestEffort(user.id);
    const requests = await listRentalRequestsForUser(user.id);
    return NextResponse.json({ ok: true, ...requests });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to list rental requests", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to list rental requests" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" },
        { status: 400 },
      );
    }
    await expireStaleUrgentReservations();
    const rentalRequest = wantsUrgent(body)
      ? await createUrgentRentalRequest(user.id, body)
      : await createRentalRequest(user.id, body);
    try {
      await synchronizeRentalRequestCommunication(rentalRequest.id);
    } catch (error) {
      console.error("Rental request created but communication sync failed", error);
    }
    return NextResponse.json({ ok: true, request: rentalRequest }, { status: 201 });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const bookingResponse = bookingErrorResponse(error);
    if (bookingResponse) return bookingResponse;
    console.error("Failed to create rental request", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to create rental request" },
      { status: 500 },
    );
  }
}
