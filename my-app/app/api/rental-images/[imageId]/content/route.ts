import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";
import { loadRentalImageContent, RentalImageError } from "@/lib/rental/images";

const DEMO_IMAGE_PREFIX = "demo-url:";
const DEMO_IMAGE_HOSTS = new Set(["loremflickr.com", "www.loremflickr.com"]);
const DEMO_IMAGE_TIMEOUT_MS = 8_000;

type DemoImageRow = QueryResultRow & {
  storage_key: string;
};

type ImageContent = {
  response: Response;
  contentType: string;
};

function imageResponse({ response, contentType }: ImageContent) {
  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function loadDemoImageContent(imageId: string): Promise<ImageContent | null> {
  const result = await query<DemoImageRow>(
    `SELECT storage_key
     FROM rental_images
     WHERE id = $1
       AND storage_key LIKE 'demo-url:%'
     LIMIT 1`,
    [imageId],
  );
  const storageKey = result.rows[0]?.storage_key;
  if (!storageKey) return null;

  const rawUrl = storageKey.slice(DEMO_IMAGE_PREFIX.length);
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !DEMO_IMAGE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Demo image URL is not allowlisted");
  }

  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(DEMO_IMAGE_TIMEOUT_MS),
    headers: {
      "User-Agent": "BorowBorow-Demo-Image-Proxy/1.0",
      Accept: "image/jpeg,image/png,image/webp",
    },
  });
  if (!response.ok) {
    throw new Error(`Demo image upstream returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    throw new Error(`Demo image upstream returned unsupported content type: ${contentType || "unknown"}`);
  }

  return { response, contentType };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  try {
    const { imageId } = await params;
    const demoImage = await loadDemoImageContent(imageId);
    if (demoImage) return imageResponse(demoImage);

    return imageResponse(await loadRentalImageContent(imageId));
  } catch (error) {
    if (error instanceof RentalImageError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("Failed to serve rental image", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to load rental image" },
      { status: 500 },
    );
  }
}
