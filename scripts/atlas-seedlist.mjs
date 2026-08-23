/**
 * Turn an Atlas `mongodb+srv://` URI into the seedlist form Workers can use.
 *
 *   node scripts/atlas-seedlist.mjs           # reads MONGODB_URI, prints the seedlist
 *   node scripts/atlas-seedlist.mjs --write   # …and rewrites .env.local
 *
 * Cloudflare Workers do not implement `dns.resolveTxt`, so the MongoDB driver
 * cannot expand an SRV connection string there. It fails with
 * "proxy request failed, cannot connect to the specified address", which reads
 * like a network problem and is actually a DNS one.
 *
 * This machine can resolve SRV, so the expansion happens here, once, and the
 * result is what gets deployed.
 */
import { promises as dns } from "node:dns";
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const source = process.env.MONGODB_URI;
if (!source) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

// Checked BEFORE parsing. `new URL()` cannot parse a multi-host mongodb://
// string and throws — and the thrown error carries the whole URI, password
// included, straight to stdout. Guarding first means an already-expanded URI
// exits quietly instead of printing a credential.
if (!source.startsWith("mongodb+srv://")) {
  console.error("MONGODB_URI is already in seedlist form — nothing to expand.");
  process.exit(0);
}

const url = new URL(source);

const host = url.hostname;
const [srv, txt] = await Promise.all([
  dns.resolveSrv(`_mongodb._tcp.${host}`),
  dns.resolveTxt(host),
]);

const seeds = srv.map((s) => `${s.name}:${s.port}`).join(",");
const params = new URLSearchParams(txt.map((t) => t.join("")).join("&"));
params.set("ssl", "true");
params.set("retryWrites", "true");
params.set("w", "majority");

const seedlist = `mongodb://${url.username}:${url.password}@${seeds}/?${params}`;

if (process.argv.includes("--write")) {
  const file = ".env.local";
  const current = readFileSync(file, "utf8");
  writeFileSync(file, current.replace(/^MONGODB_URI=.*$/m, `MONGODB_URI=${seedlist}`));
  console.log(`${file} updated. ${srv.length} seeds, replicaSet=${params.get("replicaSet")}.`);
} else {
  // Printed only when explicitly asked for — it carries the password.
  console.log(seedlist);
}
