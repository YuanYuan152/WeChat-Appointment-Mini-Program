"use client";

import { useState } from "react";

import { QueryButton, QueryField, QueryResetButton, TableActionButton, queryControlClass } from "@/components/ui";
import {
  createEnterpriseEapAudio,
  createSharedEapAudio,
  deleteEnterpriseEapAudio,
  deleteSharedEapAudio,
  updateEnterpriseEapAudio,
  updateSharedEapAudio,
} from "@/services/assessmentEnterprises";
import type { EapAudio, EapAudioInput } from "@/types/api";

export function EapAudioSection({
  mode,
  enterpriseId,
  audios,
  onChange,
  divided = false,
}: {
  mode: "shared" | "enterprise";
  enterpriseId?: string;
  audios: EapAudio[];
  onChange: () => Promise<void>;
  divided?: boolean;
}) {
  const [editor, setEditor] = useState<EapAudio | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<EapAudio | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<{
    input: EapAudioInput;
    audioId: string;
    enterprises: Array<{ id: string; companyName: string }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const locked = mode === "enterprise" && !enterpriseId;

  const save = async (input: EapAudioInput, overwriteEnterpriseOverrides = false) => {
    setBusy(true);
    setError("");
    try {
      if (mode === "shared") {
        if (editor?.id) {
          const saved = await updateSharedEapAudio(editor.id, input, {
            overwriteEnterpriseOverrides,
          });
          if (saved.needsOverwriteConfirm && !overwriteEnterpriseOverrides) {
            setPendingOverwrite({
              input,
              audioId: editor.id,
              enterprises: saved.affectedEnterprises || [],
            });
            return;
          }
        } else {
          await createSharedEapAudio(input);
        }
      } else if (enterpriseId) {
        if (editor?.id) {
          await updateEnterpriseEapAudio(enterpriseId, editor.id, input);
        } else {
          await createEnterpriseEapAudio(enterpriseId, input);
        }
      }
      setEditor(undefined);
      setPendingOverwrite(null);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "音画保存失败");
    } finally {
      setBusy(false);
    }
  };

  const confirmOverwrite = async () => {
    if (!pendingOverwrite) return;
    setBusy(true);
    setError("");
    try {
      await updateSharedEapAudio(pendingOverwrite.audioId, pendingOverwrite.input, {
        overwriteEnterpriseOverrides: true,
      });
      setPendingOverwrite(null);
      setEditor(undefined);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "覆盖企业改稿失败");
    } finally {
      setBusy(false);
    }
  };

  const keepEnterpriseOverrides = async () => {
    // 通用库已在第一次保存时更新；选择不覆盖则关闭弹窗即可
    setPendingOverwrite(null);
    setEditor(undefined);
    await onChange();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "shared") {
        await deleteSharedEapAudio(pendingDelete.id);
      } else if (enterpriseId) {
        await deleteEnterpriseEapAudio(enterpriseId, pendingDelete.id);
      }
      setPendingDelete(null);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "音画删除失败");
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
            aria-label={expanded ? "收起音画" : "展开音画"}
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
              {mode === "shared" ? "通用EAP心理音画" : "心理音画"}
              <span className="ml-2 text-xs font-normal text-[var(--lxxl-muted)]">{audios.length} 条</span>
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--lxxl-muted)]">
              {mode === "shared"
                ? "这里新增、修改或删除的音画会作为各企业页面的默认内容。若某企业曾单独改过同一条，保存通用修改时会询问是否覆盖该企业改稿。"
                : "可以单独调整当前企业页面上的音画。修改和删除只影响这家企业，不会改动通用音画。"}
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
          新增音画
        </button>
      </div>
      {locked && (
        <p className="mt-3 text-sm text-[var(--lxxl-muted)]">请先保存企业链接，再调整这家企业的音画。</p>
      )}
      {error && <p className="mt-3 text-sm text-[#A13F37]">{error}</p>}
      {expanded ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--lxxl-border)]">
          {audios.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[var(--lxxl-muted)]">暂无心理音画。</div>
          ) : (
            audios.map((audio) => (
              <div
                className="flex flex-wrap items-center gap-3 border-t border-[var(--lxxl-border)] px-4 py-3 first:border-t-0"
                key={audio.id}
              >
                <div className="min-w-0 flex-1 truncate text-sm font-medium">{audio.title}</div>
                <div className="min-w-[6rem] text-xs text-[var(--lxxl-muted)]">
                  {audio.series || "未分系列"} · {audio.duration}
                </div>
                {audio.source === "override" && (
                  <span className="text-xs text-[var(--lxxl-muted)]">本企业已改</span>
                )}
                {audio.source === "local" && (
                  <span className="text-xs text-[var(--lxxl-muted)]">仅本企业</span>
                )}
                <div className="flex shrink-0 gap-3">
                  <TableActionButton
                    disabled={locked || busy}
                    onClick={() => {
                      setError("");
                      setEditor(audio);
                    }}
                  >
                    编辑
                  </TableActionButton>
                  <TableActionButton
                    disabled={locked || busy}
                    tone="danger"
                    onClick={() => {
                      setError("");
                      setPendingDelete(audio);
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
        <AudioEditorDialog
          audio={editor}
          busy={busy}
          onClose={() => setEditor(undefined)}
          onSave={(input) => void save(input, false)}
        />
      )}
      {pendingOverwrite && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-6">
          <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">是否覆盖企业定制音画？</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--lxxl-muted)]">
              通用音画已保存。以下 {pendingOverwrite.enterprises.length}{" "}
              家企业对该条有单独改稿。确认覆盖后，会把本次修改同步到这些企业对应的音画数据；选择保留则这些企业继续使用各自改稿。
            </p>
            <ul className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-[var(--lxxl-border)] px-3 py-2 text-sm">
              {pendingOverwrite.enterprises.map((item) => (
                <li className="border-b border-[var(--lxxl-border)] py-2 last:border-b-0" key={item.id}>
                  {item.companyName || item.id}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <QueryButton className="!w-auto px-4" disabled={busy} onClick={() => void confirmOverwrite()}>
                {busy ? "覆盖中..." : "确认覆盖"}
              </QueryButton>
              <QueryResetButton disabled={busy} onClick={() => void keepEnterpriseOverrides()}>
                保留企业改稿
              </QueryResetButton>
            </div>
          </section>
        </div>
      )}
      {pendingDelete && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-6">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">确认删除</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--lxxl-muted)]">
              {mode === "shared"
                ? `删除「${pendingDelete.title}」后，通用页面和所有企业页面都不再显示这条音画。`
                : `只从当前企业页面移除「${pendingDelete.title}」，通用音画和其他企业不受影响。`}
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

function AudioEditorDialog({
  audio,
  busy,
  onClose,
  onSave,
}: {
  audio: EapAudio | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: EapAudioInput) => void;
}) {
  const [title, setTitle] = useState(audio?.title || "");
  const [audioUrl, setAudioUrl] = useState(audio?.audioUrl || "");
  const [description, setDescription] = useState(audio?.description || "");
  const [series, setSeries] = useState(audio?.series || "");
  const [duration, setDuration] = useState(audio?.duration || "");
  const ready = Boolean(title.trim() && audioUrl.trim() && description.trim() && duration.trim());

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4 sm:p-8">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <h3 className="text-lg font-semibold">{audio ? "编辑心理音画" : "新增心理音画"}</h3>
        <div className="mt-5 space-y-4">
          <QueryField label="标题" required>
            <input
              className={queryControlClass}
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </QueryField>
          <QueryField label="音频地址" required>
            <input
              className={queryControlClass}
              maxLength={800}
              placeholder="填写可访问的音频 URL（如 mp3）"
              value={audioUrl}
              onChange={(event) => setAudioUrl(event.target.value)}
            />
          </QueryField>
          <QueryField label="简介" required>
            <textarea
              className={`${queryControlClass} !h-auto min-h-28 py-3`}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </QueryField>
          <QueryField label="系列">
            <input
              className={queryControlClass}
              maxLength={40}
              placeholder="例如 晚安心灵"
              value={series}
              onChange={(event) => setSeries(event.target.value)}
            />
          </QueryField>
          <QueryField label="播放时长" required>
            <input
              className={queryControlClass}
              maxLength={40}
              placeholder="例如 10 分钟"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </QueryField>
        </div>
        <div className="mt-6 flex gap-3">
          <QueryButton
            disabled={busy || !ready}
            onClick={() =>
              onSave({
                title: title.trim(),
                audioUrl: audioUrl.trim(),
                description: description.trim(),
                series: series.trim(),
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
