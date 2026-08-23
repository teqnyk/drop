import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The product file (PRD §12).
 *
 * Cloudflare R2 through a **binding**, not the S3 API. `next dev` gets the
 * same binding via initOpenNextCloudflareForDev, so local development and the
 * deploy exercise one code path rather than two that drift.
 *
 * The bucket is private and the key is never exposed. An entitlement token is
 * the only way to reach a byte of it — no public bucket, no signed URL with a
 * guessable key, nothing a buyer could iterate.
 *
 * Only the three R2 methods Drop uses are declared. `wrangler types` writes
 * 15,000 lines of runtime declarations; this is the part that matters, and
 * naming it keeps a fresh clone type-checking with nothing generated.
 */
type StoredObject = {
  body: ReadableStream;
  size: number;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
};

type ProductBucket = {
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<{ size: number } | null>;
  put(
    key: string,
    value: ArrayBuffer | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
};

/**
 * Why a download could not be served.
 *
 * A union rather than `null`, because the two cases need different words and
 * different status codes. "The bucket is not bound" is the operator's problem
 * and permanent until they fix it; "the object is missing" means the release
 * was published without its file. Collapsing them into one empty response is
 * precisely the plausible-looking success this application argues against.
 */
export type AssetFailure =
  | { reason: "not_configured"; detail: string }
  | { reason: "missing"; detail: string };

export type AssetResult =
  | { ok: true; body: ReadableStream; size: number; contentType: string }
  | ({ ok: false } & AssetFailure);

/** The binding, or null when it is absent (local dev before `pnpm asset:seed`). */
async function productBucket(): Promise<ProductBucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    // CloudflareEnv is only populated by the generated types, which this repo
    // deliberately does not carry. The shape is asserted by wrangler.jsonc.
    const bucket = (env as unknown as Record<string, unknown>).PRODUCT_FILES;
    return bucket ? (bucket as ProductBucket) : null;
  } catch (error) {
    // Outside a Worker request (a plain node script, a unit test) there is no
    // context at all. That is a legitimate absence, not a fault — but it must
    // not read as "the object is missing", which is a different diagnosis.
    void error;
    return null;
  }
}

export async function getProductAsset(key: string): Promise<AssetResult> {
  const bucket = await productBucket();
  if (!bucket) {
    return {
      ok: false,
      reason: "not_configured",
      detail:
        "The PRODUCT_FILES R2 binding is not available. Check r2_buckets in " +
        "wrangler.jsonc, and run `pnpm asset:seed` for local development.",
    };
  }

  const object = await bucket.get(key);
  if (!object) {
    return {
      ok: false,
      reason: "missing",
      detail: `No object at key "${key}" in the product bucket.`,
    };
  }

  return {
    ok: true,
    body: object.body,
    size: object.size,
    contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
  };
}

/**
 * Whether a release's file is actually there.
 *
 * Used by the dashboard, so a creator finds out that a published release has
 * no file from their own screen rather than from the first buyer's email.
 */
export async function productAssetPresent(key: string): Promise<boolean> {
  const bucket = await productBucket();
  if (!bucket) return false;
  return (await bucket.head(key)) !== null;
}
