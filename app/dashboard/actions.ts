"use server";

import { revalidatePath } from "next/cache";
import { orders, releases } from "@/lib/db";
import { requeueDelivery, runFulfilment } from "@/lib/fulfilment";
import { assertOwns, requireCreator } from "@/lib/auth";
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
  const creator = await requireCreator();
  const col = await releases();

  // Ownership, not just authentication. `slug` arrives from the client and a
  // creator posting a neighbour's slug must not be able to pause their shop.
  assertOwns(creator, await col.findOne({ slug }));

  if (status === "live") {
    // Reopening must not resurrect a sold-out release with no stock. Guarded so
    // "resume" on an empty edition stays sold out rather than promising copies
    // that do not exist.
    await col.updateOne(
      { slug, studio_slug: creator.studioSlug, quantity_remaining: { $gt: 0 } },
      { $set: { status: "live" } },
    );
  } else {
    await col.updateOne({ slug, studio_slug: creator.studioSlug }, { $set: { status } });
  }

  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath(`/studios/${creator.studioSlug}`);
  revalidatePath(`/releases/${slug}`);
}

/**
 * Resend a confirmation.
 *
 * Requeues and works the queue immediately, so the button's effect is visible
 * on the next render rather than at some later sweep. A creator pressing
 * "resend" and seeing nothing change assumes it did not work.
 */
export async function resendDelivery(purchaseId: string) {
  const creator = await requireCreator();

  // An order names a release; the release names a studio. Resending somebody
  // else's confirmation would hand a neighbour's customer a fresh download
  // link for a product this creator does not sell.
  const order = await (await orders()).findOne({ purchase_id: purchaseId });
  assertOwns(creator, order ? await (await releases()).findOne({ slug: order.release_slug }) : null);

  await requeueDelivery(purchaseId);
  await runFulfilment();
  revalidatePath("/dashboard");
}
