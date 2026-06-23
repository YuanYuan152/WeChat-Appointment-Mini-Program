import type { Dispatch, SetStateAction } from "react";

import { formatDate } from "@/lib/format";

import type { AdminData, ContentDraft } from "../types";
import { EmptyState, PanelHeader } from "../components/ui";

export function ContentPanel({
  data,
  draft,
  setDraft,
  onCreate,
  onDelete,
}: {
  data: AdminData;
  draft: ContentDraft;
  setDraft: Dispatch<SetStateAction<ContentDraft>>;
  onCreate: () => void;
  onDelete: (kind: "banner" | "activity" | "article", id: number) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
        <PanelHeader title="新建内容" description="复用现有运营接口，第一版提供轻量表单。" />
        <div className="grid grid-cols-[160px_1fr_1fr_1fr_auto] gap-3 px-6 py-5">
          <select
            className="h-10 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm"
            value={draft.kind}
            onChange={(event) => setDraft((prev) => ({ ...prev, kind: event.target.value }))}
          >
            <option value="article">文章</option>
            <option value="activity">活动/公告</option>
            <option value="banner">Banner</option>
          </select>
          <input
            className="h-10 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none"
            placeholder="标题"
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          />
          <input
            className="h-10 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none"
            placeholder="摘要/正文"
            value={draft.summary}
            onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))}
          />
          <input
            className="h-10 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none"
            placeholder="图片地址（Banner 必填）"
            value={draft.imageUrl}
            onChange={(event) => setDraft((prev) => ({ ...prev, imageUrl: event.target.value }))}
          />
          <button
            className="rounded-xl bg-[var(--lxxl-green)] px-4 py-2 text-sm font-medium text-white"
            type="button"
            onClick={onCreate}
          >
            新增
          </button>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-6">
        <ContentList
          title="Banner"
          items={(data.banners || []).map((item) => ({
            id: item.Id,
            title: item.Title,
            meta: item.IsActive ? "启用" : "停用",
            date: item.CreatedAt,
          }))}
          onDelete={(id) => onDelete("banner", id)}
        />
        <ContentList
          title="活动/公告"
          items={(data.activities || []).map((item) => ({
            id: item.Id,
            title: item.Title,
            meta: item.Type,
            date: item.CreatedAt,
          }))}
          onDelete={(id) => onDelete("activity", id)}
        />
        <ContentList
          title="文章"
          items={(data.articles?.items || []).map((item) => ({
            id: item.id,
            title: item.title,
            meta: item.category || "文章",
            date: item.createdAt,
          }))}
          onDelete={(id) => onDelete("article", id)}
        />
      </div>
    </div>
  );
}

function ContentList({
  title,
  items,
  onDelete,
}: {
  title: string;
  items: Array<{ id: number; title: string; meta?: string | null; date?: string | null }>;
  onDelete: (id: number) => void;
}) {
  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader title={title} description={`${items.length} 条`} />
      <div className="divide-y divide-[var(--lxxl-border)]">
        {items.length === 0 ? (
          <EmptyState text="暂无内容。" />
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 px-5 py-4 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.title}</div>
                <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                  {item.meta || "-"} · {formatDate(item.date)}
                </div>
              </div>
              <button
                className="shrink-0 text-xs font-medium text-[#A13F37]"
                type="button"
                onClick={() => onDelete(item.id)}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
