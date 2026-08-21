/**
 * The storefront.
 *
 * Phase 0 renders the canonical fixture statically so the scaffold is provably
 * deployable before MongoDB exists. Phase 1 replaces this with a read from the
 * `releases` collection — the PRD is explicit that the product page must render
 * from the database and not from a constant, because a hardcoded storefront
 * cannot demonstrate a database outage.
 */
export default function StorefrontPage() {
  return (
    <main className="wrap" style={{ paddingTop: 64, paddingBottom: 96 }}>
      <p className="eyebrow">soft theory</p>
      <h1 style={{ marginTop: 12, maxWidth: "14ch" }}>Form/01</h1>
      <p className="muted" style={{ marginTop: 16, maxWidth: "52ch", fontSize: 18 }}>
        Carefully drawn interface icons for independent software products. SVG
        and a Figma library, licensed for personal and commercial work.
      </p>

      <p className="muted" style={{ marginTop: 40, fontSize: 14 }}>
        Scaffold only — the storefront, checkout and inventory arrive in phase 1.
        See <code>DROP-BUILD-PLAN.md</code>.
      </p>
    </main>
  );
}
