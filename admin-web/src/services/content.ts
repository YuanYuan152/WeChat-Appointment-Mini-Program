import { apiRequest } from "@/lib/api";
import type { Activity, Banner, SiteGuideItem, SitePage } from "@/types/api";

import type { ContentDraft, ContentKind, PaginationParams } from "@/types/app";
import { sitePageKeyForKind } from "@/components/content/ContentTabs";

export async function fetchContentData(kind: ContentKind, _articlePagination: PaginationParams) {
  if (kind === "banner") {
    const banners = await apiRequest<Banner[]>("/api/mini/ops/banners/manage");
    return { banners };
  }

  if (kind === "activity") {
    const activities = await apiRequest<Activity[]>("/api/mini/ops/activities/manage");
    return { activities };
  }

  if (kind === "brand" || kind === "charity" || kind === "contact") {
    const sitePages = await apiRequest<SitePage[]>("/api/mini/ops/site-pages/manage");
    const pageKey = sitePageKeyForKind(kind);
    return { sitePages: sitePages.filter((page) => page.pageKey === pageKey) };
  }

  const siteGuideItems = await apiRequest<SiteGuideItem[]>("/api/mini/ops/site-guide-items/manage");
  return { siteGuideItems };
}

export function createContent(draft: ContentDraft) {
  if (draft.kind === "banner") {
    if (!draft.title.trim()) {
      throw new Error("请输入标题");
    }
    if (!draft.imageUrl.trim()) {
      throw new Error("请上传 Banner 图片");
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
    if (!draft.title.trim()) {
      throw new Error("请输入标题");
    }
    return apiRequest("/api/mini/ops/activities", {
      method: "POST",
      body: JSON.stringify({
        title: draft.title,
        content: draft.summary || draft.body,
        cover_url: draft.imageUrl || undefined,
        type: "NOTICE",
        is_active: true,
      }),
    });
  }

  if (draft.kind === "brand" || draft.kind === "charity" || draft.kind === "contact") {
    const pageKey = sitePageKeyForKind(draft.kind);
    if (!pageKey) {
      throw new Error("无效的站点页类型");
    }
    if (!draft.body.trim()) {
      throw new Error("请填写正文");
    }
    return apiRequest(`/api/mini/ops/site-pages/${pageKey}`, {
      method: "PUT",
      body: JSON.stringify({ body: draft.body }),
    });
  }

  if (!draft.title.trim()) {
    throw new Error("请填写主题");
  }
  if (!draft.body.trim()) {
    throw new Error("请填写正文");
  }
  return apiRequest("/api/mini/ops/site-guide-items", {
    method: "POST",
    body: JSON.stringify({
      title: draft.title,
      body: draft.body,
    }),
  });
}

export function updateContent(kind: ContentKind, id: number, draft: ContentDraft) {
  if (kind === "banner") {
    if (!draft.title.trim()) {
      throw new Error("请输入标题");
    }
    if (!draft.imageUrl.trim()) {
      throw new Error("请上传 Banner 图片");
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
    if (!draft.title.trim()) {
      throw new Error("请输入标题");
    }
    return apiRequest(`/api/mini/ops/activities/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: draft.title,
        content: draft.summary || draft.body,
        cover_url: draft.imageUrl || undefined,
        type: "NOTICE",
        is_active: true,
      }),
    });
  }

  if (kind === "brand" || kind === "charity" || kind === "contact") {
    const pageKey = sitePageKeyForKind(kind);
    if (!pageKey) {
      throw new Error("无效的站点页类型");
    }
    if (!draft.body.trim()) {
      throw new Error("请填写正文");
    }
    return apiRequest(`/api/mini/ops/site-pages/${pageKey}`, {
      method: "PUT",
      body: JSON.stringify({ body: draft.body }),
    });
  }

  if (!draft.title.trim()) {
    throw new Error("请填写主题");
  }
  if (!draft.body.trim()) {
    throw new Error("请填写正文");
  }
  return apiRequest(`/api/mini/ops/site-guide-items/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      title: draft.title,
      body: draft.body,
    }),
  });
}

export function deleteContent(kind: ContentKind, id: number) {
  if (kind === "banner") {
    return apiRequest(`/api/mini/ops/banners/${id}`, { method: "DELETE" });
  }
  if (kind === "activity") {
    return apiRequest(`/api/mini/ops/activities/${id}`, { method: "DELETE" });
  }
  if (kind === "consultation_guide") {
    return apiRequest(`/api/mini/ops/site-guide-items/${id}`, { method: "DELETE" });
  }
  throw new Error("该类型内容不支持删除");
}
