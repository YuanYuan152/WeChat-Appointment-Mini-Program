"use client";

import { useEffect, useState } from "react";

import type { SendSmsCodeResponse } from "@/lib/api";
import type { Notice } from "@/types/app";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export function LoginScreen({
  loading,
  notice,
  onSendCode,
  onLogin,
}: {
  loading: boolean;
  notice: Notice | null;
  onSendCode: (phone: string) => Promise<SendSmsCodeResponse>;
  onLogin: (phone: string, code: string) => Promise<void>;
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [localError, setLocalError] = useState("");
  const [mockHint, setMockHint] = useState("");

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!PHONE_PATTERN.test(phone)) {
      setLocalError("请输入有效的 11 位手机号");
      return;
    }
    setSending(true);
    setLocalError("");
    setMockHint("");
    try {
      const result = await onSendCode(phone);
      setCountdown(Math.max(1, result.resendAfter || 60));
      if (result.mockCode) {
        setCode(result.mockCode);
        setMockHint(`开发环境验证码：${result.mockCode}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "验证码发送失败";
      setLocalError(message);
      const wait = message.match(/(\d+)\s*秒/);
      if (wait) {
        setCountdown(Number(wait[1]));
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!PHONE_PATTERN.test(phone)) {
      setLocalError("请输入有效的 11 位手机号");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setLocalError("请输入 6 位数字验证码");
      return;
    }
    setLocalError("");
    await onLogin(phone, code);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] px-4 py-8 text-[var(--lxxl-text)] sm:px-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-sm lg:grid-cols-[1fr_420px]">
        <div className="flex min-h-[280px] flex-col justify-center bg-[var(--lxxl-green)] p-8 text-white sm:p-10 lg:min-h-[460px]">
          <div className="text-sm opacity-75">连心心理</div>
          <h1 className="mt-5 text-3xl font-semibold">连心心理工作台</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/75">
            管理员、咨询主任、咨询助理和咨询师统一使用已登记手机号登录。
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold">短信验证码登录</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            请输入后台账号绑定的手机号。后台账号由管理员创建，不开放自助注册。
          </p>

          {(localError || notice) && (
            <div
              role="alert"
              className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                localError || notice?.type === "error"
                  ? "border-[#F0B8B2] bg-[#FFF4F2] text-[#A13F37]"
                  : "border-[#C9E4D4] bg-[#F1FAF4] text-[var(--lxxl-green-dark)]"
              }`}
            >
              {localError || notice?.text}
            </div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium" htmlFor="staff-phone">
              手机号
            </label>
            <input
              id="staff-phone"
              autoComplete="tel"
              className="h-12 w-full rounded-xl border border-[var(--lxxl-border)] px-4 outline-none transition focus:border-[var(--lxxl-green)] focus:ring-2 focus:ring-[var(--lxxl-green)]/10"
              inputMode="numeric"
              maxLength={11}
              placeholder="请输入 11 位手机号"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
            />

            <label className="block text-sm font-medium" htmlFor="staff-code">
              短信验证码
            </label>
            <div className="flex gap-3">
              <input
                id="staff-code"
                autoComplete="one-time-code"
                className="h-12 min-w-0 flex-1 rounded-xl border border-[var(--lxxl-border)] px-4 outline-none transition focus:border-[var(--lxxl-green)] focus:ring-2 focus:ring-[var(--lxxl-green)]/10"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 位验证码"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
              <button
                className="h-12 shrink-0 rounded-xl border border-[var(--lxxl-border)] px-4 text-sm font-medium text-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={sending || countdown > 0 || loading}
                type="button"
                onClick={() => void handleSendCode()}
              >
                {sending ? "发送中..." : countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
              </button>
            </div>
            {mockHint && <p className="text-xs text-[var(--lxxl-green-dark)]">{mockHint}</p>}

            <button
              className="h-12 w-full rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
