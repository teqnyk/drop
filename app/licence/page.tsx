export const metadata = { title: "Licences — Drop" };

export default function LicencePage() {
  return (
    <main className="wrap prose" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <p className="eyebrow">licence</p>
      <h1>What you can do with these files</h1>

      <p className="lede">
        Plain terms, because a licence nobody reads protects nobody. Every studio
        sets its own, stated on each product page — but Drop requires them all to
        fit the shape below, so a buyer never has to read four different
        contracts to know what they bought.
      </p>

      <h2>You can</h2>
      <ul>
        <li>Use the files in your own work, personal or commercial.</li>
        <li>Modify them, extend them, and mix them with your own material.</li>
        <li>Use them in work you are paid for, including client work.</li>
        <li>Install them on as many of your own machines as you like.</li>
      </ul>

      <h2>You cannot</h2>
      <ul>
        <li>Resell or redistribute the files themselves, modified or not.</li>
        <li>Include them in a product whose main value is the files.</li>
        <li>Claim authorship of the originals.</li>
      </ul>

      <h2>Refunds</h2>
      <p>
        Digital goods, delivered immediately, so there is no refund window on
        change of mind. If a download is broken, missing, or not what the product
        page described, that is a different matter and it gets fixed or refunded.
      </p>

      <p className="muted small">
        Drop and its studios are fictional and nothing here is a real contract.
        These terms exist so the marketplace reads like one.
      </p>
    </main>
  );
}
