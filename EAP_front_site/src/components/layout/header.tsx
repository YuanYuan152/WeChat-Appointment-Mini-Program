"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Heart } from "lucide-react";
import { HeaderAuth } from "@/components/auth/header-auth";
import { UserAccountLinks } from "@/components/auth/user-account-links";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/stories", label: "心理图文" },
  { href: "/qa", label: "心理问答" },
  { href: "/our-stories", label: "我们的故事" },
  { href: "/audio", label: "心理音画" },
  { href: "/consultation", label: "预约咨询" },
  { href: "/assessment", label: "心理测评" },
];

export function Header() {
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header
      className={cn(
        "fixed top-0 z-40 w-full transition-all duration-300",
        scrolled
          ? "border-b border-border/60 bg-background/80 shadow-sm backdrop-blur-lg"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-4 w-4 text-primary" />
          </div>
          <span className="font-serif text-lg font-semibold tracking-wide">
            连心心理
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-6 md:flex">
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm transition-colors",
                  pathname.startsWith(item.href)
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <HeaderAuth />
        </div>

        <div className="ml-auto md:hidden">
          <button
            className="rounded-full p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="菜单"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border bg-background/95 px-4 py-4 backdrop-blur-lg md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={cn(
                "block rounded-xl px-4 py-3 text-sm",
                pathname.startsWith(item.href)
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
          {token ? (
            <UserAccountLinks onNavigate={closeMobile} />
          ) : (
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <Link href="/login" className="flex-1" onClick={closeMobile}>
                <Button variant="outline" className="w-full" size="sm">登录</Button>
              </Link>
              <Link href="/register" className="flex-1" onClick={closeMobile}>
                <Button className="w-full" size="sm">注册</Button>
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
