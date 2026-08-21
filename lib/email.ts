import { configured, env } from "./env";
import { activeScenario } from "./scenarios";

/**
 * Confirmation email, through Resend.
 *
 * Returns an outcome rather than throwing. PRD §17: payment success must
 * survive a downstream email failure — the customer has paid, the download
 * works, and the only thing wrong is that a message did not arrive. Throwing
 * here would fail the webhook, and Stripe would retry a payment that already
 * succeeded.
 */
export type SendResult =
  | { sent: true; providerId: string | null }
  | { sent: false; reason: string };

export async function sendConfirmation(input: {
  to: string;
  releaseTitle: string;
  downloadUrl: string;
}): Promise<SendResult> {
  // The scenario fails the SEND, not the order — that is the whole point of the
  // demonstration: a broken email path that leaves a working purchase behind.
  if (await activeScenario("email_failure")) {
    return { sent: false, reason: "Demo scenario: email provider rejected the message." };
  }

  if (!configured.resend()) {
    // Unconfigured is not failure, and must not be reported as one. A local
    // environment without Resend should say "skipped", or every demo run looks
    // like a broken alert path.
    return { sent: false, reason: "skipped: RESEND_API_KEY is not set" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.resendFrom(),
        to: [input.to],
        subject: `Your download — ${input.releaseTitle}`,
        text: [
          `Thanks for buying ${input.releaseTitle}.`,
          "",
          `Download it here: ${input.downloadUrl}`,
          "",
          "The link works for 30 days. If it expires, reply to this email.",
          "",
          "— Soft Theory",
          "",
          "This is a demonstration store. No payment was taken.",
        ].join("\n"),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().then((t) => t.slice(0, 300)).catch(() => "");
      return { sent: false, reason: `Resend ${res.status}: ${detail}` };
    }

    const body = (await res.json().catch(() => ({}))) as { id?: string };
    // Accepted, NOT delivered. Resend has taken the message; whether a mailbox
    // ever sees it is a different fact, and the dashboard must not conflate them.
    return { sent: true, providerId: body.id ?? null };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
