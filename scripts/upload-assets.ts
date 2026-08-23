/**
 * Put every release's product file in the bucket.
 *
 *   pnpm asset:seed    local (miniflare state that `next dev` reads)
 *   pnpm asset:push    the real bucket
 *
 * Derived from the catalogue rather than naming keys literally. The keys used
 * to live in package.json, where a fixture change would leave them pointing at
 * a bucket nothing reads — the failure being that `asset:seed` reports success
 * having filled the wrong drawer.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import { canonicalCatalogue } from "../lib/fixture";

const run = promisify(execFile);

const BUCKET = "drop-product-files";

async function main() {
  const remote = process.argv.includes("--remote");
  const scope = remote ? "--remote" : "--local";

  for (const release of canonicalCatalogue()) {
    const file = `.assets/${release.product_asset_key}`;
    try {
      await access(file);
    } catch {
      throw new Error(`${file} is missing. Run \`pnpm asset:build\` first.`);
    }

    const { stdout, stderr } = await run("npx", [
      "wrangler", "r2", "object", "put",
      `${BUCKET}/${release.product_asset_key}`,
      "--file", file,
      "--content-type", "application/zip",
      scope,
    ]);
    // Wrangler's own words, not "done" — an upload that half-worked should not
    // read the same as one that worked.
    const said = `${stdout}${stderr}`.includes("Upload complete");
    if (!said) {
      throw new Error(
        `wrangler did not confirm the upload of ${release.product_asset_key}:\n${stdout}${stderr}`,
      );
    }
    console.log(`${scope}  ${BUCKET}/${release.product_asset_key}`);
  }
  console.log(`${canonicalCatalogue().length} files uploaded.`);
}

main().catch((error) => {
  console.error("Upload failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
