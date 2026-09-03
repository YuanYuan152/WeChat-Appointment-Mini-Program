"use client";

import { useEffect, useState } from "react";

import { isOtpComplete, OtpInput } from "@/components/OtpInput";
import {
  changeAdminPassword,
  resetAdminPassword,
  sendAdminSmsCode,
} from "@/lib/api";

export function ChangePasswordPanel({
  initialPhone = "",
  lockedPhone = false,
  mode = "reset",
  onBack,
  onSuccess,
}: {
  initialPhone?: string;
  lockedPhone?: boolean;
  mode?: "reset" | "change";
  onBack?: () => void;
  onSuccess?: (message: string) => void;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [mockHint, setMockHint] = useState("");

  useEffect(() => {
    setPhone(initialPhone);
  }, [initialPhone]);

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
      const result = await sendAdminSmsCode(phone.trim(), "reset_password");
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
    if (submitting) {
      return;
    }
    setError("");
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      setError("请输入有效的手机号");
      return;
    }
    if (!isOtpComplete(code)) {
      setError("请输入 6 位验证码");
      return;
    }
    if (password.trim().length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      const result =
        mode === "change"
          ? await changeAdminPassword(phone.trim(), code, password.trim())
          : await resetAdminPassword(phone.trim(), code, password.trim());
      onSuccess?.(result.message || "密码已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改密码失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <h2 className="text-xl font-semibold">修改密码</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
        将使用「修改密码」专用短信模板发送验证码，验证通过后设置新密码。
      </p>
      {error ? (
        <div className="mt-5 rounded-xl border border-[#F0B8B2] bg-[#FFF4F2] px-4 py-3 text-sm text-[#A13F37]">
          {error}
        </div>
      ) : null}
      <label className="mt-8 block text-sm font-medium" htmlFor="admin-reset-phone">
        手机号
      </label>
      <input
        autoComplete="tel"
        className="mt-2 w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-sm outline-none ring-[var(--lxxl-green)] focus:ring-2 disabled:bg-[#F7F5F2]"
        disabled={lockedPhone || submitting}
        id="admin-reset-phone"
        inputMode="numeric"
        maxLength={11}
        placeholder="请输入绑定手机号"
        value={phone}
        onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
      />
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-medium">验证码</span>
          <button
            className="text-sm text-[var(--lxxl-green)] disabled:opacity-50"
            disabled={submitting || sendingCode || countdown > 0 || phone.trim().length !== 11}
            type="button"
            onClick={() => void handleSendCode()}
          >
            {sendingCode ? "发送中..." : countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
          </button>
        </div>
        <OtpInput disabled={submitting} value={code} onChange={setCode} />
        {mockHint ? <p className="mt-2 text-xs text-[var(--lxxl-green)]">{mockHint}</p> : null}
      </div>
      <label className="mt-6 block text-sm font-medium" htmlFor="admin-reset-password">
        新密码
      </label>
      <input
        autoComplete="new-password"
        className="mt-2 w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-sm outline-none ring-[var(--lxxl-green)] focus:ring-2"
        disabled={submitting}
        id="admin-reset-password"
        placeholder="至少 6 位"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <label className="mt-4 block text-sm font-medium" htmlFor="admin-reset-password-confirm">
        确认新密码
      </label>
      <input
        autoComplete="new-password"
        className="mt-2 w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-sm outline-none ring-[var(--lxxl-green)] focus:ring-2"
        disabled={submitting}
        id="admin-reset-password-confirm"
        placeholder="再次输入新密码"
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
      />
      <button
        className="mt-8 w-full rounded-xl bg-[var(--lxxl-green)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "提交中..." : "确认修改"}
      </button>
      {onBack ? (
        <button
          className="mt-4 w-full text-xs text-[var(--lxxl-muted)] opacity-70 transition hover:opacity-100"
          type="button"
          onClick={onBack}
        >
          返回登录
        </button>
      ) : null}
    </form>
  );
}
