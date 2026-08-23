import { crc32 } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalCatalogue } from "../lib/fixture";

/**
 * Build the product file customers download.
 *
 * Written by hand rather than shelled out to `zip`, for one reason: the output
 * must be byte-identical on every run. `zip` stamps the current time into each
 * entry, so re-seeding would upload a "new" file every time and any checksum a
 * runbook quotes would be wrong by the time someone read it.
 *
 * STORE (no compression). Three small text files do not need deflate, and the
 * uncompressed format is short enough to read, which matters more here — the
 * point of this repository is that you can see how everything works.
 */

const ZIP_VERSION = 20; // 2.0 — the floor for STORE with a data descriptor
const DOS_TIME = 0; // fixed, not "now" — see the note above
// DOS date: bits 15-9 year-1980, 8-5 month (1-12), 4-0 day (1-31).
// 1 Jan 1980 is (0 << 9) | (1 << 5) | 1. Writing 0x2100 instead — the same
// bytes the other way round — renders as month 0 of 1996 in every unzip tool.
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

type Entry = { name: string; body: Buffer };

function localHeader(entry: Entry): Buffer {
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04_03_4b_50, 0); // local file header signature
  head.writeUInt16LE(ZIP_VERSION, 4);
  head.writeUInt16LE(0, 6); // flags
  head.writeUInt16LE(0, 8); // method: STORE
  head.writeUInt16LE(DOS_TIME, 10);
  head.writeUInt16LE(DOS_DATE, 12);
  head.writeUInt32LE(crc32(entry.body), 14);
  head.writeUInt32LE(entry.body.length, 18); // compressed
  head.writeUInt32LE(entry.body.length, 22); // uncompressed
  head.writeUInt16LE(Buffer.byteLength(entry.name), 26);
  head.writeUInt16LE(0, 28); // extra field length
  return Buffer.concat([head, Buffer.from(entry.name, "utf8"), entry.body]);
}

function centralHeader(entry: Entry, offset: number): Buffer {
  const head = Buffer.alloc(46);
  head.writeUInt32LE(0x02_01_4b_50, 0); // central directory signature
  head.writeUInt16LE(ZIP_VERSION, 4); // version made by
  head.writeUInt16LE(ZIP_VERSION, 6); // version needed
  head.writeUInt16LE(0, 8);
  head.writeUInt16LE(0, 10);
  head.writeUInt16LE(DOS_TIME, 12);
  head.writeUInt16LE(DOS_DATE, 14);
  head.writeUInt32LE(crc32(entry.body), 16);
  head.writeUInt32LE(entry.body.length, 20);
  head.writeUInt32LE(entry.body.length, 24);
  head.writeUInt16LE(Buffer.byteLength(entry.name), 28);
  head.writeUInt16LE(0, 30); // extra
  head.writeUInt16LE(0, 32); // comment
  head.writeUInt16LE(0, 34); // disk number
  head.writeUInt16LE(0, 36); // internal attributes
  head.writeUInt32LE(0, 38); // external attributes
  head.writeUInt32LE(offset, 42);
  return Buffer.concat([head, Buffer.from(entry.name, "utf8")]);
}

export function buildZip(entries: Entry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const local = localHeader(entry);
    centrals.push(centralHeader(entry, offset));
    locals.push(local);
    offset += local.length;
  }

  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06_05_4b_50, 0); // end of central directory
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, central, end]);
}

/** One icon, drawn rather than lorem — the fixture claims real work. */
function icon(name: string, path: string): Entry {
  return {
    name: `icons/svg/${name}.svg`,
    body: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ` +
        `fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ` +
        `stroke-linejoin="round">\n  ${path}\n</svg>\n`,
      "utf8",
    ),
  };
}

export function productEntries(slug: string): Entry[] {
  const release = canonicalCatalogue().find((r) => r.slug === slug);
  if (!release) throw new Error(`Unknown release: ${slug}`);

  const readme =
    `${release.title}\n` +
    `${"=".repeat(release.title.length)}\n\n` +
    `${release.description}\n\n` +
    `Contents\n--------\n${release.contents.map((c) => `  - ${c}`).join("\n")}\n\n` +
    `In this sample\n--------------\n` +
    `  - 5 of the icons, as SVG, under icons/svg/\n` +
    `  - this file\n\n` +
    `Licence\n-------\n${release.licence}\n\n` +
    `By ${release.creator_name}, ${release.studio_name}.\n\n` +
    `---\n\n` +
    `This is the sample file from Drop, a demonstration store. Nothing was\n` +
    `bought and nothing was charged. The "Contents" above are what the\n` +
    `storefront advertises; what you actually have is listed under "In this\n` +
    `sample", and the two are different on purpose rather than by accident.\n\n` +
    `It is a real download — streamed from a private bucket through a hashed\n` +
    `entitlement token, not a placeholder. An application about operational\n` +
    `honesty should not hand you an empty file and call it delivered.\n`;

  return [
    { name: "README.txt", body: Buffer.from(readme, "utf8") },
    icon("archive", '<path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/><path d="M2 4h20v4H2z"/><path d="M10 12h4"/>'),
    icon("bell", '<path d="M18 9a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
    icon("check", '<path d="m4 12 5 5L20 6"/>'),
    icon("cursor", '<path d="m4 3 7 17 2.5-6.5L20 11 4 3Z"/>'),
    icon("layers", '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>'),
  ];
}

async function main() {
  // Every release gets a file. A catalogue where three of four downloads fail
  // would demonstrate the error path very well and the happy path not at all.
  for (const release of canonicalCatalogue()) {
    const key = release.product_asset_key;
    const out = `.assets/${key}`;
    const zip = buildZip(productEntries(release.slug));
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, zip);
    console.log(`${out} — ${zip.length} bytes`);
  }
  console.log("Upload with:  pnpm asset:seed  (local)  /  pnpm asset:push  (remote)");
}

if (process.argv[1]?.endsWith("build-asset.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
