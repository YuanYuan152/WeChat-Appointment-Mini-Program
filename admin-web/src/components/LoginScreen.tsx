import type { DevLoginCode } from "@/lib/api";
import type { Notice } from "@/types/app";

export function LoginScreen({
  loading,
  notice,
  onLogin,
}: {
  loading: boolean;
  notice: Notice | null;
  onLogin: (code: DevLoginCode) => Promise<void>;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--lxxl-bg)] px-6 text-[var(--lxxl-text)]">
      <section className="grid w-full max-w-5xl grid-cols-[1fr_420px] overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-sm">
        <div className="flex min-h-[420px] flex-col justify-center bg-[var(--lxxl-green)] p-10 text-white">
          <div className="text-sm opacity-75">连心心理</div>
          <h1 className="mt-5 text-3xl font-semibold">连心心理工作台</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/75">Web 管理端</p>
        </div>
        <div className="p-8">
          <h2 className="text-xl font-semibold">登录</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            请选择当前需要进入的后台角色。
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
              管理员
            </button>
            <button
              className="w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-sm font-medium disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={() => onLogin("dev_assistant")}
            >
              咨询助理
            </button>
            <button
              className="w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-sm font-medium disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={() => onLogin("dev_ops")}
            >
              咨询主任
            </button>
            <button
              className="w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-sm font-medium disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={() => onLogin("dev_counselor")}
            >
              咨询师
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
