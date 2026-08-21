import type { NextConfig } from "next";
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

export default nextConfig;
