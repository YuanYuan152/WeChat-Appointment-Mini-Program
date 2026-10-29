"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchAssessments } from "@/services/assessments";
import type { AssessmentListItem } from "@/types/assessment";

export function AssessmentComposerBar({
  disabled,
  onCompose,
}: {
  disabled: boolean;
  onCompose: (title: string, assessmentIds: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [parents, setParents] = useState<AssessmentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [namingOpen, setNamingOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [nameError, setNameError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadParents() {
      setLoading(true);
      setLoadError("");
      try {
        const collected: AssessmentListItem[] = [];
        let page = 1;
        let total = 0;
        do {
          const result = await fetchAssessments({
            page,
            pageSize: 100,
            origin: "parent",
          });
          collected.push(...result.items);
          total = result.total;
          page += 1;
        } while (collected.length < total && page < 20);
        if (!cancelled) {
          setParents(collected);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "母量表加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadParents();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedParents = useMemo(
    () => parents.filter((item) => selectedIds.includes(item.id)),
    [parents, selectedIds],
  );

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function confirmCompose() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setNameError("请填写新量表名称");
      return;
    }
    if (selectedParents.length === 0) {
      setNameError("请先勾选母量表");
      return;
    }
    setSubmitting(true);
    setNameError("");
    try {
      await onCompose(
        nextTitle,
        selectedParents.map((item) => item.id),
      );
      setNamingOpen(false);
      setTitle("");
      setSelectedIds([]);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : "复制组合失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
      <div className="px-6 py-5 sm:px-7 lg:px-8">
        <button
          className="flex w-full items-start gap-3 text-left"
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          <svg
            aria-hidden="true"
            className={`mt-1 h-4 w-4 shrink-0 text-[var(--lxxl-muted)] transition ${open ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 16 16"
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
          <span>
            <h2 className="text-xl font-semibold tracking-normal">母量表选择</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
              展开后勾选母量表，复制组合为一份新量表。新量表只保存草稿，不会改动母量表，也不会自动发布。
            </p>
          </span>
        </button>

        {open && (
          <div className="mt-5">
            {loading ? (
              <p className="text-sm text-[var(--lxxl-muted)]">正在加载母量表...</p>
            ) : loadError ? (
              <p className="text-sm text-[#A13F37]">{loadError}</p>
            ) : parents.length === 0 ? (
              <p className="text-sm text-[var(--lxxl-muted)]">母量表管理中还没有量表。</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-[var(--lxxl-border)] p-3">
                {parents.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-[#FAF8F4]">
                      <input
                        checked={selectedIds.includes(item.id)}
                        className="mt-1"
                        type="checkbox"
                        onChange={() => toggle(item.id)}
                      />
                      <span>
                        <span className="block text-sm font-medium text-[var(--lxxl-ink)]">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-[var(--lxxl-muted)]">
                          {item.id} · {item.questionCount} 题 · {statusText(item.status)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button
                className="h-10 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled || submitting || selectedIds.length === 0}
                type="button"
                onClick={() => {
                  setNameError("");
                  setNamingOpen(true);
                }}
              >
                复制组合
              </button>
            </div>
          </div>
        )}
      </div>

      {namingOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold">为组合量表命名</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
              确认勾选的母量表。确定后，这些量表的题目会复制到新量表中。
            </p>
            <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm">
              {selectedParents.map((item) => (
                <li key={item.id}>{item.title}</li>
              ))}
            </ul>
            {selectedParents.length >= 2 && (
              <div className="mt-4 rounded-xl border border-[#E4D7B5] bg-[#FFF9EA] px-4 py-3 text-sm leading-6 text-[#6F5A24]">
                <div className="font-medium">注意事项</div>
                <p className="mt-1">
                  勾选了两张及以上母量表时，基础信息中的指导语、报告引导和免责声明会先放入可改的占位文案，人口学题不会沿用。请在发布版本前编辑填写准确内容，未补齐时无法发布。
                </p>
              </div>
            )}
            <label className="mt-4 block text-sm">
              <span className="mb-1.5 block font-medium">新量表名称</span>
              <input
                className="h-10 w-full rounded-xl border border-[var(--lxxl-border)] px-3 outline-none focus:border-[var(--lxxl-green)]"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            {nameError && <p className="mt-3 text-sm text-[#A13F37]">{nameError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="h-10 rounded-xl border border-[var(--lxxl-border)] px-4 text-sm"
                disabled={submitting}
                type="button"
                onClick={() => setNamingOpen(false)}
              >
                取消
              </button>
              <button
                className="h-10 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white disabled:opacity-40"
                disabled={submitting}
                type="button"
                onClick={() => void confirmCompose()}
              >
                {submitting ? "组合中..." : "确认组合"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function statusText(status: AssessmentListItem["status"]) {
  if (status === "published") return "已发布";
  if (status === "archived") return "已归档";
  return "草稿";
}
