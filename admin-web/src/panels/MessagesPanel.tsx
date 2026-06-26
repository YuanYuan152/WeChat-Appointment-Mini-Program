import { formatDateTime } from "@/lib/format";
import type { MessageItem } from "@/types/api";

import { Badge, EmptyState, PanelHeader, TableActionButton } from "@/components/ui";

export function MessagesPanel({
  messages,
  onOpen,
}: {
  messages?: MessageItem[];
  onOpen: (message: MessageItem) => void;
}) {
  const items = messages || [];

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader title="我的消息" description="查看当前登录角色收到的提醒，点击消息进入对应处理页面。" />
      {items.length === 0 ? (
        <EmptyState text="暂无消息。" />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">标题</th>
              <th className="px-5 py-3 font-medium">内容</th>
              <th className="px-5 py-3 font-medium">关联</th>
              <th className="px-5 py-3 font-medium">时间</th>
              <th className="px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.Id} className="border-t border-[var(--lxxl-border)] align-top">
                <td className="px-5 py-4">
                  <Badge tone={item.IsRead ? "neutral" : "gold"}>{item.IsRead ? "已读" : "未读"}</Badge>
                </td>
                <td className="px-5 py-4 font-medium">{item.Title}</td>
                <td className="max-w-md px-5 py-4 text-[var(--lxxl-muted)]">{item.Content || "-"}</td>
                <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                  {item.RelatedType ? `${item.RelatedType} #${item.RelatedId || "-"}` : "-"}
                </td>
                <td className="px-5 py-4 text-[var(--lxxl-muted)]">{formatDateTime(item.CreatedAt)}</td>
                <td className="px-5 py-4">
                  <TableActionButton onClick={() => onOpen(item)}>查看</TableActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
