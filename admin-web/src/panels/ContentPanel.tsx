import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { ScreenData, ContentDraft, ContentKind } from "@/types/app";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { ContentCreateModal } from "@/components/content/ContentCreateModal";
import { ContentList } from "@/components/content/ContentList";
import type { ContentListItem } from "@/components/content/ContentList";
import {
  ContentTabs,
  getContentKindLabel,
  isSitePageKind,
  sitePageKeyForKind,
} from "@/components/content/ContentTabs";
import { getPageItems } from "@/lib/pagination";

export function ContentPanel({
  data,
  listLoading,
  draft,
  setDraft,
  activeKind,
  setActiveKind,
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
  onCreate: () => Promise<void> | void;
  onUpdate: (id: number) => Promise<void> | void;
  onDelete: (kind: ContentKind, id: number) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(DEFAULT_PAGE_SIZE);
  const activeItems = getContentItems(data, activeKind);
  const localPageData = getPageItems(activeItems, localPage, localPageSize);
  const visibleItems = localPageData.items;
  const allowDelete = activeKind === "banner" || activeKind === "activity" || activeKind === "consultation_guide";
  const hideImageColumn =
    activeKind === "brand" || activeKind === "charity" || activeKind === "consultation_guide";
  const createLabel =
    activeKind === "home_cover"
      ? activeItems.length > 0
        ? "编辑封面"
        : "设置封面"
      : isSitePageKind(activeKind)
        ? activeItems.length > 0
          ? "编辑正文"
          : "填写正文"
        : "新增";
  const resetDraft = () =>
    setDraft({
      kind: activeKind,
      title: "",
      body: "",
      summary: "",
      imageUrl: "",
      assistantQrcodeUrl: "",
      coverImageUrl: "",
      coverCrop: { x: 0, y: 0, width: 1, height: 1 },
      pageKey: sitePageKeyForKind(activeKind) || undefined,
    });
  const editing = editingId != null;

  const openCreate = () => {
    if (isSitePageKind(activeKind) && activeItems.length > 0) {
      const item = activeItems[0];
      setEditingId(item.id);
      setDraft({
        kind: activeKind,
        title: item.title,
        body: item.body || item.summary || "",
        summary: "",
        imageUrl: item.imageUrl || "",
        assistantQrcodeUrl: item.assistantQrcodeUrl || "",
        coverImageUrl: item.coverImageUrl || "",
        coverCrop: item.coverCrop || { x: 0, y: 0, width: 1, height: 1 },
        pageKey: sitePageKeyForKind(activeKind) || undefined,
      });
      setCreateOpen(true);
      return;
    }
    setEditingId(null);
    resetDraft();
    setCreateOpen(true);
  };

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
          total={activeItems.length}
          page={localPageData.currentPage}
          pageSize={localPageSize}
          createLabel={createLabel}
          allowDelete={allowDelete}
          hideImageColumn={hideImageColumn}
          onCreateClick={openCreate}
          onEdit={(item) => {
            setEditingId(item.id);
            setDraft({
              kind: activeKind,
              title: item.title,
              body: item.body || "",
              summary: item.summary || item.body || "",
              imageUrl: item.imageUrl || "",
              assistantQrcodeUrl: item.assistantQrcodeUrl || "",
              coverImageUrl: item.coverImageUrl || "",
              coverCrop: item.coverCrop || { x: 0, y: 0, width: 1, height: 1 },
              pageKey: item.pageKey,
            });
            setCreateOpen(true);
          }}
          onDelete={(id) => onDelete(activeKind, id)}
          onPageChange={setLocalPage}
          onPageSizeChange={(nextPageSize) => {
            setLocalPage(1);
            setLocalPageSize(nextPageSize);
          }}
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

  if (kind === "home_cover") {
    return (data.sitePages || []).map((item) => ({
      id: item.id,
      title: item.title || "首页封面",
      meta: "已发布",
      date: item.updatedAt,
      summary: previewText(item.body),
      body: item.body,
      pageKey: item.pageKey,
      imageUrl: item.coverImageUrl || undefined,
      coverImageUrl: item.coverImageUrl || undefined,
      coverCrop: item.coverCrop || undefined,
    }));
  }

  if (kind === "brand" || kind === "charity" || kind === "contact") {
    return (data.sitePages || []).map((item) => ({
      id: item.id,
      title: item.title,
      meta: "已发布",
      date: item.updatedAt,
      summary: previewText(item.body),
      body: item.body,
      pageKey: item.pageKey,
      imageUrl: kind === "contact" ? item.assistantQrcodeUrl || undefined : undefined,
      assistantQrcodeUrl: item.assistantQrcodeUrl || undefined,
    }));
  }

  return (data.siteGuideItems || []).map((item) => ({
    id: item.id,
    title: item.title,
    meta: item.isActive ? "启用" : "停用",
    date: item.updatedAt,
    summary: previewText(item.body),
    body: item.body,
  }));
}

function previewText(value?: string | null) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "-";
  }
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}
