"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";

export function AssessmentLoginNotice() {
  const token = useAuthStore((s) => s.token);

  if (token) return null;

  return (
    <p className="mb-6 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      开始测评需先
      <Link href="/login" className="mx-1 text-primary hover:underline">
        登录
      </Link>
      或
      <Link href="/register" className="mx-1 text-primary hover:underline">
        注册
      </Link>
      账号，完成后可在「我的测评报告」中查看历史记录。
    </p>
  );
}
