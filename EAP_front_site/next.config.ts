import type { NextConfig } from "next";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

let apiHostname = "localhost";
try {
  apiHostname = new URL(apiBase).hostname;
} catch {
  /* use default */
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "http", hostname: apiHostname, pathname: "/static/**" },
      { protocol: "https", hostname: apiHostname, pathname: "/static/**" },
    ],
  },
};

export default nextConfig;
