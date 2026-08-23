import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Drop is a demonstration app, but it is a real one: the same strictness
  // Beaam holds itself to, because a demo that only works in dev teaches the
  // wrong thing about the stack it is demonstrating.
  //
  // Type errors and lint failures break the build by DEFAULT in Next 16 — the
  // `typescript` and `eslint` escape hatches that used to be set here were
  // removed from NextConfig, and setting them was the first thing that broke
  // this build. Not re-adding them under another name: a demo that ships with
  // type errors suppressed is not demonstrating a stack anyone should copy.
  reactStrictMode: true,
};

// Makes Cloudflare bindings available in `next dev`, so local development uses
// the same runtime shape as the deploy rather than diverging from it.
void initOpenNextCloudflareForDev();

/**
 * Sentry's build plugin, applied only when Sentry is actually set up.
 *
 * Wrapping unconditionally makes every clone without a DSN carry a source-map
 * upload step that cannot authenticate, and turns a clean `pnpm build` into a
 * wall of warnings about credentials the person does not have and does not
 * need. An unconfigured checkout should build exactly as it did before Sentry
 * existed.
 *
 * SENTRY_AUTH_TOKEN is what gates it rather than the DSN: the DSN makes the
 * runtime report errors, the token is what lets the BUILD upload source maps.
 * Reporting without readable stack traces is still worth having, so the two
 * are separate switches.
 */
const withSourceMaps =
  process.env.SENTRY_AUTH_TOKEN?.trim() &&
  process.env.SENTRY_ORG?.trim() &&
  process.env.SENTRY_PROJECT?.trim();

export default withSourceMaps
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      // The demo is public and open source; there is nothing in the bundle
      // worth hiding, and readable frames are the entire point.
      widenClientFileUpload: true,
    })
  : nextConfig;
