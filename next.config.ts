import type { NextConfig } from "next";

// Deployed standalone on Vercel (its own domain, e.g. harpian-cockpit.vercel.app),
// not as a subpath of another app — no basePath needed. Regular server output
// (not "export") so middleware.ts can gate every request with HTTP Basic Auth —
// this app is internal-only (real partner data, unrestricted model internals).
const nextConfig: NextConfig = {
  images: { unoptimized: true },
};

export default nextConfig;
