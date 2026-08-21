"use client";

import { useTransition } from "react";
import { resendDelivery, setReleaseStatus } from "./actions";
import type { ReleaseStatus } from "@/lib/types";

export function ReleaseControls({ slug, status }: { slug: string; status: ReleaseStatus }) {
  const [pending, start] = useTransition();
  const live = status === "live";

  return (
    <div className="controls">
      <span className="muted small">Release is <strong>{status}</strong></span>
      <div className="controls-buttons">
        <button
          className="btn btn-small btn-ghost"
          disabled={pending}
          onClick={() => start(() => void setReleaseStatus(slug, live ? "paused" : "live"))}
        >
          {live ? "Pause sales" : "Resume sales"}
        </button>
        <button
          className="btn btn-small btn-ghost"
          disabled={pending || status === "sold_out"}
          onClick={() => start(() => void setReleaseStatus(slug, "sold_out"))}
        >
          Mark sold out
        </button>
      </div>
    </div>
  );
}

export function ResendButton({ purchaseId }: { purchaseId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-small btn-ghost"
      style={{ marginTop: 8 }}
      disabled={pending}
      onClick={() => start(() => void resendDelivery(purchaseId))}
    >
      {pending ? "Resending…" : "Resend"}
    </button>
  );
}
