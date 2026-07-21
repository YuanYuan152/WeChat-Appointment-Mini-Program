import type { Metadata } from "next";
import "./globals.css";

import { AppFrame } from "@/components/AppFrame";

export const metadata: Metadata = {
  title: "连心心理 Web 管理端",
  description: "管理员、咨询主任与咨询助理的 Web 管理端框架。",
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
