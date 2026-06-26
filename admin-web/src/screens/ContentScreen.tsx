"use client";

import { useCallback, useEffect, useState } from "react";

import { createContent, deleteContent, fetchContentData, updateContent } from "@/services/content";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { ContentPanel } from "@/panels/ContentPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { ScreenData, ContentDraft, ContentKind } from "@/types/app";

export function ContentScreen() {
  return (
    <AppRoute sectionId="content">
      <ContentScreenContent />
    </AppRoute>
  );
}

function ContentScreenContent() {
  const { clearNotice, refreshKey, runAction, setLoading, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [activeKind, setActiveKind] = useState<ContentKind>("banner");
  const [articlePage, setArticlePage] = useState(1);
  const [articlePageSize, setArticlePageSize] = useState(DEFAULT_PAGE_SIZE);
  const [contentDraft, setContentDraft] = useState<ContentDraft>({
    kind: "banner",
    title: "",
    summary: "",
    imageUrl: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const contentData = await fetchContentData(activeKind, {
        page: articlePage,
        pageSize: articlePageSize,
      });
      setData((prev) => ({ ...prev, ...contentData }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "内容管理加载失败");
    } finally {
      setLoading(false);
    }
  }, [activeKind, articlePage, articlePageSize, clearNotice, setLoading, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  return (
    <ContentPanel
      data={data}
      draft={contentDraft}
      setDraft={setContentDraft}
      activeKind={activeKind}
      setActiveKind={(nextKind) => {
        setActiveKind(nextKind);
        setContentDraft({ kind: nextKind, title: "", summary: "", imageUrl: "" });
        if (nextKind === "article") {
          setArticlePage(1);
        }
      }}
      articlePage={articlePage}
      articlePageSize={articlePageSize}
      onArticlePageChange={setArticlePage}
      onArticlePageSizeChange={(nextPageSize) => {
        setArticlePage(1);
        setArticlePageSize(nextPageSize);
      }}
      onCreate={() => runAction(() => createContent(contentDraft), "内容已新增")}
      onUpdate={(id) => runAction(() => updateContent(activeKind, id, contentDraft), "内容已修改")}
      onDelete={(kind, id) => runAction(() => deleteContent(kind, id), "内容已删除")}
    />
  );
}
