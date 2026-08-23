/**
 * Put every release's product file in the bucket.
 *
 *   pnpm asset:push
 *
 * Derived from the catalogue rather than naming keys literally: the keys used
 * to live in package.json, where a fixture change would leave them pointing at
 * a bucket nothing reads — the failure being that the upload reports success
 * having filled the wrong drawer.
 *
 * Uses lib/storage, so uploading and serving go through one code path. A
 * separate uploader is free to diverge from the reader, and the divergence is
 * only discovered by a customer.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile, access } from "node:fs/promises";
import { canonicalCatalogue } from "../lib/fixture";
import { putProductAsset, productAssetPresent } from "../lib/storage";

async function main() {
  const catalogue = canonicalCatalogue();

  for (const release of catalogue) {
    const key = release.product_asset_key;
    const file = `.assets/${key}`;
    try {
      await access(file);
    } catch {
      throw new Error(`${file} is missing. Run \`pnpm asset:build\` first.`);
    }

    await putProductAsset(key, await readFile(file), "application/zip");

    // Read it back. An upload that reports success and stored nothing is the
    // failure this application exists to argue against, and the check costs
    // one HEAD request.
    const present = await productAssetPresent(key);
    if (!present.ok) {
      throw new Error(`Uploaded ${key} but it is not readable back: ${present.detail}`);
    }
    console.log(`${key.padEnd(16)} ${present.size} bytes`);
  }

  console.log(`${catalogue.length} files uploaded and verified.`);
}

main().catch((error) => {
  console.error("Upload failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
