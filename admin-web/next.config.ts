import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 后台已用独立域名 admin.ji-psy.com，不再需要 /admin basePath
  reactStrictMode: true,
};

export default nextConfig;
