import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SIGNATURE_TOLERANCE_SECONDS, verifyWebhook } from "@/lib/stripe";

/**
 * Webhook signature verification.
 *
 * The load-bearing security check in Drop. PRD §8: a browser redirect is not
 * proof of payment — anyone can visit the success URL. Only a correctly signed
 * webhook means Stripe took money, so every way of getting this wrong is a way
 * to mint free orders.
 *
 * Needs no Stripe account: the scheme is an HMAC, so a valid signature can be
 * produced here and every negative case exercised exactly.
 */
const SECRET = "whsec_test_secret_value";
const BODY = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });

function sign(body: string, secret: string, timestamp: number): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

describe("verifyWebhook", () => {
  const now = 1_700_000_000;

  it("accepts a correctly signed payload", () => {
    const result = verifyWebhook(BODY, sign(BODY, SECRET, now), SECRET, now);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.type).toBe("checkout.session.completed");
  });

  it("refuses a request with no signature header", () => {
    // The naive handler that reads req.body and trusts it lives here.
    const result = verifyWebhook(BODY, null, SECRET, now);
    expect(result).toEqual({ ok: false, reason: "no stripe-signature header" });
  });

  it("refuses a signature made with the wrong secret", () => {
    // The commonest real failure: the CLI's whsec_ used against the dashboard
    // endpoint's, or vice versa. Same prefix, different value.
    const result = verifyWebhook(BODY, sign(BODY, "whsec_a_different_secret", now), SECRET, now);
    expect(result.ok).toBe(false);
  });

  it("refuses a payload modified after signing", () => {
    const header = sign(BODY, SECRET, now);
    const tampered = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { amount_total: 1 } },
    });

    const result = verifyWebhook(tampered, header, SECRET, now);

    expect(result.ok).toBe(false);
  });

  it("refuses a replay from outside the tolerance window", () => {
    const stale = now - SIGNATURE_TOLERANCE_SECONDS - 1;
    const result = verifyWebhook(BODY, sign(BODY, SECRET, stale), SECRET, now);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/tolerance/);
  });

  it("accepts one at the edge of the window", () => {
    const edge = now - SIGNATURE_TOLERANCE_SECONDS;
    expect(verifyWebhook(BODY, sign(BODY, SECRET, edge), SECRET, now).ok).toBe(true);
  });

  it("refuses a malformed header rather than throwing", () => {
    // A 500 here would be reported to Stripe as a failure and retried forever.
    expect(verifyWebhook(BODY, "garbage", SECRET, now)).toEqual({
      ok: false,
      reason: "malformed stripe-signature",
    });
  });

  it("refuses a correctly signed body that is not JSON", () => {
    const body = "not json";
    const result = verifyWebhook(body, sign(body, SECRET, now), SECRET, now);

    expect(result).toEqual({ ok: false, reason: "signed body was not JSON" });
  });
});
