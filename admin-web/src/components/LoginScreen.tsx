import { API_BASE_URL } from "@/lib/api";

import type { Notice } from "@/types/app";

export function LoginScreen({
  loading,
  notice,
  onLogin,
}: {
  loading: boolean;
  notice: Notice | null;
  onLogin: (code: "dev_admin" | "dev_ops") => Promise<void>;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] px-6 text-[var(--lxxl-text)]">
      <section className="grid w-full max-w-5xl grid-cols-[1fr_420px] overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-sm">
        <div className="bg-[var(--lxxl-green)] p-10 text-white">
          <div className="text-sm opacity-75">连心心理</div>
          <h1 className="mt-5 text-3xl font-semibold">Web 管理端迁移版</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/75">
            第一版复用现有 FastAPI 小程序后台接口，先把管理员和运营的高频后台能力迁移到 Web 交互里。
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/10 p-4">不修改数据库表</div>
            <div className="rounded-xl bg-white/10 p-4">共用 backend-python</div>
            <div className="rounded-xl bg-white/10 p-4">Web 表格与筛选</div>
            <div className="rounded-xl bg-white/10 p-4">兼容小程序联动</div>
          </div>
        </div>
        <div className="p-8">
          <h2 className="text-xl font-semibold">开发登录</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            当前先复用后端已有的本地 mock 登录 code。正式登录不会使用小程序 wx.login，后续按手机号验证码或扫码登录补 Web 专用接口。
          </p>
          {notice && (
            <div className="mt-5 rounded-xl border border-[#F0B8B2] bg-[#FFF4F2] px-4 py-3 text-sm text-[#A13F37]">
              {notice.text}
            </div>
          )}
          <div className="mt-8 space-y-3">
            <button
              className="w-full rounded-xl bg-[var(--lxxl-green)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={() => onLogin("dev_admin")}
            >
              以管理员身份进入
            </button>
            <button
              className="w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-sm font-medium disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={() => onLogin("dev_ops")}
            >
              以运营身份进入
            </button>
          </div>
          <div className="mt-6 rounded-xl bg-[#FAF8F4] p-4 text-xs leading-6 text-[var(--lxxl-muted)]">
            后端地址读取 `NEXT_PUBLIC_API_BASE_URL`，默认是 {API_BASE_URL}。
          </div>
        </div>
      </section>
    </main>
  );
}
