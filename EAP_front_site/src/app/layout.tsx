import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AudioPlayerBar } from "@/components/audio/audio-player-bar";
import { AuthProvider } from "@/components/auth/header-auth";
import { assessmentPublicSiteOrigin } from "@/lib/assessment/public-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: assessmentPublicSiteOrigin(),
  title: "连心心理 | 专业心理咨询",
  description: "温暖专业的心理咨询机构，提供心理图文、音频疗愈、预约咨询与心理测评服务。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="flex min-h-full flex-col antialiased">
        <AuthProvider />
        <Header />
        <main className="flex-1 pb-20">{children}</main>
        <Footer />
        <AudioPlayerBar />
      </body>
    </html>
  );
}
