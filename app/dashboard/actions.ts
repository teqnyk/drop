"use server";

import { revalidatePath } from "next/cache";
import { releases } from "@/lib/db";
import { requeueDelivery, runFulfilment } from "@/lib/fulfilment";
import { requireCreator } from "@/lib/auth";
import type { ReleaseStatus } from "@/lib/types";

/**
 * Release controls (PRD §8) and the manual delivery escape hatch.
 *
 * Server actions rather than API routes: these are dashboard buttons, not an
 * integration surface, and there is no second consumer to justify the contract.
 *
 * Every one of them calls requireCreator() first. A server action is a POST
 * endpoint with a discoverable id, so gating the page that draws the buttons
 * is not gating the buttons — the page check is a redirect for humans, this is
 * the boundary.
 */
export async function setReleaseStatus(slug: string, status: ReleaseStatus) {
  await requireCreator();
  const col = await releases();

  if (status === "live") {
    // Reopening must not resurrect a sold-out release with no stock. Guarded so
    // "resume" on an empty edition stays sold out rather than promising copies
    // that do not exist.
    await col.updateOne(
      { slug, quantity_remaining: { $gt: 0 } },
      { $set: { status: "live" } },
    );
  } else {
    await col.updateOne({ slug }, { $set: { status } });
  }

  revalidatePath("/dashboard");
  revalidatePath("/");
}

/**
 * Resend a confirmation.
 *
 * Requeues and works the queue immediately, so the button's effect is visible
 * on the next render rather than at some later sweep. A creator pressing
 * "resend" and seeing nothing change assumes it did not work.
 */
export async function resendDelivery(purchaseId: string) {
  await requireCreator();
  await requeueDelivery(purchaseId);
  await runFulfilment();
  revalidatePath("/dashboard");
}
