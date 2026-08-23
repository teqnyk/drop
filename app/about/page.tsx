import Link from "next/link";

export const metadata = { title: "About — Drop" };

export default function AboutPage() {
  return (
    <main className="wrap prose" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <p className="eyebrow">about</p>
      <h1>Drop</h1>

      <p className="lede">
        A home for independent studios selling limited digital editions — icons,
        type, sound, maps. Small catalogues, fixed quantities, and delivery that
        works.
      </p>

      <h2>How releases work</h2>
      <p>
        Everything on Drop is sold as a fixed edition. When an edition sells out
        it stays sold out — there is no second printing, no quiet restock, no
        &ldquo;back by popular demand&rdquo;. The number on a product page is the
        number, and it goes down in front of you.
      </p>
      <p>
        Files arrive by email within a minute of payment, as a direct download
        link that stays valid for thirty days. If the email does not arrive, the
        purchase still happened and the link can be sent again — that is a
        deliberate design decision and not an accident of one.
      </p>

      <h2>For studios</h2>
      <p>
        Each studio keeps its own shopfront, sets its own editions and licences,
        and sees its own sales, delivery state and failures on a dashboard that
        says what went wrong in the payment or email provider&rsquo;s own words
        rather than showing a red dot.
      </p>

      <h2>A note on what this actually is</h2>
      <p>
        Drop is not a real marketplace. None of the studios exist and none of
        the people do. It runs so that{" "}
        <a href="https://beaam.app">Beaam</a> has something honest to monitor: a
        working application with real payments in test mode, real email, real
        object storage and real failure modes, which can be broken on purpose
        and watched recovering.
      </p>
      <p>
        Everything you can see here is running code rather than screenshots. The{" "}
        <Link href="/architecture">architecture page</Link> shows exactly what is
        behind it, and the whole thing is{" "}
        <a href="https://github.com/teqnyk/drop">open source</a>.
      </p>
    </main>
  );
}
