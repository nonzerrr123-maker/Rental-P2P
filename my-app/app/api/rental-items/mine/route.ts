import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { listRentalListingsForOwner } from "@/lib/rental/listings";

export async function GET() {
  try {
    const user = await requireVerifiedUser();
    const items = await listRentalListingsForOwner(user.id);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to load owner rental listings", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to load rental listings" },
      { status: 500 },
    );
  }
}
