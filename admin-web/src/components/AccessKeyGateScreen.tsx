"use client";

import { useState } from "react";

import { markAccessKeyPassed, verifyAccessKey } from "@/lib/accessKeyLogin";
import type { Notice } from "@/types/app";

export function AccessKeyGateScreen({
  notice,
  onUnlocked,
}: {
  notice: Notice | null;
  onUnlocked: () => void;
}) {
  const [accessKey, setAccessKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!accessKey.trim()) {
      setError("请输入访问密钥");
      return;
    }
    setSubmitting(true);
    try {
      if (!verifyAccessKey(accessKey)) {
        setError("访问密钥不正确");
        return;
      }
      markAccessKeyPassed();
      onUnlocked();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] px-6 text-[var(--lxxl-text)]">
      <section className="grid w-full max-w-5xl grid-cols-[1fr_420px] overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-sm">
        <div className="flex min-h-[420px] flex-col justify-center bg-[var(--lxxl-green)] p-10 text-white">
          <div className="text-sm opacity-75">连心心理</div>
          <h1 className="mt-5 text-3xl font-semibold">管理后台登录</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/75">
            请使用访问密钥登录。验证通过后将自动进入管理员工作台。
          </p>
        </div>
        <form className="p-8" onSubmit={handleSubmit}>
          <h2 className="text-xl font-semibold">输入访问密钥</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            请输入团队提供的访问密钥后继续。
          </p>
          {(notice || error) && (
            <div className="mt-5 rounded-xl border border-[#F0B8B2] bg-[#FFF4F2] px-4 py-3 text-sm text-[#A13F37]">
              {error || notice?.text}
            </div>
          )}
          <label className="mt-8 block text-sm font-medium" htmlFor="admin-access-key">
            访问密钥
          </label>
          <input
            autoComplete="off"
            className="mt-2 w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-sm outline-none ring-[var(--lxxl-green)] focus:ring-2"
            id="admin-access-key"
            placeholder="请输入访问密钥"
            type="password"
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
          />
          <button
            className="mt-6 w-full rounded-xl bg-[var(--lxxl-green)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "验证中..." : "验证并进入"}
          </button>
        </form>
      </section>
    </main>
  );
}
