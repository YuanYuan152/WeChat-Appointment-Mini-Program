import { formatDateTime, statusLabel } from "@/lib/format";
import type { FeedbackItem } from "@/types/api";

import { Badge, EmptyState, QueryButton, QueryField, queryControlClass } from "@/components/ui";

export function FeedbackPanel({
  feedbacks,
  status,
  setStatus,
  onSearch,
}: {
  feedbacks?: FeedbackItem[];
  status: string;
  setStatus: (status: string) => void;
  onSearch: () => void;
}) {
  const items = feedbacks || [];

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <form
        className="px-6 py-5 sm:px-7 lg:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div>
          <h2 className="text-xl font-semibold tracking-normal">用户反馈</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">查看用户提交的反馈内容、联系方式和处理状态。</p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="状态">
            <select className={queryControlClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">全部</option>
              <option value="OPEN">未处理</option>
              <option value="CLOSED">已处理</option>
            </select>
          </QueryField>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState text="暂无用户反馈。" />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">提交时间</th>
              <th className="px-5 py-3 font-medium">用户</th>
              <th className="px-5 py-3 font-medium">类型</th>
              <th className="px-5 py-3 font-medium">反馈内容</th>
              <th className="px-5 py-3 font-medium">联系方式</th>
              <th className="px-5 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-[var(--lxxl-border)] align-top">
                <td className="px-5 py-4 text-[var(--lxxl-muted)]">{formatDateTime(item.createdAt)}</td>
                <td className="px-5 py-4">
                  <div className="font-medium">{item.userName || `用户#${item.accountId}`}</div>
                  <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{item.userMobile || "-"}</div>
                </td>
                <td className="px-5 py-4">{item.category || "其他"}</td>
                <td className="max-w-lg px-5 py-4 text-[var(--lxxl-muted)]">{item.content}</td>
                <td className="px-5 py-4 text-[var(--lxxl-muted)]">{item.contact || "-"}</td>
                <td className="px-5 py-4">
                  <Badge tone={item.status === "OPEN" ? "gold" : "green"}>{statusLabel(item.status)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
