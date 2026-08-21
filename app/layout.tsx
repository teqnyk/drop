import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soft Theory — limited releases",
  description:
    "Carefully made digital products, released in small editions. A demonstration storefront.",
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
          <strong>Demonstration store.</strong> Drop is a fictional shop built to
          show what <a href="https://beaam.app">Beaam</a> monitors. Nothing here
          is for sale and no payment is ever taken.
        </div>
        {children}
      </body>
    </html>
  );
}
