import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { deleteRentalImage, RentalImageError } from "@/lib/rental/images";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  try {
    const user = await requireVerifiedUser();
    const { id, imageId } = await params;
    await deleteRentalImage({ user, itemId: id, imageId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof RentalImageError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("Failed to delete rental image", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to delete rental image" },
      { status: 500 },
    );
  }
}
