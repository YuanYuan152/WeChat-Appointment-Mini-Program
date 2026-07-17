"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, KeyRound, MessageSquare } from "lucide-react";
import { sendCode } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthMode = "code" | "password";

export function AuthForm({
  type,
  redirectTo,
}: {
  type: "login" | "register";
  redirectTo?: string;
}) {
  const router = useRouter();
  const { loginByCode, loginByPassword, registerByCode, registerByPassword, loading } =
    useAuthStore();

  const [mode, setMode] = useState<AuthMode>("code");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [optionalPassword, setOptionalPassword] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [mockHint, setMockHint] = useState("");

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (sendingCode || countdown > 0 || !phone) return;
    setError("");
    setMockHint("");
    setSendingCode(true);
    try {
      const res = await sendCode(phone, type);
      setCountdown(60);
      if (res.mockCode) {
        setMockHint(`开发环境验证码：${res.mockCode}`);
        setCode(res.mockCode);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "发送失败";
      setError(message);
      const waitMatch = message.match(/(\d+)\s*秒/);
      if (waitMatch) {
        setCountdown(Number(waitMatch[1]));
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (type === "login") {
        if (mode === "code") {
          await loginByCode(phone, code);
        } else {
          await loginByPassword(phone, password);
        }
      } else if (mode === "code") {
        if (optionalPassword && optionalPassword !== confirmPassword) {
          setError("两次输入的密码不一致");
          return;
        }
        await registerByCode(phone, code, optionalPassword || undefined);
      } else {
        if (password.length < 6) {
          setError("密码至少 6 位");
          return;
        }
        if (password !== confirmPassword) {
          setError("两次输入的密码不一致");
          return;
        }
        await registerByPassword(phone, password);
      }
      router.push(redirectTo || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
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
            ? "使用手机号验证码或密码登录连心心理"
            : "注册后即可同步使用小程序与官网账号"}
        </p>
      </div>

      <div className="mb-6 flex rounded-full bg-muted p-1">
        <button
          type="button"
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-sm transition-colors",
            mode === "code" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"
          )}
          onClick={() => setMode("code")}
        >
          <MessageSquare className="h-4 w-4" />
          验证码{type === "login" ? "登录" : "注册"}
        </button>
        <button
          type="button"
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-sm transition-colors",
            mode === "password" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"
          )}
          onClick={() => setMode("password")}
        >
          <KeyRound className="h-4 w-4" />
          密码{type === "login" ? "登录" : "注册"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm">
        <div>
          <Label htmlFor="phone">手机号</Label>
          <div className="relative mt-1.5">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              className="pl-10"
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={11}
            />
          </div>
        </div>

        {mode === "code" ? (
          <>
            <div>
              <Label htmlFor="code">验证码</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="code"
                  placeholder="6 位验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={countdown > 0 || !phone || sendingCode}
                  onClick={handleSendCode}
                >
                  {sendingCode ? "发送中..." : countdown > 0 ? `${countdown}s` : "获取验证码"}
                </Button>
              </div>
              {mockHint && (
                <p className="mt-2 text-xs text-primary">{mockHint}</p>
              )}
            </div>
            {type === "register" && (
              <div>
                <Label htmlFor="optionalPassword">设置密码（选填）</Label>
                <Input
                  id="optionalPassword"
                  type="password"
                  className="mt-1.5"
                  placeholder="至少 6 位，可稍后在个人中心设置"
                  value={optionalPassword}
                  onChange={(e) => setOptionalPassword(e.target.value)}
                />
                {optionalPassword && (
                  <Input
                    type="password"
                    className="mt-2"
                    placeholder="确认密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                className="mt-1.5"
                placeholder="至少 6 位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {type === "register" && (
              <div>
                <Label htmlFor="confirmPassword">确认密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  className="mt-1.5"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

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
