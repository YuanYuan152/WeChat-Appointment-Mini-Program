import { apiRequest } from "@/lib/api";
import type { Activity, Article, Banner, PagedResult } from "@/types/api";

import type { ContentDraft, ContentKind, PaginationParams } from "@/types/app";

export async function fetchContentData(kind: ContentKind, articlePagination: PaginationParams) {
  if (kind === "banner") {
    const banners = await apiRequest<Banner[]>("/api/mini/ops/banners/manage");
    return { banners };
  }

  if (kind === "activity") {
    const activities = await apiRequest<Activity[]>("/api/mini/ops/activities");
    return { activities };
  }

  const articles = await apiRequest<PagedResult<Article>>(
    `/api/mini/ops/articles?page=${articlePagination.page}&page_size=${articlePagination.pageSize}`,
  );
  return { articles };
}

export function createContent(draft: ContentDraft) {
  if (!draft.title.trim()) {
    throw new Error("请输入标题");
  }

  if (draft.kind === "banner") {
    if (!draft.imageUrl.trim()) {
      throw new Error("Banner 需要图片地址");
    }
    return apiRequest("/api/mini/ops/banners", {
      method: "POST",
      body: JSON.stringify({
        title: draft.title,
        image_url: draft.imageUrl,
        link_type: "PAGE",
        is_active: true,
      }),
    });
  }

  if (draft.kind === "activity") {
    return apiRequest("/api/mini/ops/activities", {
      method: "POST",
      body: JSON.stringify({
        title: draft.title,
        content: draft.summary,
        cover_url: draft.imageUrl || undefined,
        type: "NOTICE",
        is_active: true,
      }),
    });
  }

  return apiRequest("/api/mini/ops/articles", {
    method: "POST",
    body: JSON.stringify({
      title: draft.title,
      summary: draft.summary,
      content: draft.summary,
      cover_url: draft.imageUrl || undefined,
      category: "文章",
      is_active: true,
    }),
  });
}

export function updateContent(kind: ContentKind, id: number, draft: ContentDraft) {
  if (!draft.title.trim()) {
    throw new Error("请输入标题");
  }

  if (kind === "banner") {
    if (!draft.imageUrl.trim()) {
      throw new Error("Banner 需要图片地址");
    }
    return apiRequest(`/api/mini/ops/banners/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: draft.title,
        image_url: draft.imageUrl,
        is_active: true,
      }),
    });
  }

  if (kind === "activity") {
    return apiRequest(`/api/mini/ops/activities/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: draft.title,
        content: draft.summary,
        cover_url: draft.imageUrl || undefined,
        type: "NOTICE",
        is_active: true,
      }),
    });
  }

  return apiRequest(`/api/mini/ops/articles/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      title: draft.title,
      summary: draft.summary,
      content: draft.summary,
      cover_url: draft.imageUrl || undefined,
      category: "文章",
      is_active: true,
    }),
  });
}

export function deleteContent(kind: "banner" | "activity" | "article", id: number) {
  const path =
    kind === "banner"
      ? `/api/mini/ops/banners/${id}`
      : kind === "activity"
        ? `/api/mini/ops/activities/${id}`
        : `/api/mini/ops/articles/${id}`;
  return apiRequest(path, { method: "DELETE" });
}
