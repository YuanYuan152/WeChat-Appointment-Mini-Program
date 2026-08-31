"use client";

import { useCallback, useEffect, useState } from "react";

import { createContent, deleteContent, fetchContentData, updateContent } from "@/services/content";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { ContentPanel } from "@/panels/ContentPanel";
import { getMessage } from "@/lib/display";
import type { ScreenData, ContentDraft, ContentKind } from "@/types/app";

export function ContentScreen() {
  return (
    <AppRoute sectionId="content">
      <ContentScreenContent />
    </AppRoute>
  );
}

function emptyDraft(kind: ContentKind): ContentDraft {
  return {
    kind,
    title: "",
    body: "",
    summary: "",
    imageUrl: "",
    assistantQrcodeUrl: "",
    coverImageUrl: "",
    coverCrop: { x: 0, y: 0, width: 1, height: 1 },
  };
}

function ContentScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [activeKind, setActiveKind] = useState<ContentKind>("banner");
  const [listLoading, setListLoading] = useState(false);
  const [contentDraft, setContentDraft] = useState<ContentDraft>(emptyDraft("banner"));

  const refreshContentData = useCallback(async () => {
    const contentData = await fetchContentData(activeKind, { page: 1, pageSize: 20 });
    setData((prev) => ({ ...prev, ...contentData }));
  }, [activeKind]);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      await refreshContentData();
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "内容管理加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, refreshContentData, showNotice]);

  const runContentAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string, errorMessage: string) => {
      setListLoading(true);
      clearNotice();
      try {
        const result = await action();
        await refreshContentData();
        showNotice("success", getMessage(result, successMessage));
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : errorMessage);
      } finally {
        setListLoading(false);
      }
    },
    [clearNotice, refreshContentData, showNotice],
  );

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  return (
    <ContentPanel
      data={data}
      listLoading={listLoading}
      draft={contentDraft}
      setDraft={setContentDraft}
      activeKind={activeKind}
      setActiveKind={(nextKind) => {
        setActiveKind(nextKind);
        setContentDraft(emptyDraft(nextKind));
      }}
      onCreate={() => runContentAction(() => createContent(contentDraft), "内容已保存", "保存内容失败")}
      onUpdate={(id) =>
        runContentAction(() => updateContent(activeKind, id, contentDraft), "内容已保存", "保存内容失败")
      }
      onDelete={(kind, id) => runContentAction(() => deleteContent(kind, id), "内容已删除", "删除内容失败")}
    />
  );
}
