import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { ScreenData, ContentDraft, ContentKind } from "@/types/app";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { ContentCreateModal } from "@/components/content/ContentCreateModal";
import { ContentList } from "@/components/content/ContentList";
import type { ContentListItem } from "@/components/content/ContentList";
import { ContentTabs, getContentKindLabel } from "@/components/content/ContentTabs";
import { getPageItems } from "@/lib/pagination";

export function ContentPanel({
  data,
  listLoading,
  draft,
  setDraft,
  activeKind,
  setActiveKind,
  articlePage,
  articlePageSize,
  onArticlePageChange,
  onArticlePageSizeChange,
  onCreate,
  onUpdate,
  onDelete,
}: {
  data: ScreenData;
  listLoading: boolean;
  draft: ContentDraft;
  setDraft: Dispatch<SetStateAction<ContentDraft>>;
  activeKind: ContentKind;
  setActiveKind: (kind: ContentKind) => void;
  articlePage: number;
  articlePageSize: number;
  onArticlePageChange: (page: number) => void;
  onArticlePageSizeChange: (pageSize: number) => void;
  onCreate: () => Promise<void> | void;
  onUpdate: (id: number) => Promise<void> | void;
  onDelete: (kind: ContentKind, id: number) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(DEFAULT_PAGE_SIZE);
  const activeItems = getContentItems(data, activeKind);
  const articleTotal = activeKind === "article" ? data.articles?.total : undefined;
  const articleCurrentPage = activeKind === "article" ? data.articles?.page ?? articlePage : undefined;
  const articleCurrentPageSize = activeKind === "article" ? data.articles?.pageSize ?? articlePageSize : undefined;
  const localPageData = getPageItems(activeItems, localPage, localPageSize);
  const visibleItems = activeKind === "article" ? activeItems : localPageData.items;
  const resetDraft = () => setDraft({ kind: activeKind, title: "", summary: "", imageUrl: "" });
  const editing = editingId != null;

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
      <ContentTabs
        activeKind={activeKind}
        onChange={(nextKind) => {
          setLocalPage(1);
          setActiveKind(nextKind);
        }}
      />

      <div className="relative">
        {listLoading && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        <ContentList
          title={getContentKindLabel(activeKind)}
          items={visibleItems}
          total={articleTotal ?? activeItems.length}
          page={articleCurrentPage ?? localPageData.currentPage}
          pageSize={articleCurrentPageSize ?? localPageSize}
          onCreateClick={() => {
            setEditingId(null);
            resetDraft();
            setCreateOpen(true);
          }}
          onEdit={(item) => {
            setEditingId(item.id);
            setDraft({
              kind: activeKind,
              title: item.title,
              summary: item.summary || "",
              imageUrl: item.imageUrl || "",
            });
            setCreateOpen(true);
          }}
          onDelete={(id) => onDelete(activeKind, id)}
          onPageChange={activeKind === "article" ? onArticlePageChange : setLocalPage}
          onPageSizeChange={
            activeKind === "article"
              ? onArticlePageSizeChange
              : (nextPageSize) => {
                  setLocalPage(1);
                  setLocalPageSize(nextPageSize);
                }
          }
        />
      </div>

      <ContentCreateModal
        open={createOpen}
        activeKind={activeKind}
        draft={draft}
        setDraft={setDraft}
        onClose={() => {
          setCreateOpen(false);
          setEditingId(null);
        }}
        mode={editing ? "edit" : "create"}
        onCreate={async () => {
          if (editing && editingId != null) {
            await onUpdate(editingId);
          } else {
            await onCreate();
          }
          resetDraft();
          setEditingId(null);
        }}
      />
    </section>
  );
}

function getContentItems(data: ScreenData, kind: ContentKind): ContentListItem[] {
  if (kind === "banner") {
    return (data.banners || []).map((item) => ({
      id: item.Id,
      title: item.Title,
      meta: item.IsActive ? "启用" : "停用",
      date: item.CreatedAt,
      imageUrl: item.ImageUrl,
    }));
  }

  if (kind === "activity") {
    return (data.activities || []).map((item) => ({
      id: item.Id,
      title: item.Title,
      meta: item.Type,
      date: item.CreatedAt,
      summary: item.Content,
      imageUrl: item.CoverUrl,
    }));
  }

  return (data.articles?.items || []).map((item) => ({
    id: item.id,
    title: item.title,
    meta: item.category || "文章",
    date: item.createdAt,
    summary: item.summary,
    imageUrl: item.coverUrl,
  }));
}
