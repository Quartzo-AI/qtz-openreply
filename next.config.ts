import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
  // The Quartzo edge (Traefik on qtz-primary) proxies openreply.quartzo.ai to
  // this container with passHostHeader disabled, so x-forwarded-host is the
  // internal sslip hostname while origin stays openreply.quartzo.ai. Next's
  // Server Action CSRF check compares the two and aborts every form POST with
  // "Invalid Server Actions request" -- which is every login attempt. Declaring
  // the public origin is the documented fix for a reverse-proxied deployment.
  experimental: {
    serverActions: {
      allowedOrigins: ["openreply.quartzo.ai"],
    },
  },
};

export default nextConfig;
