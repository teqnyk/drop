import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { env } from "./env";

/**
 * The product file (PRD §12).
 *
 * Cloudflare R2 over its S3-compatible API.
 *
 * This used to be an R2 *binding*, which was the better design and only works
 * inside a Worker. Drop moved to a Node host because the MongoDB driver cannot
 * survive Workers' isolate reuse (see lib/db.ts), and the binding went with it.
 * The bucket is unchanged; only the way in is different.
 *
 * The bucket stays private. An entitlement token is the only route to a byte of
 * it — no public bucket, no presigned URL handed to a browser, nothing a buyer
 * could iterate.
 */

export type AssetFailure =
  | { reason: "not_configured"; detail: string }
  | { reason: "missing"; detail: string };

export type AssetResult =
  | { ok: true; body: Readable; size: number; contentType: string }
  | ({ ok: false } & AssetFailure);

export type AssetPresence = { ok: true; size: number } | ({ ok: false } & AssetFailure);

let cached: S3Client | null = null;

/** The client, or null when R2 is unconfigured — a real state, not an error. */
function client(): S3Client | null {
  if (cached) return cached;
  const account = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!account || !accessKeyId || !secretAccessKey) return null;

  cached = new S3Client({
    // R2 ignores the region but the SDK insists on one.
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cached;
}

function unconfigured(): AssetFailure {
  return {
    reason: "not_configured",
    detail:
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
      "R2_SECRET_ACCESS_KEY and R2_BUCKET.",
  };
}

/** Distinguishes "no such key" from every other S3 failure. */
function isNotFound(error: unknown): boolean {
  const meta = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata;
  const name = (error as { name?: string })?.name;
  return meta?.httpStatusCode === 404 || name === "NoSuchKey" || name === "NotFound";
}

/** The provider's own words, bounded. Never "an error occurred". */
function describe(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}

export async function getProductAsset(key: string): Promise<AssetResult> {
  const s3 = client();
  if (!s3) return { ok: false, ...unconfigured() };

  try {
    const out = await s3.send(
      new GetObjectCommand({ Bucket: env.r2Bucket(), Key: key }),
    );
    if (!out.Body) {
      // A 200 with no body is not a download. Saying so beats streaming
      // nothing and calling it delivered.
      return {
        ok: false,
        reason: "missing",
        detail: `R2 returned no body for "${key}".`,
      };
    }
    return {
      ok: true,
      body: out.Body as Readable,
      size: out.ContentLength ?? 0,
      contentType: out.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    if (isNotFound(error)) {
      return { ok: false, reason: "missing", detail: `No object at key "${key}".` };
    }
    // NOT reported as "missing": a permissions problem or an outage is the
    // operator's to fix and permanent until they do, and telling a creator to
    // re-upload a file that is already there sends them to the wrong screen.
    return {
      ok: false,
      reason: "not_configured",
      detail: `R2 request failed: ${describe(error)}`,
    };
  }
}

/**
 * Whether a release's file is actually there.
 *
 * Returns the same union rather than a boolean. An earlier version returned
 * false for both "storage is unreachable" and "the object is missing", and the
 * dashboard then reported, confidently, that nothing was stored at a key that
 * had just been uploaded.
 */
export async function productAssetPresent(key: string): Promise<AssetPresence> {
  const s3 = client();
  if (!s3) return { ok: false, ...unconfigured() };

  try {
    const out = await s3.send(
      new HeadObjectCommand({ Bucket: env.r2Bucket(), Key: key }),
    );
    return { ok: true, size: out.ContentLength ?? 0 };
  } catch (error) {
    if (isNotFound(error)) {
      return { ok: false, reason: "missing", detail: `No object at key "${key}".` };
    }
    return {
      ok: false,
      reason: "not_configured",
      detail: `R2 request failed: ${describe(error)}`,
    };
  }
}

/** Used by the upload script, so one code path reaches the bucket. */
export async function putProductAsset(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const s3 = client();
  if (!s3) throw new Error(unconfigured().detail);
  await s3.send(
    new PutObjectCommand({
      Bucket: env.r2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
