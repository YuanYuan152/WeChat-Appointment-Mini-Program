"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendCode } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth-store";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export function AuthForm({
  type,
  redirectTo,
}: {
  type: "login" | "register";
  redirectTo?: string;
}) {
  const router = useRouter();
  const { loginByCode, registerByCode, loading } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [mockHint, setMockHint] = useState("");

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (sendingCode || countdown > 0) return;
    if (!PHONE_PATTERN.test(phone)) {
      setError("请输入有效的 11 位手机号");
      return;
    }

    setError("");
    setMockHint("");
    setSendingCode(true);
    try {
      const result = await sendCode(phone, type);
      setCountdown(Math.max(1, result.resendAfter || 60));
      if (result.mockCode) {
        setMockHint(`开发环境验证码：${result.mockCode}`);
        setCode(result.mockCode);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "验证码发送失败";
      setError(message);
      const wait = message.match(/(\d+)\s*秒/);
      if (wait) setCountdown(Number(wait[1]));
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!PHONE_PATTERN.test(phone)) {
      setError("请输入有效的 11 位手机号");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("请输入 6 位数字验证码");
      return;
    }

    try {
      if (type === "login") {
        await loginByCode(phone, code);
      } else {
        await registerByCode(phone, code);
      }
      router.push(redirectTo || "/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败");
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl font-bold">
          {type === "login" ? "欢迎回来" : "创建账号"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {type === "login"
            ? "使用手机号短信验证码登录连心心理"
            : "验证手机号后即可同步使用小程序与官网账号"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm"
      >
        <div>
          <Label htmlFor="phone">手机号</Label>
          <div className="relative mt-1.5">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              autoComplete="tel"
              className="pl-10"
              inputMode="numeric"
              maxLength={11}
              placeholder="请输入 11 位手机号"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="code" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            短信验证码
          </Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位验证码"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={countdown > 0 || sendingCode || loading}
              onClick={() => void handleSendCode()}
            >
              {sendingCode ? "发送中..." : countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
            </Button>
          </div>
          {mockHint && <p className="mt-2 text-xs text-primary">{mockHint}</p>}
        </div>

        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "处理中..." : type === "login" ? "登录" : "注册"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {type === "login" ? (
          <>
            还没有账号？
            <Link href="/register" className="ml-1 text-primary hover:underline">
              立即注册
            </Link>
          </>
        ) : (
          <>
            已有账号？
            <Link href="/login" className="ml-1 text-primary hover:underline">
              去登录
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
