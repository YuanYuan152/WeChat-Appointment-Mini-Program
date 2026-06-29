import type { Metadata } from "next";
import "./globals.css";

import { AppFrame } from "@/components/AppFrame";

export const metadata: Metadata = {
  title: "连心心理 Web 管理端",
  description: "管理员和运营角色的 Web 管理端框架。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
