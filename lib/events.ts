import { storefrontEvents } from "./db";
import type { StorefrontEvent, StorefrontEventType } from "./types";

/**
 * Record a storefront event.
 *
 * **Never blocks, never throws.** PRD §15: an analytics write that can fail the
 * checkout it is measuring is a worse bug than the missing datapoint. So this
 * swallows its own failure — but says so in the log rather than vanishing,
 * because "we stopped recording events" is itself something worth noticing.
 */
export async function recordEvent(input: {
  type: StorefrontEventType;
  releaseSlug: string;
  purchaseId?: string | null;
  referrer?: string | null;
  device?: string | null;
  checkout?: { latency_ms?: number; failure_reason?: string } | null;
  isDemo?: boolean;
}): Promise<void> {
  const doc: StorefrontEvent = {
    purchase_id: input.purchaseId ?? null,
    release_slug: input.releaseSlug,
    type: input.type,
    occurred_at: new Date(),
    referrer: input.referrer ?? null,
    device: input.device ? { kind: input.device } : null,
    checkout: input.checkout ?? null,
    is_demo: input.isDemo ?? false,
  };

  try {
    const col = await storefrontEvents();
    await col.insertOne(doc);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[events] failed to record ${input.type}: ${reason}`);
  }
}

/** Coarse device class from a user agent. No fingerprinting, no storage of the UA. */
export function deviceKind(userAgent: string | null): string {
  if (!userAgent) return "unknown";
  return /mobile|android|iphone/i.test(userAgent) ? "mobile" : "desktop";
}

/** Referrer host only — never the full URL, which can carry a query string. */
export function referrerHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname;
  } catch {
    return null;
  }
}
