import Link from "next/link";
import { Wordmark } from "./wordmark";

/**
 * Drop's chrome.
 *
 * Every destination here is a real page. A navigation bar with dead links is
 * the fastest way to make a demonstration feel like a mockup, and the point of
 * Drop is that it is a working marketplace that happens to be fictional.
 */
export function SiteNav() {
  return (
    <header className="site-nav">
      <div className="wrap site-nav-inner">
        <Link href="/" className="site-brand" aria-label="Drop, home">
          <Wordmark />
        </Link>
        <nav aria-label="Main">
          <Link href="/">Studios</Link>
          <Link href="/about">About</Link>
          <Link href="/licence">Licences</Link>
          <Link href="/architecture">How it works</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer-inner">
        <div>
          <Wordmark size={18} />
          <p className="muted small" style={{ marginTop: 8, maxWidth: "42ch" }}>
            A fictional marketplace of fictional studios, so that a real
            monitoring stack has something honest to watch.
          </p>
        </div>
        <nav aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/licence">Licences</Link>
          <Link href="/architecture">How it works</Link>
          <a href="https://beaam.app">Beaam</a>
          <a href="https://github.com/teqnyk/drop">Source</a>
        </nav>
      </div>
    </footer>
  );
}
