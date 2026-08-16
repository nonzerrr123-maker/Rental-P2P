import { NextResponse } from "next/server";
import { getPublicRentalItem } from "@/lib/rental/marketplace";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const item = await getPublicRentalItem(id);
    if (!item) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Rental item not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: true, item },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to load public rental item", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to load rental item" },
      { status: 500 },
    );
  }
}
