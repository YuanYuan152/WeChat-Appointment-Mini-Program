"use client";

import { useEffect, useId, useState } from "react";

import { FollowUpChip, SeverityChip } from "@/components/enterpriseData/ui";
import {
  FOLLOW_UP_KEYS,
  FOLLOW_UP_META,
  SEVERITY_KEYS,
  SEVERITY_META,
  chinaDateTimeText,
  formatScore,
} from "@/lib/enterpriseData";
import type {
  EnterpriseFollowUpInput,
  EnterpriseReportItem,
  EnterpriseRespondent,
  FollowUpStatus,
  Severity,
} from "@/types/enterpriseData";

export function FollowUpDialog({
  report,
  respondent,
  onClose,
  onSave,
}: {
  report: EnterpriseReportItem;
  respondent?: EnterpriseRespondent;
  onClose: () => void;
  onSave: (input: EnterpriseFollowUpInput) => Promise<void>;
}) {
  const titleId = useId();
  const [status, setStatus] = useState<FollowUpStatus>(report.followUp?.status || "pending");
  const [override, setOverride] = useState<Severity | "">(report.followUp?.severityOverride || "");
  const [owner, setOwner] = useState(report.followUp?.owner || "");
  const [note, setNote] = useState(report.followUp?.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // 捕获阶段拦截 Esc，避免同时关掉下面的员工档案抽屉。
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (!saving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose, saving]);

  const history = [...(report.followUp?.history || [])].reverse();

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/35 px-4 py-6"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-2xl"
        role="dialog"
      >
        <div className="border-b border-[var(--lxxl-border)] px-6 py-4">
          <h3 id={titleId} className="text-lg font-semibold">
            风险跟进 · {respondent?.displayName || "填写者"}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--lxxl-muted)]">
            <span>{report.assessmentTitle}</span>
            <span>·</span>
            <span>完成于 {chinaDateTimeText(report.completedAt)}</span>
            <span>·</span>
            <span>{report.risk?.severity ? "风险维度判定" : "自动识别"}</span>
            <SeverityChip severity={report.autoSeverity} size="xs" />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm leading-6 text-[#4A4A4A]">
            {report.triggers.length > 0
              ? report.triggers.map((item) => (
                  <div key={`${item.title}-${item.level}`}>
                    <b className="font-semibold" style={{ color: SEVERITY_META[item.severity].color }}>
                      {item.title}
                    </b>
                    ：{item.level}
                    {item.score !== null ? `（${formatScore(item.score)} 分）` : ""}
                  </div>
                ))
              : report.summary || "该答卷未触发自动风险条目"}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-[var(--lxxl-muted)]">跟进状态</span>
              <select
                className="h-10 w-full rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none focus:border-[var(--lxxl-green)]"
                value={status}
                onChange={(event) => setStatus(event.target.value as FollowUpStatus)}
              >
                {FOLLOW_UP_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {FOLLOW_UP_META[key].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-[var(--lxxl-muted)]">风险等级</span>
              <select
                className="h-10 w-full rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none focus:border-[var(--lxxl-green)]"
                value={override}
                onChange={(event) => setOverride(event.target.value as Severity | "")}
              >
                <option value="">
                  沿用自动识别（{report.autoSeverity ? SEVERITY_META[report.autoSeverity].label : "未分级"}）
                </option>
                {SEVERITY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    人工调整为：{SEVERITY_META[key].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-medium text-[var(--lxxl-muted)]">跟进人 / 咨询师</span>
              <input
                className="h-10 w-full rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none focus:border-[var(--lxxl-green)]"
                maxLength={50}
                placeholder="例如：周咨询师"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-medium text-[var(--lxxl-muted)]">处理记录</span>
              <textarea
                className="min-h-24 w-full resize-y rounded-xl border border-[var(--lxxl-border)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--lxxl-green)]"
                maxLength={2000}
                placeholder="例如：已电话联系，约定本周五进行首次咨询"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>

          {history.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium text-[var(--lxxl-muted)]">跟进历史</div>
              <ol className="space-y-2 border-l-2 border-[var(--lxxl-border)] pl-4">
                {history.map((item, index) => (
                  <li key={`${item.at}-${index}`} className="text-xs leading-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <FollowUpChip size="xs" status={item.status} />
                      {item.severityOverride && <SeverityChip severity={item.severityOverride} size="xs" />}
                      <span className="text-[var(--lxxl-muted)]">
                        {item.by || "工作人员"} · {chinaDateTimeText(item.at)}
                      </span>
                    </div>
                    {(item.owner || item.note) && (
                      <div className="mt-1 text-[#4A4A4A]">
                        {item.owner ? `跟进人：${item.owner}　` : ""}
                        {item.note}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {error && <p className="text-sm text-[#A13F37]">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--lxxl-border)] px-6 py-4">
          <button
            className="h-10 rounded-xl border border-[var(--lxxl-border)] px-5 text-sm font-medium text-[var(--lxxl-muted)] hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
            disabled={saving}
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="h-10 rounded-xl bg-[var(--lxxl-green)] px-5 text-sm font-medium text-white hover:bg-[var(--lxxl-green-dark)] disabled:opacity-60"
            disabled={saving}
            type="button"
            onClick={() => {
              setSaving(true);
              setError("");
              void onSave({ status, severityOverride: override || null, owner: owner.trim(), note: note.trim() })
                .catch((caught) => setError(caught instanceof Error ? caught.message : "保存失败"))
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "正在保存..." : "保存跟进"}
          </button>
        </div>
      </section>
    </div>
  );
}
