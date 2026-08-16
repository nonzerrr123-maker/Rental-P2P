import { createHash, createHmac } from "node:crypto";

const DEFAULT_REGION = "auto";
const DEFAULT_TIMEOUT_MS = 15_000;

export type ObjectStorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
  timeoutMs: number;
};

export class ObjectStorageError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code: "NOT_CONFIGURED" | "REQUEST_FAILED" = "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "ObjectStorageError";
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanValue(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function getObjectStorageConfig(): ObjectStorageConfig | null {
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT?.trim();
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.OBJECT_STORAGE_BUCKET?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;

  return {
    endpoint: endpoint.replace(/\/$/, ""),
    region: process.env.OBJECT_STORAGE_REGION?.trim() || DEFAULT_REGION,
    accessKeyId,
    secretAccessKey,
    bucket,
    forcePathStyle: booleanValue(process.env.OBJECT_STORAGE_FORCE_PATH_STYLE, true),
    timeoutMs: positiveInteger(process.env.OBJECT_STORAGE_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

function requireConfig(): ObjectStorageConfig {
  const config = getObjectStorageConfig();
  if (!config) {
    throw new ObjectStorageError(
      "Object storage is not configured",
      503,
      "NOT_CONFIGURED",
    );
  }
  return config;
}

function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function signingKey(secret: string, dateStamp: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secret}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeKey(key: string): string {
  return key.split("/").map(awsEncode).join("/");
}

function amzDate(now: Date): { timestamp: string; dateStamp: string } {
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { timestamp, dateStamp: timestamp.slice(0, 8) };
}

function objectUrl(config: ObjectStorageConfig, key: string): URL {
  const base = new URL(config.endpoint);
  const encodedKey = encodeKey(key);

  if (config.forcePathStyle) {
    const prefix = base.pathname === "/" ? "" : base.pathname.replace(/\/$/, "");
    base.pathname = `${prefix}/${awsEncode(config.bucket)}/${encodedKey}`;
    return base;
  }

  base.hostname = `${config.bucket}.${base.hostname}`;
  const prefix = base.pathname === "/" ? "" : base.pathname.replace(/\/$/, "");
  base.pathname = `${prefix}/${encodedKey}`;
  return base;
}

async function signedObjectRequest(input: {
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  key: string;
  body?: Uint8Array;
  contentType?: string;
}): Promise<Response> {
  const config = requireConfig();
  const url = objectUrl(config, input.key);
  const body = input.body ?? new Uint8Array();
  const payloadHash = sha256Hex(body);
  const { timestamp, dateStamp } = amzDate(new Date());
  const host = url.host;

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    input.method,
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretAccessKey, dateStamp, config.region))
    .update(stringToSign)
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: input.method,
      headers: {
        Authorization: authorization,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": timestamp,
        ...(input.contentType ? { "Content-Type": input.contentType } : {}),
      },
      body: input.method === "PUT" ? Buffer.from(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    throw new ObjectStorageError(
      error instanceof Error ? `Object storage request failed: ${error.message}` : "Object storage request failed",
    );
  }

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 1000);
    throw new ObjectStorageError(
      `Object storage ${input.method} failed with HTTP ${response.status}${errorText ? `: ${errorText}` : ""}`,
      response.status,
    );
  }

  return response;
}

export async function putObject(input: {
  key: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<void> {
  await signedObjectRequest({
    method: "PUT",
    key: input.key,
    body: input.bytes,
    contentType: input.contentType,
  });
}

export async function getObject(key: string): Promise<Response> {
  return signedObjectRequest({ method: "GET", key });
}

export async function headObject(key: string): Promise<Response> {
  return signedObjectRequest({ method: "HEAD", key });
}

export async function deleteObject(key: string): Promise<void> {
  await signedObjectRequest({ method: "DELETE", key });
}
