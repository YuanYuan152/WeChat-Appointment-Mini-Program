import type { Dispatch, FormEvent, SetStateAction } from "react";

import { ContentImageUpload } from "@/components/content/ContentImageUpload";
import { getContentKindLabel, isSitePageKind } from "@/components/content/ContentTabs";
import type { ContentDraft, ContentKind } from "@/types/app";

function canSubmitDraft(activeKind: ContentKind, draft: ContentDraft) {
  if (activeKind === "banner") {
    return draft.title.trim() && draft.imageUrl.trim();
  }
  if (activeKind === "activity") {
    return draft.title.trim();
  }
  if (isSitePageKind(activeKind)) {
    return draft.body.trim();
  }
  if (activeKind === "consultation_guide") {
    return draft.title.trim() && draft.body.trim();
  }
  return false;
}

export function ContentCreateModal({
  open,
  activeKind,
  draft,
  setDraft,
  onClose,
  onCreate,
  mode = "create",
}: {
  open: boolean;
  activeKind: ContentKind;
  draft: ContentDraft;
  setDraft: Dispatch<SetStateAction<ContentDraft>>;
  onClose: () => void;
  onCreate: () => Promise<void> | void;
  mode?: "create" | "edit";
}) {
  if (!open) {
    return null;
  }

  const title = getContentKindLabel(activeKind);
  const actionText = mode === "edit" ? "保存" : isSitePageKind(activeKind) ? "保存" : "新建";
  const canSubmit = canSubmitDraft(activeKind, draft);
  const showTitleField = activeKind === "banner" || activeKind === "activity" || activeKind === "consultation_guide";
  const titleLabel = activeKind === "consultation_guide" ? "主题" : "标题";
  const bodyLabel = activeKind === "consultation_guide" ? "正文" : "正文";
  const showBodyField =
    activeKind === "activity" || isSitePageKind(activeKind) || activeKind === "consultation_guide";
  const showImageField = activeKind === "banner" || activeKind === "activity";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await onCreate();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4 py-6">
      <form
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-xl"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={`${actionText}${title}`}
      >
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">
            {actionText}
            {title}
          </h3>
          <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
            {mode === "edit" ? "保存后会同步到小程序前端。" : "保存后会创建并同步到小程序前端。"}
          </p>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
          {showTitleField && (
            <label className="block">
              <span className="text-sm font-medium">
                {titleLabel} <span className="text-[#B94A48]">*</span>
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                placeholder={activeKind === "consultation_guide" ? "请输入主题" : "请输入标题"}
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
          )}

          {showBodyField && (
            <label className="block">
              <span className="text-sm font-medium">
                {bodyLabel}
                {(isSitePageKind(activeKind) || activeKind === "consultation_guide") && (
                  <span className="ml-1 text-[#B94A48]">*</span>
                )}
              </span>
              <textarea
                className="mt-2 min-h-40 w-full resize-y rounded-xl border border-[var(--lxxl-border)] px-3 py-3 text-sm outline-none transition focus:border-[var(--lxxl-green)]"
                placeholder={
                  activeKind === "activity"
                    ? "请输入活动正文"
                    : "请输入正文，段落之间可用空行分隔"
                }
                value={isSitePageKind(activeKind) || activeKind === "consultation_guide" ? draft.body : draft.summary}
                onChange={(event) => {
                  const value = event.target.value;
                  if (isSitePageKind(activeKind) || activeKind === "consultation_guide") {
                    setDraft((prev) => ({ ...prev, body: value }));
                  } else {
                    setDraft((prev) => ({ ...prev, summary: value }));
                  }
                }}
              />
            </label>
          )}

          {showImageField && (
            <ContentImageUpload
              label={activeKind === "banner" ? "Banner 图片" : "封面图片"}
              required={activeKind === "banner"}
              value={draft.imageUrl}
              onChange={(url) => setDraft((prev) => ({ ...prev, imageUrl: url }))}
            />
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--lxxl-border)] px-6 py-4">
          <button
            className="rounded-xl border border-[var(--lxxl-border)] px-5 py-2 text-sm font-medium"
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="rounded-xl bg-[var(--lxxl-green)] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
            type="submit"
            disabled={!canSubmit}
          >
            {actionText}
          </button>
        </div>
      </form>
    </div>
  );
}
