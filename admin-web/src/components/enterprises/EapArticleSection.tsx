"use client";

import { useState } from "react";

import { ContentImageUpload, resolveImageUrl } from "@/components/content/ContentImageUpload";
import { QueryButton, QueryField, QueryResetButton, TableActionButton, queryControlClass } from "@/components/ui";
import {
  createEnterpriseEapArticle,
  createSharedEapArticle,
  deleteEnterpriseEapArticle,
  deleteSharedEapArticle,
  updateEnterpriseEapArticle,
  updateSharedEapArticle,
} from "@/services/assessmentEnterprises";
import type { EapArticle, EapArticleInput } from "@/types/api";

function tagsToText(tags: string[]) {
  return tags.join("，");
}

function textToTags(value: string) {
  return value
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function EapArticleSection({
  mode,
  enterpriseId,
  articles,
  onChange,
  divided = false,
}: {
  mode: "shared" | "enterprise";
  enterpriseId?: string;
  articles: EapArticle[];
  onChange: () => Promise<void>;
  divided?: boolean;
}) {
  const [editor, setEditor] = useState<EapArticle | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<EapArticle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const locked = mode === "enterprise" && !enterpriseId;

  const save = async (input: EapArticleInput) => {
    setBusy(true);
    setError("");
    try {
      if (mode === "shared") {
        if (editor?.id) {
          await updateSharedEapArticle(editor.id, input);
        } else {
          await createSharedEapArticle(input);
        }
      } else if (enterpriseId) {
        if (editor?.id) {
          await updateEnterpriseEapArticle(enterpriseId, editor.id, input);
        } else {
          await createEnterpriseEapArticle(enterpriseId, input);
        }
      }
      setEditor(undefined);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "图文保存失败");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "shared") {
        await deleteSharedEapArticle(pendingDelete.id);
      } else if (enterpriseId) {
        await deleteEnterpriseEapArticle(enterpriseId, pendingDelete.id);
      }
      setPendingDelete(null);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "图文删除失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={divided ? "mt-8 border-t border-[var(--lxxl-border)] pt-6" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <button
            aria-expanded={expanded}
            aria-label={expanded ? "收起图文" : "展开图文"}
            className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--lxxl-ink)] hover:bg-[#F4F1EB] hover:text-[var(--lxxl-green)]"
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            <svg
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">
              {mode === "shared" ? "通用EAP心理图文" : "心理图文"}
              <span className="ml-2 text-xs font-normal text-[var(--lxxl-muted)]">{articles.length} 篇</span>
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--lxxl-muted)]">
              {mode === "shared"
                ? "这里新增、修改或删除的图文会同步到所有企业页面。若某企业曾单独改过同一篇，通用保存后也会改回这份内容。"
                : "可以单独调整当前企业页面上的图文。修改和删除只影响这家企业，不会改动通用图文。"}
            </p>
          </div>
        </div>
        <button
          className="h-10 shrink-0 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white hover:bg-[var(--lxxl-green-dark)] disabled:opacity-60"
          disabled={locked || busy}
          type="button"
          onClick={() => {
            setError("");
            setEditor(null);
          }}
        >
          新增图文
        </button>
      </div>
      {locked && (
        <p className="mt-3 text-sm text-[var(--lxxl-muted)]">请先保存企业链接，再调整这家企业的图文。</p>
      )}
      {error && <p className="mt-3 text-sm text-[#A13F37]">{error}</p>}
      {expanded ? (
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--lxxl-border)]">
        {articles.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[var(--lxxl-muted)]">暂无心理图文。</div>
        ) : (
          articles.map((article) => (
            <div
              className="flex flex-wrap items-center gap-3 border-t border-[var(--lxxl-border)] px-4 py-3 first:border-t-0"
              key={article.id}
            >
              <div className="min-w-0 flex-1 truncate text-sm font-medium">{article.title}</div>
              {article.imageUrl ? (
                <img
                  alt=""
                  className="h-12 w-16 shrink-0 rounded-md object-cover"
                  src={resolveImageUrl(article.imageUrl)}
                />
              ) : (
                <div className="h-12 w-16 shrink-0 rounded-md bg-[#F7F5F2]" />
              )}
              <div className="flex min-w-[8rem] max-w-xs flex-1 flex-wrap gap-1">
                {article.tags.map((tag) => (
                  <span
                    className="rounded-md bg-[#F3F7F4] px-2 py-0.5 text-xs text-[var(--lxxl-green-dark)]"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {article.source === "override" && (
                <span className="text-xs text-[var(--lxxl-muted)]">本企业已改</span>
              )}
              {article.source === "local" && (
                <span className="text-xs text-[var(--lxxl-muted)]">仅本企业</span>
              )}
              <div className="flex shrink-0 gap-3">
                <TableActionButton
                  disabled={locked || busy}
                  onClick={() => {
                    setError("");
                    setEditor(article);
                  }}
                >
                  编辑
                </TableActionButton>
                <TableActionButton
                  disabled={locked || busy}
                  tone="danger"
                  onClick={() => {
                    setError("");
                    setPendingDelete(article);
                  }}
                >
                  删除
                </TableActionButton>
              </div>
            </div>
          ))
        )}
      </div>
      ) : null}
      {editor !== undefined && (
        <ArticleEditorDialog
          article={editor}
          busy={busy}
          onClose={() => setEditor(undefined)}
          onSave={save}
        />
      )}
      {pendingDelete && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-6">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">确认删除</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--lxxl-muted)]">
              {mode === "shared"
                ? `删除「${pendingDelete.title}」后，通用页面和所有企业页面都不再显示这篇图文。`
                : `只从当前企业页面移除「${pendingDelete.title}」，通用图文和其他企业不受影响。`}
            </p>
            <div className="mt-5 flex gap-3">
              <QueryButton className="!w-auto px-4" disabled={busy} onClick={() => void confirmDelete()}>
                {busy ? "删除中..." : "确认删除"}
              </QueryButton>
              <QueryResetButton disabled={busy} onClick={() => setPendingDelete(null)}>
                取消
              </QueryResetButton>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ArticleEditorDialog({
  article,
  busy,
  onClose,
  onSave,
}: {
  article: EapArticle | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: EapArticleInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(article?.title || "");
  const [imageUrl, setImageUrl] = useState(article?.imageUrl || "");
  const [body, setBody] = useState(article?.body || "");
  const [tagText, setTagText] = useState(tagsToText(article?.tags || []));
  const [duration, setDuration] = useState(article?.duration || "");
  const tags = textToTags(tagText);
  const ready = Boolean(title.trim() && imageUrl.trim() && body.trim() && duration.trim() && tags.length);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4 sm:p-8">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <h3 className="text-lg font-semibold">{article ? "编辑心理图文" : "新增心理图文"}</h3>
        <div className="mt-5 space-y-4">
          <QueryField label="标题" required>
            <input
              className={queryControlClass}
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </QueryField>
          <ContentImageUpload label="图片" required value={imageUrl} onChange={setImageUrl} />
          <QueryField label="文字" required>
            <textarea
              className={`${queryControlClass} !h-auto min-h-40 py-3`}
              maxLength={20000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </QueryField>
          <QueryField label="标签" required>
            <input
              className={queryControlClass}
              placeholder="多个标签用逗号或空格分隔"
              value={tagText}
              onChange={(event) => setTagText(event.target.value)}
            />
          </QueryField>
          <QueryField label="阅读时长" required>
            <input
              className={queryControlClass}
              maxLength={40}
              placeholder="例如 8 分钟阅读"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </QueryField>
        </div>
        <div className="mt-6 flex gap-3">
          <QueryButton
            disabled={busy || !ready}
            onClick={() =>
              void onSave({
                title: title.trim(),
                imageUrl: imageUrl.trim(),
                body: body.trim(),
                tags,
                duration: duration.trim(),
              })
            }
          >
            {busy ? "保存中..." : "保存"}
          </QueryButton>
          <QueryResetButton disabled={busy} onClick={onClose}>
            取消
          </QueryResetButton>
        </div>
      </section>
    </div>
  );
}
