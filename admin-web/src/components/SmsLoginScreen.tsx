"use client";

import { useEffect, useState } from "react";

import { ChangePasswordPanel } from "@/components/ChangePasswordPanel";
import { isOtpComplete, OtpInput } from "@/components/OtpInput";
import { loginWithPassword, loginWithSmsCode, sendAdminSmsCode } from "@/lib/api";
import type { Notice } from "@/types/app";

type AuthTab = "sms" | "password";
type PanelMode = "login" | "reset";

export function SmsLoginScreen({
  loading,
  notice,
  onLoggedIn,
  onSwitchToAccessKey,
  onSwitchToDevLogin,
  showDevLoginLink,
}: {
  loading: boolean;
  notice: Notice | null;
  onLoggedIn: () => Promise<void>;
  onSwitchToAccessKey?: () => void;
  onSwitchToDevLogin?: () => void;
  showDevLoginLink?: boolean;
}) {
  const [panelMode, setPanelMode] = useState<PanelMode>("login");
  const [authTab, setAuthTab] = useState<AuthTab>("sms");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mockHint, setMockHint] = useState("");

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (sendingCode || countdown > 0 || !phone.trim()) {
      return;
    }
    setError("");
    setMockHint("");
    setSendingCode(true);
    try {
      const result = await sendAdminSmsCode(phone.trim(), "login");
      setCountdown(60);
      if (result.mockCode) {
        setMockHint(`开发环境验证码：${result.mockCode}`);
        setCode(result.mockCode);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "验证码发送失败";
      setError(message);
      const waitMatch = message.match(/(\d+)\s*秒/);
      if (waitMatch) {
        setCountdown(Number(waitMatch[1]));
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || submitting) {
      return;
    }
    setError("");
    setSuccess("");
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      setError("请输入有效的手机号");
      return;
    }
    if (authTab === "sms") {
      if (!isOtpComplete(code)) {
        setError("请输入 6 位验证码");
        return;
      }
    } else if (!password.trim()) {
      setError("请输入密码");
      return;
    }

    setSubmitting(true);
    try {
      if (authTab === "sms") {
        await loginWithSmsCode(phone.trim(), code);
      } else {
        await loginWithPassword(phone.trim(), password);
      }
      await onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  const busy = loading || submitting;

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] px-6 text-[var(--lxxl-text)]">
      <section className="grid w-full max-w-5xl grid-cols-[1fr_420px] overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-sm">
        <div className="flex min-h-[420px] flex-col justify-center bg-[var(--lxxl-green)] p-10 text-white">
          <div className="text-sm opacity-75">连心心理</div>
          <h1 className="mt-5 text-3xl font-semibold">连心心理工作台</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/75">
            支持短信验证码或密码登录；修改密码时使用独立短信模板验证。
          </p>
        </div>
        <div className="p-8">
          {panelMode === "reset" ? (
            <ChangePasswordPanel
              initialPhone={phone}
              mode="reset"
              onBack={() => {
                setPanelMode("login");
                setError("");
                setSuccess("");
              }}
              onSuccess={(message) => {
                setPanelMode("login");
                setAuthTab("password");
                setPassword("");
                setCode("");
                setError("");
                setSuccess(message || "密码已更新，请使用新密码登录");
              }}
            />
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 className="text-xl font-semibold">登录</h2>
              <div className="mt-5 flex rounded-full bg-[#F7F5F2] p-1">
                <button
                  className={`flex-1 rounded-full py-2 text-sm transition ${
                    authTab === "sms"
                      ? "bg-white font-medium text-[var(--lxxl-green)] shadow-sm"
                      : "text-[var(--lxxl-muted)]"
                  }`}
                  type="button"
                  onClick={() => {
                    setAuthTab("sms");
                    setError("");
                  }}
                >
                  验证码登录
                </button>
                <button
                  className={`flex-1 rounded-full py-2 text-sm transition ${
                    authTab === "password"
                      ? "bg-white font-medium text-[var(--lxxl-green)] shadow-sm"
                      : "text-[var(--lxxl-muted)]"
                  }`}
                  type="button"
                  onClick={() => {
                    setAuthTab("password");
                    setError("");
                  }}
                >
                  密码登录
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--lxxl-muted)]">
                {authTab === "sms"
                  ? "验证码将发送至您的手机，有效期 5 分钟。"
                  : "使用已设置的密码登录；若尚未设置，请先修改密码。"}
              </p>
              {(notice || error || success) && (
                <div
                  className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                    success && !error
                      ? "border-[#C9E4D4] bg-[#F1FAF4] text-[var(--lxxl-green-dark)]"
                      : "border-[#F0B8B2] bg-[#FFF4F2] text-[#A13F37]"
                  }`}
                >
                  {error || success || notice?.text}
                </div>
              )}
              <label className="mt-8 block text-sm font-medium" htmlFor="admin-login-phone">
                手机号
              </label>
              <input
                autoComplete="tel"
                className="mt-2 w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-sm outline-none ring-[var(--lxxl-green)] focus:ring-2"
                id="admin-login-phone"
                inputMode="numeric"
                maxLength={11}
                placeholder="请输入绑定手机号"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
              />
              {authTab === "sms" ? (
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">验证码</span>
                    <button
                      className="text-sm text-[var(--lxxl-green)] disabled:opacity-50"
                      disabled={busy || sendingCode || countdown > 0 || phone.trim().length !== 11}
                      type="button"
                      onClick={() => void handleSendCode()}
                    >
                      {sendingCode
                        ? "发送中..."
                        : countdown > 0
                          ? `${countdown}s 后重发`
                          : "获取验证码"}
                    </button>
                  </div>
                  <OtpInput disabled={busy} value={code} onChange={setCode} />
                  {mockHint ? <p className="mt-2 text-xs text-[var(--lxxl-green)]">{mockHint}</p> : null}
                </div>
              ) : (
                <div className="mt-6">
                  <label className="block text-sm font-medium" htmlFor="admin-login-password">
                    密码
                  </label>
                  <input
                    autoComplete="current-password"
                    className="mt-2 w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-sm outline-none ring-[var(--lxxl-green)] focus:ring-2"
                    id="admin-login-password"
                    placeholder="请输入密码"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              )}
              <button
                className="mt-8 w-full rounded-xl bg-[var(--lxxl-green)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                {busy ? "登录中..." : "登录"}
              </button>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--lxxl-muted)]">
                <button
                  className="opacity-70 transition hover:opacity-100"
                  type="button"
                  onClick={() => {
                    setPanelMode("reset");
                    setError("");
                    setSuccess("");
                  }}
                >
                  修改密码
                </button>
                {onSwitchToAccessKey ? (
                  <button
                    className="opacity-60 transition hover:opacity-100"
                    type="button"
                    onClick={onSwitchToAccessKey}
                  >
                    密钥登录
                  </button>
                ) : null}
                {showDevLoginLink && onSwitchToDevLogin ? (
                  <button
                    className="opacity-60 transition hover:opacity-100"
                    type="button"
                    onClick={onSwitchToDevLogin}
                  >
                    开发角色登录
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
