import { NextResponse, type NextRequest } from "next/server";
import { configured, env } from "@/lib/env";
import { runFulfilment } from "@/lib/fulfilment";

export const dynamic = "force-dynamic";

/**
 * Work the delivery queue.
 *
 * Called on a schedule in a deployed environment and by hand in development.
 * Reports what it did rather than answering a bare 200 — a sweep that says
 * nothing is indistinguishable from one that never ran, which is the class of
 * silence this application exists to argue against.
 *
 * Guarded, because retries are a finite resource. Each call consumes an
 * attempt against jobs that are due, so an open endpoint lets anyone drive
 * every pending delivery to `exhausted` in four requests — the queue would
 * report itself as having tried hard and given up, which is worse than an
 * endpoint that simply refuses.
 *
 * Unset ⇒ refuses, like /demo. The pattern in this codebase is that a missing
 * secret closes a door rather than removing it.
 */
export async function GET(request: NextRequest) {
  const secret = env.cronSecret();
  const offered = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || offered !== secret) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (!configured.mongo()) {
    return NextResponse.json({ error: "MONGODB_URI is not set" }, { status: 503 });
  }

  const result = await runFulfilment();
  return NextResponse.json({ ok: true, ...result });
}
