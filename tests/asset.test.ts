import { describe, expect, it } from "vitest";
import { crc32 } from "node:zlib";
import { buildZip, productEntries } from "../scripts/build-asset";

const FIXTURE_SLUG = "form-01";
import { CATALOGUE, canonicalCatalogue, canonicalRelease } from "../lib/fixture";

/**
 * The product file.
 *
 * A corrupt zip is the download equivalent of an empty one: the customer gets
 * bytes, the server records a success, and nobody finds out until someone
 * tries to open it. So these assert the archive is actually readable, not just
 * that it was produced.
 */

function readEndOfCentralDirectory(zip: Buffer) {
  const at = zip.length - 22;
  return {
    signature: zip.readUInt32LE(at),
    entries: zip.readUInt16LE(at + 10),
    centralSize: zip.readUInt32LE(at + 12),
    centralOffset: zip.readUInt32LE(at + 16),
  };
}

describe("the product archive", () => {
  it("is a zip a reader can find its way into", () => {
    const zip = buildZip(productEntries(FIXTURE_SLUG));
    expect(zip.readUInt32LE(0)).toBe(0x04_03_4b_50); // local file header
    const end = readEndOfCentralDirectory(zip);
    expect(end.signature).toBe(0x06_05_4b_50);
    expect(end.entries).toBe(productEntries(FIXTURE_SLUG).length);
    // The directory must actually sit where the trailer says it does, or every
    // unzip tool reports a corrupt archive.
    expect(zip.readUInt32LE(end.centralOffset)).toBe(0x02_01_4b_50);
    expect(end.centralOffset + end.centralSize + 22).toBe(zip.length);
  });

  it("records a CRC that matches the bytes it stored", () => {
    const [first] = productEntries(FIXTURE_SLUG);
    const zip = buildZip([first]);
    const nameLength = zip.readUInt16LE(26);
    const body = zip.subarray(30 + nameLength, 30 + nameLength + first.body.length);
    // A wrong CRC is the failure that looks fine until extraction. Assert the
    // stored checksum against the stored bytes, not against the input.
    expect(zip.readUInt32LE(14)).toBe(crc32(body));
    expect(body.equals(first.body)).toBe(true);
  });

  it("is byte-identical on every build", () => {
    // Re-seeding must be a no-op. `zip` stamps the current time into each
    // entry, which would make every upload a new file and every checksum in a
    // runbook wrong by the time someone read it.
    expect(buildZip(productEntries(FIXTURE_SLUG)).equals(buildZip(productEntries(FIXTURE_SLUG)))).toBe(true);
  });

  it("carries a valid DOS date rather than a byte-swapped one", () => {
    const zip = buildZip(productEntries(FIXTURE_SLUG));
    const date = zip.readUInt16LE(12);
    const month = (date >> 5) & 0b1111;
    const day = date & 0b11111;
    // 0x2100 — the same bytes reversed — gives month 0, which every unzip tool
    // renders as an impossible date.
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
  });

  it("does not claim the sample holds everything the storefront advertises", () => {
    const readme = productEntries(FIXTURE_SLUG).find((e) => e.name === "README.txt");
    const text = readme!.body.toString("utf8");
    const icons = productEntries(FIXTURE_SLUG).filter((e) => e.name.startsWith("icons/")).length;
    // The storefront sells 240 icons; the sample has five. Saying so inside
    // the file is the difference between a demo and a small lie.
    expect(text).toContain("In this sample");
    expect(text).toContain(`${icons} of the icons`);
    expect(canonicalRelease().contents.some((c) => c.includes("240"))).toBe(true);
  });
});

describe("the keys the downloads are served under", () => {
  it("gives every release in the catalogue its own file", () => {
    const keys = canonicalCatalogue().map((r) => r.product_asset_key);
    // A catalogue where three of four downloads fail would demonstrate the
    // error path beautifully and the happy path not at all.
    expect(keys).toHaveLength(CATALOGUE.length);
    expect(new Set(keys).size).toBe(keys.length);
    for (const release of canonicalCatalogue()) {
      expect(() => productEntries(release.slug)).not.toThrow();
    }
  });

  it("is uploaded from the catalogue, never from a literal in package.json", async () => {
    const { readFileSync } = await import("node:fs");
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const uploader = readFileSync("scripts/upload-assets.ts", "utf8");

    // The keys used to be typed into package.json, where a fixture change
    // would leave `asset:seed` filling a bucket nothing reads and reporting
    // success. The uploader must derive them.
    for (const script of ["asset:seed", "asset:push"]) {
      expect(pkg.scripts[script]).toContain("upload-assets");
      expect(pkg.scripts[script]).not.toContain(".zip");
    }
    expect(uploader).toContain("canonicalCatalogue()");
  });

  it("refuses a release that does not exist rather than building an empty zip", () => {
    expect(() => productEntries("no-such-release")).toThrow(/Unknown release/);
  });
});
