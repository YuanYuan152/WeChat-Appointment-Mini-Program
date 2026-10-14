import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const apiHostnames = new Set<string>(["localhost", "127.0.0.1"]);
try {
  apiHostnames.add(new URL(apiBase).hostname);
} catch {
  /* keep defaults */
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
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
      ...[...apiHostnames].flatMap((hostname) => [
        { protocol: "http" as const, hostname, pathname: "/static/**" },
        { protocol: "https" as const, hostname, pathname: "/static/**" },
      ]),
    ],
  },
};

export default nextConfig;
