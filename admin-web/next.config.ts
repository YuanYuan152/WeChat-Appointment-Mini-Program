import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  reactStrictMode: true,
  // 上级目录还有 package-lock.json，避免 Turbopack 把 monorepo 根推断错
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
