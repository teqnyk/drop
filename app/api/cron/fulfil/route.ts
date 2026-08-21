import { NextResponse } from "next/server";
import { configured } from "@/lib/env";
import { runFulfilment } from "@/lib/fulfilment";

export const dynamic = "force-dynamic";

/**
 * Work the delivery queue.
 *
 * Called on a schedule in a deployed environment and by hand in development.
 * Reports what it did rather than answering a bare 200 — a sweep that says
 * nothing is indistinguishable from one that never ran, which is the class of
 * silence this application exists to argue against.
 */
export async function GET() {
  if (!configured.mongo()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const result = await runFulfilment();
  return NextResponse.json({ ok: true, ...result });
}
