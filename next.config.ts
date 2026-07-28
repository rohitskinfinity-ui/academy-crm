import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "bcrypt"],
  // NestJS mounted Swagger at `/api`. Next uses `/api/*` for handlers,
  // so UI is at `/api-docs` and exact `/api` redirects there.
  async redirects() {
    return [
      {
        source: "/api",
        destination: "/api-docs",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
