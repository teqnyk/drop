import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter, SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Drop — small releases, big launch energy",
  description:
    "A home for independent studios selling limited digital editions. A demonstration marketplace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Drop is fictional and every surface says so (PRD §26). This banner is
            not decoration: it is the difference between illustrating a product
            and fabricating evidence for one. It must never be removed to make a
            screenshot look cleaner. */}
        <div className="demo-banner" role="note">
          <strong>Demonstration store.</strong> Drop is a fictional marketplace
          built to show what <a href="https://beaam.app">Beaam</a> monitors. The
          studios do not exist, nothing here is for sale, and no payment is ever
          taken.
        </div>
        <SiteNav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
