import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import {
  assertRentalItemImageAccess,
  listRentalImages,
  RentalImageError,
  reorderRentalImages,
  uploadRentalImage,
} from "@/lib/rental/images";
import { ObjectStorageError } from "@/lib/storage/s3";

function imageErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof RentalImageError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status },
    );
  }
  if (error instanceof ObjectStorageError) {
    return NextResponse.json(
      { ok: false, code: "STORAGE_UNAVAILABLE", message: "Image storage is unavailable" },
      { status: 503 },
    );
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const images = await listRentalImages(id);
    return NextResponse.json({ ok: true, images });
  } catch (error) {
    const imageResponse = imageErrorResponse(error);
    if (imageResponse) return imageResponse;
    console.error("Failed to list rental images", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to load rental images" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    await assertRentalItemImageAccess(user, id);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, code: "INVALID_MULTIPART", message: "Upload must be multipart/form-data" },
        { status: 400 },
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, code: "IMAGE_REQUIRED", message: "An image file is required" },
        { status: 400 },
      );
    }

    const image = await uploadRentalImage({
      user,
      itemId: id,
      file,
      altText: form.get("altText"),
    });
    return NextResponse.json({ ok: true, image }, { status: 201 });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const imageResponse = imageErrorResponse(error);
    if (imageResponse) return imageResponse;
    console.error("Failed to upload rental image", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to upload rental image" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const orderedImageIds =
      body && typeof body === "object" && Array.isArray((body as { orderedImageIds?: unknown }).orderedImageIds)
        ? (body as { orderedImageIds: unknown[] }).orderedImageIds.filter(
            (value): value is string => typeof value === "string" && value.length > 0,
          )
        : [];

    const images = await reorderRentalImages({ user, itemId: id, orderedImageIds });
    return NextResponse.json({ ok: true, images });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const imageResponse = imageErrorResponse(error);
    if (imageResponse) return imageResponse;
    console.error("Failed to reorder rental images", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to reorder rental images" },
      { status: 500 },
    );
  }
}
