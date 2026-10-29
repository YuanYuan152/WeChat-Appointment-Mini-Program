"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { AssessmentImageField } from "@/components/assessments/AssessmentImageField";
import { Badge, QueryField, queryControlClass } from "@/components/ui";
import {
  changeAssessmentScoringType,
  buildSourceReports,
  COMPOSED_MERGED_SOURCE_ID,
  COMPOSED_MERGED_SOURCE_TITLE,
  createDefaultAssessmentDefinition,
  createStableId,
  getAssessmentScoreCoverageSummaries,
  getDimensionParentId,
  getQuestionInputType,
  isFixedScoringType,
  normalizeAssessmentDefinition,
  formatLines,
  parseLines,
  removeComposedQuestions,
  syncComposedSourceReports,
  type AssessmentScoreCoverageSummary,
  type ComposedQuestionRemovalMode,
  validateAssessmentDefinition,
} from "@/lib/assessmentEditor";
import {
  compileDimensionFormula,
  formulaQuestionIds,
  removeFormulaQuestionId,
  replaceFormulaQuestionId,
} from "@/lib/assessmentFormula";
import { formatFullDateTime } from "@/lib/format";
import { fetchAssessmentDetail } from "@/services/assessments";
import type { AssessmentEditorMode } from "@/panels/AssessmentsPanel";
import type {
  AssessmentAdminDetail,
  AssessmentDefinition,
  AssessmentDemographicInputType,
  AssessmentDemographicQuestion,
  AssessmentDimension,
  AssessmentMatchResult,
  AssessmentOption,
  AssessmentOptionFollowUp,
  AssessmentQuestion,
  AssessmentQuestionInputType,
  AssessmentReportProfile,
  AssessmentScoreMode,
  AssessmentScoreRange,
  AssessmentScoringType,
  AssessmentValidationIssue,
} from "@/types/assessment";

type EditorTab = "basic" | "demographics" | "questions" | "results" | "advanced" | "versions";

const textareaClass = `${queryControlClass} h-auto min-h-24 resize-y py-3`;
const compactInputClass =
  "h-9 w-full rounded-lg border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--lxxl-green)] disabled:cursor-not-allowed disabled:bg-[#F7F5F2] disabled:text-[var(--lxxl-muted)]";
const compactTextareaClass = `${compactInputClass} h-auto min-h-20 resize-y py-2`;

export function AssessmentEditorDialog({
  detail,
  detailLoading,
  actionLoading,
  initialMode,
  startOnQuestions = false,
  onClose,
  onSave,
  onPublish,
  onArchive,
  onRestoreVersion,
}: {
  detail?: AssessmentAdminDetail;
  detailLoading: boolean;
  actionLoading: boolean;
  initialMode: Exclude<AssessmentEditorMode, null>;
  startOnQuestions?: boolean;
  onClose: () => void;
  onSave: (definition: AssessmentDefinition) => Promise<AssessmentAdminDetail | undefined>;
  onPublish: (detail: AssessmentAdminDetail) => Promise<AssessmentAdminDetail | undefined>;
  onArchive: (detail: AssessmentAdminDetail) => Promise<AssessmentAdminDetail | undefined>;
  onRestoreVersion: (
    detail: AssessmentAdminDetail,
    version: number,
  ) => Promise<AssessmentAdminDetail | undefined>;
}) {
  const isCreate = initialMode === "create";
  const initialDefinition = useMemo(
    () =>
      normalizeAssessmentDefinition(
        detail?.definition || createDefaultAssessmentDefinition("sum"),
      ),
    [detail?.definition],
  );
  const [currentDetail, setCurrentDetail] = useState(detail);
  const [definition, setDefinition] = useState<AssessmentDefinition>(initialDefinition);
  const [baseline, setBaseline] = useState(() => serializeDefinition(initialDefinition));
  const [activeTab, setActiveTab] = useState<EditorTab>(
    initialMode === "versions" ? "versions" : startOnQuestions ? "questions" : "basic",
  );
  const [jsonDraft, setJsonDraft] = useState(() => serializeDefinition(initialDefinition));
  const [localError, setLocalError] = useState("");
  const [activeUploads, setActiveUploads] = useState(0);
  const closeRef = useRef<() => void>(() => undefined);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const undoStackRef = useRef<string[]>([]);
  const coalesceFieldRef = useRef<string | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [publishIssues, setPublishIssues] = useState<AssessmentValidationIssue[]>([]);

  const serializedDefinition = useMemo(() => serializeDefinition(definition), [definition]);
  const dirty = serializedDefinition !== baseline;
  const coverageSummaries = useMemo(
    () => getAssessmentScoreCoverageSummaries(definition),
    [definition],
  );
  const issues = useMemo(
    () => validateAssessmentDefinition(definition, coverageSummaries),
    [coverageSummaries, definition],
  );
  const blockingIssues = issues.filter((issue) => issue.severity === "error");
  const fixedScoring = isFixedScoringType(definition.scoringType);
  const archived = currentDetail?.lifecycleStatus === "archived";
  const composeMode = Boolean(definition.composedFrom?.length);
  const visibleIssues = publishIssues.length > 0 ? publishIssues : composeMode ? [] : blockingIssues;
  const uploading = activeUploads > 0;
  const editorDisabled = Boolean(archived || actionLoading || uploading);

  const handleUploadStateChange = useCallback((delta: number) => {
    setActiveUploads((count) => Math.max(0, count + delta));
  }, []);

  const resetUndoHistory = useCallback(() => {
    undoStackRef.current = [];
    coalesceFieldRef.current = null;
    setUndoCount(0);
  }, []);

  useEffect(() => {
    if (!detail || detail.revision === currentDetail?.revision) {
      return;
    }
    setCurrentDetail(detail);
    const nextDefinition = normalizeAssessmentDefinition(detail.definition);
    setDefinition(nextDefinition);
    const nextBaseline = serializeDefinition(nextDefinition);
    setBaseline(nextBaseline);
    setJsonDraft(nextBaseline);
    setLocalError("");
    resetUndoHistory();
  }, [currentDetail?.revision, detail, resetUndoHistory]);

  const attemptClose = useCallback(() => {
    if (actionLoading || uploading) {
      return;
    }
    if (dirty && !window.confirm("当前量表还有未保存的修改，确定关闭吗？")) {
      return;
    }
    onClose();
  }, [actionLoading, dirty, onClose, uploading]);

  useEffect(() => {
    if (!composeMode || definition.sourceReports?.length || !definition.composedFrom?.length) {
      return;
    }
    let cancelled = false;
    void Promise.all(
      definition.composedFrom.map((source) =>
        fetchAssessmentDetail(source.id).then((detail) => detail.definition).catch(() => null),
      ),
    ).then((parents) => {
      if (cancelled) {
        return;
      }
      const loaded = parents.filter((item): item is AssessmentDefinition => Boolean(item));
      if (loaded.length === 0) {
        return;
      }
      setDefinition((current) => {
        if (current.sourceReports?.length) {
          return current;
        }
        const next = { ...current, sourceReports: buildSourceReports(current, loaded) };
        setBaseline(serializeDefinition(next));
        setJsonDraft(serializeDefinition(next));
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [composeMode, definition.composedFrom, definition.sourceReports?.length]);

  useEffect(() => {
    closeRef.current = attemptClose;
  }, [attemptClose]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements.at(-1) || first;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const clearCoalesce = () => {
      coalesceFieldRef.current = null;
    };
    document.addEventListener("focusout", clearCoalesce);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusout", clearCoalesce);
      document.body.style.overflow = originalOverflow;
      previousActiveElement?.focus();
    };
  }, []);

  const draftUndoOffered =
    composeMode && currentDetail?.lifecycleStatus === "draft" && !archived;
  const canTrackUndo =
    draftUndoOffered &&
    (!definition.composedFrom?.length || Boolean(definition.sourceReports?.length));

  function updateDefinition(next: AssessmentDefinition) {
    const serializedNext = serializeDefinition(next);
    const previous = serializeDefinition(definition);
    if (serializedNext === previous) {
      return;
    }
    if (canTrackUndo) {
      const signature = changeSignature(definition, next);
      const sameTextBurst =
        Boolean(signature) &&
        !signature?.structural &&
        signature?.path === coalesceFieldRef.current;
      if (!sameTextBurst) {
        undoStackRef.current = [...undoStackRef.current, previous].slice(-50);
        setUndoCount(undoStackRef.current.length);
      }
      coalesceFieldRef.current = signature && !signature.structural ? signature.path : null;
    }
    setDefinition(next);
    if (activeTab !== "advanced") {
      setJsonDraft(serializedNext);
    }
    setLocalError("");
    setPublishIssues([]);
  }

  function undoLastEdit() {
    const previous = undoStackRef.current.pop();
    if (!previous || !draftUndoOffered || editorDisabled) {
      if (previous) {
        undoStackRef.current.push(previous);
      }
      return;
    }
    coalesceFieldRef.current = null;
    setUndoCount(undoStackRef.current.length);
    setDefinition(JSON.parse(previous) as AssessmentDefinition);
    setJsonDraft(previous);
    setLocalError("");
  }

  function applyDetail(next: AssessmentAdminDetail) {
    setCurrentDetail(next);
    setDefinition(next.definition);
    const nextBaseline = serializeDefinition(next.definition);
    setBaseline(nextBaseline);
    setJsonDraft(nextBaseline);
    setLocalError("");
    resetUndoHistory();
  }

  async function save(nextDefinition: AssessmentDefinition = definition) {
    if (uploading) {
      setLocalError("图片仍在上传，请等待上传完成后再保存。");
      return undefined;
    }
    if (composeMode) {
      if (nextDefinition.questions.length < 1) {
        updateDefinition(nextDefinition);
        setLocalError("至少需要一道量表题目，再保存草稿。");
        return undefined;
      }
      const result = await onSave(nextDefinition);
      if (result) {
        applyDetail(result);
        setPublishIssues([]);
      }
      return result;
    }
    const summaries = getAssessmentScoreCoverageSummaries(nextDefinition);
    const nextBlocking = validateAssessmentDefinition(nextDefinition, summaries).filter(
      (issue) => issue.severity === "error",
    );
    if (nextBlocking.length > 0) {
      updateDefinition(nextDefinition);
      setLocalError(`请先处理 ${nextBlocking.length} 项校验问题，再保存草稿。`);
      return undefined;
    }
    const result = await onSave(nextDefinition);
    if (result) {
      applyDetail(result);
    }
    return result;
  }

  async function publish() {
    if (uploading || !currentDetail || dirty || !currentDetail.draftVersion) {
      return;
    }
    const prepared = composeMode ? syncComposedSourceReports(definition) : definition;
    const summaries = getAssessmentScoreCoverageSummaries(prepared);
    const nextBlocking = validateAssessmentDefinition(prepared, summaries).filter(
      (issue) => issue.severity === "error",
    );
    if (nextBlocking.length > 0) {
      setPublishIssues(nextBlocking);
      setLocalError(
        composeMode
          ? `发布前需要补齐 ${nextBlocking.length} 项。请到报告结果中点击对应结果项打开详细信息，补全解释和分数区间，并完善题目内容。`
          : `发布前需要处理 ${nextBlocking.length} 项校验问题。`,
      );
      if (composeMode) {
        setActiveTab("results");
      }
      return;
    }
    if (!window.confirm(`确定发布 ${definition.title || definition.id} 的 v${currentDetail.draftVersion} 草稿吗？`)) {
      return;
    }
    let detailToPublish = currentDetail;
    if (composeMode && serializeDefinition(prepared) !== serializeDefinition(definition)) {
      const saved = await onSave(prepared);
      if (!saved) {
        return;
      }
      applyDetail(saved);
      detailToPublish = saved;
    }
    const result = await onPublish(detailToPublish);
    if (result) {
      applyDetail(result);
    }
  }

  async function archive() {
    if (uploading || !currentDetail || archived) {
      return;
    }
    if (
      !window.confirm(
        composeMode
          ? "撤销前端展示后，EAP 用户将无法继续打开该量表，确定继续吗？"
          : "归档后 EAP 用户将无法继续打开该量表，确定归档吗？",
      )
    ) {
      return;
    }
    const result = await onArchive(currentDetail);
    if (result) {
      applyDetail(result);
      onClose();
    }
  }

  async function restoreVersion(version: number) {
    if (uploading || !currentDetail) {
      return;
    }
    const restoreImpact = currentDetail.draftVersion
      ? `当前 v${currentDetail.draftVersion} 草稿会先备份，再由历史内容覆盖。`
      : archived
        ? "历史内容会复制为草稿；完成编辑并发布后，量表会重新启用。"
        : "历史内容会复制为一个新的草稿。";
    if (!window.confirm(`确定恢复已发布的 v${version} 吗？${restoreImpact}`)) {
      return;
    }
    const result = await onRestoreVersion(currentDetail, version);
    if (result) {
      applyDetail(result);
      setActiveTab("basic");
    }
  }

  function switchTab(tab: EditorTab) {
    if (uploading) {
      return;
    }
    if (tab === "advanced") {
      setJsonDraft(serializedDefinition);
    }
    setActiveTab(tab);
    setLocalError("");
  }

  const title = isCreate
    ? "新增量表"
    : `${definition.title || definition.id || "量表"} · ${initialMode === "versions" ? "版本管理" : "编辑"}`;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-3 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          attemptClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        aria-label={title}
        aria-modal="true"
        className="flex h-[min(92vh,980px)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-2xl"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--lxxl-border)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{title}</h3>
              {!isCreate && currentDetail && (
                <Badge tone={lifecycleTone(currentDetail.lifecycleStatus)}>
                  {lifecycleLabel(currentDetail.lifecycleStatus)}
                </Badge>
              )}
              {dirty && <Badge tone="gold">有未保存修改</Badge>}
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
              {fixedScoring
                ? "固定计分量表已锁定题目 ID、选项分值和计分模板，只编辑展示文案。"
                : "保存只更新草稿；点击发布后，EAP 用户才会读取新版本。"}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            aria-label="关闭"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-2xl leading-none text-[var(--lxxl-muted)] transition hover:bg-[#FAF8F4] hover:text-[var(--lxxl-text)] disabled:opacity-40"
            disabled={actionLoading || uploading}
            title="关闭"
            type="button"
            onClick={attemptClose}
          >
            ×
          </button>
        </header>

        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--lxxl-border)] bg-[#FAF8F4] px-4 pt-2 sm:px-6">
          {editorTabs.map((tab) => (
            <button
              key={tab.id}
              className={`whitespace-nowrap rounded-t-xl px-4 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border border-b-white border-[var(--lxxl-border)] bg-white text-[var(--lxxl-green)]"
                  : "text-[var(--lxxl-muted)] hover:text-[var(--lxxl-text)]"
              }`}
              disabled={uploading}
              type="button"
              onClick={() => switchTab(tab.id)}
            >
              {tab.label}
              {tab.id === "demographics" && `（${definition.demographicQuestions?.length || 0}）`}
              {tab.id === "questions" && `（${definition.questions.length}）`}
              {tab.id === "versions" && `（${currentDetail?.versions.length || 0}）`}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {detailLoading && !isCreate && !currentDetail ? (
            <div className="grid min-h-64 place-items-center text-sm text-[var(--lxxl-muted)]">
              正在加载量表详情...
            </div>
          ) : (
            <>
              {archived && (
                <div className="mb-5 rounded-xl border border-[#E8B7B2] bg-[#FFF5F4] px-4 py-3 text-sm leading-6 text-[#8F3832]">
                  该量表已归档并停止对外展示。可以在“历史版本”中恢复为草稿，完成编辑并发布后重新启用。
                </div>
              )}
              {activeTab === "basic" && (
                <BasicFields
                  definition={definition}
                  disabled={editorDisabled}
                  fixedScoring={fixedScoring}
                  isCreate={isCreate}
                  onChange={updateDefinition}
                  onUploadStateChange={handleUploadStateChange}
                />
              )}
              {activeTab === "demographics" && (
                <DemographicFields
                  definition={definition}
                  disabled={editorDisabled}
                  fixedStructure={false}
                  onChange={updateDefinition}
                />
              )}
              {activeTab === "questions" && (
                <QuestionFields
                  definition={definition}
                  disabled={editorDisabled}
                  fixedStructure={fixedScoring}
                  onChange={updateDefinition}
                  onPersist={save}
                />
              )}
              {activeTab === "results" && (
                <ResultFields
                  composeMode={composeMode}
                  coverageSummaries={coverageSummaries}
                  definition={definition}
                  disabled={editorDisabled}
                  fixedStructure={fixedScoring}
                  onChange={updateDefinition}
                  onUploadStateChange={handleUploadStateChange}
                />
              )}
              {activeTab === "advanced" && (
                <AdvancedJsonEditor
                  fixedScoring={fixedScoring}
                  jsonDraft={jsonDraft}
                />
              )}
              {activeTab === "versions" && (
                <VersionsPanel
                  archived={archived}
                  detail={currentDetail}
                  loading={detailLoading || actionLoading || uploading}
                  onRestore={restoreVersion}
                />
              )}
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-[var(--lxxl-border)] bg-white px-5 py-4 sm:px-6">
          {uploading && (
            <div
              aria-live="polite"
              className="mb-3 rounded-xl border border-[#CFE1D6] bg-[#F2F7F4] px-4 py-3 text-sm text-[var(--lxxl-green)]"
            >
              图片上传中，请等待上传完成后再保存、发布或关闭窗口。
            </div>
          )}
          {(localError || visibleIssues.length > 0) && (
            <div className="mb-3 rounded-xl bg-[#FFF5F4] px-4 py-3 text-sm text-[#A13F37]">
              {localError || `当前有 ${visibleIssues.length} 项内容需要完善。`}
              {visibleIssues.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                  {visibleIssues.slice(0, 6).map((issue) => (
                    <li key={`${issue.path}-${issue.message}`}>
                      {issue.path ? `${issue.path}：` : ""}
                      {issue.message}
                    </li>
                  ))}
                  {visibleIssues.length > 6 && <li>另有 {visibleIssues.length - 6} 项未显示</li>}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--lxxl-muted)]">
              {currentDetail
                ? `发布版本 ${currentDetail.publishedVersion ? `v${currentDetail.publishedVersion}` : "-"} · 草稿版本 ${
                    currentDetail.draftVersion ? `v${currentDetail.draftVersion}` : "-"
                  }`
                : "新量表首次保存后生成 v1 草稿"}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              {draftUndoOffered && (
                <ActionHint
                  hint={
                    undoCount > 0
                      ? "退回这次打开后还没保存的上一步。撤回只改页面上的草稿，需要再点保存才会写入。"
                      : "还没有可撤回的修改。保存或重新打开后，之前的撤回记录不会保留。"
                  }
                >
                  <button
                    className={`h-10 rounded-xl border px-4 text-sm font-medium transition ${
                      undoCount > 0 && !editorDisabled
                        ? "border-[var(--lxxl-green)] bg-[#F2F7F4] text-[var(--lxxl-green)] hover:bg-[var(--lxxl-green)] hover:text-white"
                        : "cursor-not-allowed border-[var(--lxxl-border)] text-[var(--lxxl-muted)] opacity-40"
                    }`}
                    disabled={undoCount === 0 || editorDisabled}
                    type="button"
                    onClick={undoLastEdit}
                  >
                    撤回
                  </button>
                </ActionHint>
              )}
              <ActionHint
                hint={
                  composeMode
                    ? "关闭当前编辑窗口。如果还有未保存的修改，会先询问是否放弃。"
                    : undefined
                }
              >
                <button
                  className="h-10 rounded-xl border border-[var(--lxxl-border)] px-4 text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)] disabled:opacity-40"
                  disabled={actionLoading || uploading}
                  type="button"
                  onClick={attemptClose}
                >
                  {composeMode ? "关闭窗口" : "关闭"}
                </button>
              </ActionHint>
              {currentDetail && !archived && (
                <ActionHint
                  hint={
                    composeMode
                      ? "让这份量表从 EAP 前端下线，用户将不能继续打开。后台仍可查看已保存内容。"
                      : undefined
                  }
                >
                  <button
                    className="h-10 rounded-xl border border-[#E8B7B2] px-4 text-sm font-medium text-[#A13F37] transition hover:bg-[#FFF5F4] disabled:opacity-40"
                    disabled={actionLoading || uploading}
                    type="button"
                    onClick={() => void archive()}
                  >
                    {composeMode ? "撤销前端展示" : "取消前端展示"}
                  </button>
                </ActionHint>
              )}
              {!archived && (
                <ActionHint
                  hint={
                    composeMode
                      ? "把当前已保存的草稿发布到前端。若还有未保存修改，需要先点保存。"
                      : undefined
                  }
                >
                  <button
                    className="h-10 rounded-xl border border-[var(--lxxl-green)] px-4 text-sm font-medium text-[var(--lxxl-green)] transition hover:bg-[#F2F7F4] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={actionLoading || uploading || !currentDetail?.draftVersion || dirty}
                    title={
                      composeMode
                        ? undefined
                        : dirty
                          ? "请先保存当前修改"
                          : currentDetail?.draftVersion
                            ? "发布当前草稿"
                            : "当前没有可发布草稿"
                    }
                    type="button"
                    onClick={() => void publish()}
                  >
                    发布版本
                  </button>
                </ActionHint>
              )}
              {!archived && activeTab !== "versions" && (
                <ActionHint
                  hint={composeMode ? "把当前编辑内容存为草稿，不会发布到前端。" : undefined}
                >
                  <button
                    className="h-10 rounded-xl bg-[var(--lxxl-green)] px-5 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={
                      actionLoading ||
                      uploading ||
                      (!composeMode && blockingIssues.length > 0) ||
                      (!dirty && Boolean(currentDetail))
                    }
                    type="button"
                    onClick={() => void save()}
                  >
                    {actionLoading ? "处理中..." : isCreate && !currentDetail ? "创建草稿" : "保存"}
                  </button>
                </ActionHint>
              )}
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}

const editorTabs: Array<{ id: EditorTab; label: string }> = [
  { id: "basic", label: "基础信息" },
  { id: "demographics", label: "人口学题" },
  { id: "questions", label: "正式题目" },
  { id: "results", label: "报告结果" },
  { id: "advanced", label: "高级 JSON" },
  { id: "versions", label: "历史版本" },
];

function BasicFields({
  definition,
  isCreate,
  fixedScoring,
  disabled,
  onChange,
  onUploadStateChange,
}: {
  definition: AssessmentDefinition;
  isCreate: boolean;
  fixedScoring: boolean;
  disabled: boolean;
  onChange: (definition: AssessmentDefinition) => void;
  onUploadStateChange: (delta: number) => void;
}) {
  function patch(values: Partial<AssessmentDefinition>) {
    onChange({ ...definition, ...values });
  }

  return (
    <div className="space-y-5">
      <EditorSection
        description="量表 ID 首次保存后不可修改；新建量表只支持总分、维度和匹配三种通用计分方式。"
        title="标识与分类"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QueryField label="量表 ID" required>
            <input
              className={queryControlClass}
              disabled={disabled || !isCreate}
              maxLength={54}
              placeholder="例如 wellbeing-index"
              value={definition.id}
              onChange={(event) => patch({ id: event.target.value.toLowerCase() })}
            />
          </QueryField>
          <QueryField label="量表类型" required>
            <select
              className={queryControlClass}
              disabled={disabled || fixedScoring}
              value={definition.category}
              onChange={(event) =>
                patch({ category: event.target.value as AssessmentDefinition["category"] })
              }
            >
              <option value="professional">专业量表</option>
              <option value="fun">趣味量表</option>
            </select>
          </QueryField>
          <QueryField label="计分方式" required>
            <select
              className={queryControlClass}
              disabled={disabled || fixedScoring}
              value={definition.scoringType}
              onChange={(event) =>
                onChange(
                  changeAssessmentScoringType(
                    definition,
                    event.target.value as Extract<AssessmentScoringType, "sum" | "dimension" | "match">,
                  ),
                )
              }
            >
              {fixedScoring ? (
                <option value={definition.scoringType}>{scoringTypeLabel(definition.scoringType)}</option>
              ) : (
                <>
                  <option value="sum">总分区间</option>
                  <option value="dimension">多维度</option>
                  <option value="match">结果匹配</option>
                </>
              )}
            </select>
          </QueryField>
          <QueryField label="排序">
            <input
              className={queryControlClass}
              disabled={disabled}
              min={0}
              type="number"
              value={definition.sortOrder ?? 0}
              onChange={(event) => patch({ sortOrder: numberValue(event.target.value, 0) })}
            />
          </QueryField>
        </div>
      </EditorSection>

      <EditorSection
        description="公开量表会展示给所有大众来访；私有量表仅可通过“企业定制”中已授权的企业专属链接访问。"
        title="权限设置"
      >
        <QueryField label="访问权限" required>
          <select
            className={`${queryControlClass} max-w-sm`}
            disabled={disabled}
            value={definition.visibility || "public"}
            onChange={(event) =>
              patch({ visibility: event.target.value as AssessmentDefinition["visibility"] })
            }
          >
            <option value="public">公开</option>
            <option value="private">私有</option>
          </select>
        </QueryField>
      </EditorSection>

      <EditorSection description="这些内容会显示在 EAP 量表列表和答题引导页。" title="量表信息">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <QueryField className="md:col-span-2" label="量表名称" required>
            <input
              className={queryControlClass}
              disabled={disabled}
              maxLength={120}
              value={definition.title}
              onChange={(event) => patch({ title: event.target.value })}
            />
          </QueryField>
          <QueryField className="md:col-span-2" label="副标题">
            <input
              className={queryControlClass}
              disabled={disabled}
              maxLength={200}
              value={definition.subtitle}
              onChange={(event) => patch({ subtitle: event.target.value })}
            />
          </QueryField>
          <QueryField className="md:col-span-2" label="量表说明">
            <textarea
              className={textareaClass}
              disabled={disabled}
              value={definition.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </QueryField>
          <div className="block min-w-0 md:col-span-2">
            <span className="mb-2 block text-xs font-medium text-[var(--lxxl-muted)]">
              封面图片<span className="ml-1 text-[#B34B43]">*</span>
            </span>
            <AssessmentImageField
              aspect="cover"
              disabled={disabled}
              inputLabel="封面图片地址"
              required
              value={definition.cover}
              onChange={(cover) => patch({ cover })}
              onUploadStateChange={onUploadStateChange}
            />
          </div>
          <QueryField label="预计时长（分钟）" required>
            <input
              className={queryControlClass}
              disabled={disabled}
              max={240}
              min={1}
              type="number"
              value={definition.duration}
              onChange={(event) => patch({ duration: numberValue(event.target.value, 1) })}
            />
          </QueryField>
          <QueryField className="md:col-span-2" label="指导语" required>
            <textarea
              className={textareaClass}
              disabled={disabled}
              value={definition.instructions || ""}
              onChange={(event) => patch({ instructions: event.target.value })}
            />
          </QueryField>
          <QueryField className="md:col-span-2" label="报告引导文案" required>
            <textarea
              className={textareaClass}
              disabled={disabled}
              value={definition.reportIntro || ""}
              onChange={(event) => patch({ reportIntro: event.target.value })}
            />
          </QueryField>
          <QueryField className="md:col-span-2" label="结果免责声明" required>
            <textarea
              className={textareaClass}
              disabled={disabled}
              value={definition.disclaimer}
              onChange={(event) => patch({ disclaimer: event.target.value })}
            />
          </QueryField>
        </div>
      </EditorSection>
    </div>
  );
}

function DemographicFields({
  definition,
  disabled,
  fixedStructure,
  onChange,
}: {
  definition: AssessmentDefinition;
  disabled: boolean;
  fixedStructure: boolean;
  onChange: (definition: AssessmentDefinition) => void;
}) {
  const questions = definition.demographicQuestions || [];

  function setQuestions(next: AssessmentDemographicQuestion[]) {
    onChange({ ...definition, demographicQuestions: next });
  }

  function updateQuestion(index: number, next: AssessmentDemographicQuestion) {
    setQuestions(replaceAt(questions, index, next));
  }

  function addQuestion() {
    const existingIds = questions.map((item) => item.id);
    const id = createStableId("demographic", existingIds);
    setQuestions([
      ...questions,
      {
        id,
        text: "",
        inputType: "single",
        required: true,
        options: [
          { id: `${id}-a`, text: "", value: "a" },
          { id: `${id}-b`, text: "", value: "b" },
        ],
      },
    ]);
  }

  return (
    <EditorSection
      action={
        <AddButton disabled={disabled || fixedStructure} onClick={addQuestion}>
          新增人口学题
        </AddButton>
      }
      description="人口学题用于收集报告背景信息，不参与计分。单选和多选题至少配置一个选项。"
      title="人口学题目"
    >
      {questions.length === 0 ? (
        <EditorEmpty text="当前量表没有人口学题。" />
      ) : (
        <div className="space-y-4">
          {questions.map((question, questionIndex) => (
            <div
              key={questionIndex}
              className="rounded-xl border border-[var(--lxxl-border)] bg-[#FCFBF8] p-4"
            >
              <CardHeader
                index={questionIndex}
                label={question.text || question.id || "未命名人口学题"}
                removeDisabled={disabled || fixedStructure}
                onRemove={() => setQuestions(questions.filter((_, index) => index !== questionIndex))}
              />
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CompactField label="题目 ID">
                  <input
                    className={compactInputClass}
                    disabled={disabled || fixedStructure}
                    value={question.id}
                    onChange={(event) =>
                      updateQuestion(questionIndex, { ...question, id: event.target.value })
                    }
                  />
                </CompactField>
                <CompactField className="md:col-span-2" label="题目">
                  <input
                    className={compactInputClass}
                    disabled={disabled}
                    value={question.text}
                    onChange={(event) =>
                      updateQuestion(questionIndex, { ...question, text: event.target.value })
                    }
                  />
                </CompactField>
                <CompactField label="输入类型">
                  <select
                    className={compactInputClass}
                    disabled={disabled || fixedStructure}
                    value={question.inputType}
                    onChange={(event) => {
                      const inputType = event.target.value as AssessmentDemographicInputType;
                      const needsOptions = inputType === "single" || inputType === "multiple";
                      updateQuestion(questionIndex, {
                        ...question,
                        inputType,
                        ...(needsOptions
                          ? {
                              options:
                                question.options && question.options.length > 0
                                  ? question.options
                                  : [
                                      { id: `${question.id}-a`, text: "", value: "a" },
                                      { id: `${question.id}-b`, text: "", value: "b" },
                                    ],
                            }
                          : { options: undefined }),
                      });
                    }}
                  >
                    <option value="single">单选</option>
                    <option value="multiple">多选</option>
                    <option value="text">文本</option>
                    <option value="number">数字</option>
                    <option value="date">日期</option>
                  </select>
                </CompactField>
                <CompactField className="md:col-span-2" label="填写提示">
                  <input
                    className={compactInputClass}
                    disabled={disabled}
                    value={question.helpText || ""}
                    onChange={(event) =>
                      updateQuestion(questionIndex, { ...question, helpText: event.target.value })
                    }
                  />
                </CompactField>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    checked={question.required}
                    disabled={disabled}
                    type="checkbox"
                    onChange={(event) =>
                      updateQuestion(questionIndex, { ...question, required: event.target.checked })
                    }
                  />
                  必填
                </label>
              </div>

              {(question.inputType === "single" || question.inputType === "multiple") && (
                <div className="mt-4 rounded-xl border border-[var(--lxxl-border)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">选项</div>
                    <SmallButton
                      disabled={disabled || fixedStructure}
                      onClick={() => {
                        const options = question.options || [];
                        const optionId = createStableId(
                          `${question.id}-option`,
                          options.map((item) => item.id),
                        );
                        updateQuestion(questionIndex, {
                          ...question,
                          options: [...options, { id: optionId, text: "", value: optionId }],
                        });
                      }}
                    >
                      添加选项
                    </SmallButton>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(question.options || []).map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.4fr_1fr_auto]"
                      >
                        <input
                          aria-label="选项 ID"
                          className={compactInputClass}
                          disabled={disabled || fixedStructure}
                          placeholder="选项 ID"
                          value={option.id}
                          onChange={(event) =>
                            updateQuestion(questionIndex, {
                              ...question,
                              options: replaceAt(question.options || [], optionIndex, {
                                ...option,
                                id: event.target.value,
                              }),
                            })
                          }
                        />
                        <input
                          aria-label="选项文案"
                          className={compactInputClass}
                          disabled={disabled}
                          placeholder="选项文案"
                          value={option.text}
                          onChange={(event) =>
                            updateQuestion(questionIndex, {
                              ...question,
                              options: replaceAt(question.options || [], optionIndex, {
                                ...option,
                                text: event.target.value,
                              }),
                            })
                          }
                        />
                        <input
                          aria-label="选项值"
                          className={compactInputClass}
                          disabled={disabled || fixedStructure}
                          placeholder="提交值（默认字符串）"
                          value={String(option.value)}
                          onChange={(event) =>
                            updateQuestion(questionIndex, {
                              ...question,
                              options: replaceAt(question.options || [], optionIndex, {
                                ...option,
                                value: event.target.value,
                              }),
                            })
                          }
                        />
                        <RemoveButton
                          disabled={
                            disabled || fixedStructure || (question.options?.length || 0) <= 1
                          }
                          label="删除选项"
                          onClick={() =>
                            updateQuestion(questionIndex, {
                              ...question,
                              options: (question.options || []).filter(
                                (_, index) => index !== optionIndex,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DemographicValidationFields
                disabled={disabled}
                question={question}
                onChange={(next) => updateQuestion(questionIndex, next)}
              />
            </div>
          ))}
        </div>
      )}
    </EditorSection>
  );
}

function DemographicValidationFields({
  question,
  disabled,
  onChange,
}: {
  question: AssessmentDemographicQuestion;
  disabled: boolean;
  onChange: (question: AssessmentDemographicQuestion) => void;
}) {
  const validation = question.validation || {};

  function patchNumber(
    key: "min" | "max" | "minLength" | "maxLength",
    value: string,
  ) {
    const next = { ...validation };
    if (value.trim() === "") {
      delete next[key];
    } else {
      next[key] = Number(value);
    }
    onChange({ ...question, validation: Object.keys(next).length ? next : undefined });
  }

  function patchPattern(value: string) {
    const next = { ...validation };
    if (value === "") {
      delete next.pattern;
    } else {
      next.pattern = value;
    }
    onChange({ ...question, validation: Object.keys(next).length ? next : undefined });
  }

  return (
    <details className="mt-4 rounded-xl border border-dashed border-[var(--lxxl-border)] bg-white px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-[var(--lxxl-green)]">
        输入校验（可选）
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CompactField label="最小值">
          <input
            className={compactInputClass}
            disabled={disabled}
            type="number"
            value={validation.min ?? ""}
            onChange={(event) => patchNumber("min", event.target.value)}
          />
        </CompactField>
        <CompactField label="最大值">
          <input
            className={compactInputClass}
            disabled={disabled}
            type="number"
            value={validation.max ?? ""}
            onChange={(event) => patchNumber("max", event.target.value)}
          />
        </CompactField>
        <CompactField label="最短长度">
          <input
            className={compactInputClass}
            disabled={disabled}
            min={0}
            type="number"
            value={validation.minLength ?? ""}
            onChange={(event) => patchNumber("minLength", event.target.value)}
          />
        </CompactField>
        <CompactField label="最长长度">
          <input
            className={compactInputClass}
            disabled={disabled}
            min={1}
            type="number"
            value={validation.maxLength ?? ""}
            onChange={(event) => patchNumber("maxLength", event.target.value)}
          />
        </CompactField>
        <CompactField label="正则表达式">
          <input
            className={compactInputClass}
            disabled={disabled}
            value={validation.pattern || ""}
            onChange={(event) => patchPattern(event.target.value)}
          />
        </CompactField>
      </div>
    </details>
  );
}

function QuestionFields({
  definition,
  disabled,
  fixedStructure,
  onChange,
  onPersist,
}: {
  definition: AssessmentDefinition;
  disabled: boolean;
  fixedStructure: boolean;
  onChange: (definition: AssessmentDefinition) => void;
  onPersist: (definition: AssessmentDefinition) => Promise<AssessmentAdminDetail | undefined>;
}) {
  const questions = definition.questions;
  const composeMode = Boolean(definition.composedFrom?.length);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [checkMode, setCheckMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [pendingRemoval, setPendingRemoval] = useState<AssessmentQuestion[] | null>(null);
  const [pendingSave, setPendingSave] = useState<AssessmentDefinition | null>(null);
  const [savingBatch, setSavingBatch] = useState(false);

  function setQuestions(next: AssessmentQuestion[]) {
    onChange({ ...definition, questions: next });
  }

  function updateQuestion(index: number, next: AssessmentQuestion) {
    setQuestions(replaceAt(questions, index, next));
  }

  function changeQuestionId(index: number, nextId: string) {
    const previousId = questions[index].id;
    const knownQuestionIds = questions.map((question) => question.id);
    const nextQuestions = replaceAt(questions, index, {
      ...questions[index],
      id: nextId,
    });
    onChange({
      ...definition,
      questions: nextQuestions,
      reverseQuestionIds: definition.reverseQuestionIds?.map((id) =>
        id === previousId ? nextId : id,
      ),
      dimensions: definition.dimensions?.map((dimension) => ({
        ...dimension,
        questionIds: dimension.questionIds.map((id) => (id === previousId ? nextId : id)),
        reverseQuestionIds: dimension.reverseQuestionIds?.map((id) =>
          id === previousId ? nextId : id,
        ),
        formula:
          dimension.calculationMode === "formula" && dimension.formula
            ? replaceFormulaQuestionId(
                dimension.formula,
                previousId,
                nextId,
                knownQuestionIds,
              )
            : dimension.formula,
      })),
    });
  }

  function removeQuestion(index: number) {
    const removedId = questions[index].id;
    const knownQuestionIds = questions.map((question) => question.id);
    onChange({
      ...definition,
      questions: questions.filter((_, itemIndex) => itemIndex !== index),
      reverseQuestionIds: definition.reverseQuestionIds?.filter((id) => id !== removedId),
      dimensions: definition.dimensions?.map((dimension) => ({
        ...dimension,
        questionIds: dimension.questionIds.filter((id) => id !== removedId),
        reverseQuestionIds: dimension.reverseQuestionIds?.filter((id) => id !== removedId),
        formula:
          dimension.calculationMode === "formula" && dimension.formula
            ? removeFormulaQuestionId(
                dimension.formula,
                removedId,
                knownQuestionIds,
              )
            : dimension.formula,
      })),
    });
  }

  function requestRemoval(selected: AssessmentQuestion[]) {
    if (selected.length === 0) {
      return;
    }
    if (questions.length - selected.length < 1) {
      window.alert("至少需要保留一道题目。");
      return;
    }
    setPendingRemoval(selected);
  }

  function confirmRemoval(mode: ComposedQuestionRemovalMode) {
    if (!pendingRemoval) {
      return;
    }
    const next = removeComposedQuestions(
      definition,
      pendingRemoval.map((question) => question.id),
      mode,
    );
    setPendingRemoval(null);
    if (!next) {
      window.alert("至少需要保留一道题目。");
      return;
    }
    onChange(next);
    setCheckedIds([]);
    setCheckMode(false);
    setPendingSave(next);
  }

  async function confirmBatchSave() {
    if (!pendingSave || savingBatch) {
      return;
    }
    setSavingBatch(true);
    try {
      const saved = await onPersist(pendingSave);
      if (saved) {
        setPendingSave(null);
      }
    } finally {
      setSavingBatch(false);
    }
  }

  function addQuestion() {
    const id = createStableId("q", questions.map((item) => item.id));
    const optionIds = new Set(
      questions.flatMap((item) => (item.options || []).map((option) => option.id)),
    );
    const firstId = createStableId(`${id}-a`, Array.from(optionIds));
    optionIds.add(firstId);
    const secondId = createStableId(`${id}-b`, Array.from(optionIds));
    setQuestions([
      ...questions,
      {
        id,
        text: "",
        required: true,
        inputType: "choice",
        options: [
          { id: firstId, text: "", value: 0 },
          { id: secondId, text: "", value: 1 },
        ],
      },
    ]);
  }

  function changeInputType(index: number, inputType: AssessmentQuestionInputType) {
    const question = questions[index];
    if (inputType === "choice") {
      const optionIds = new Set(
        questions.flatMap((item) => (item.options || []).map((option) => option.id)),
      );
      const firstId = createStableId(`${question.id}-a`, Array.from(optionIds));
      optionIds.add(firstId);
      const secondId = createStableId(`${question.id}-b`, Array.from(optionIds));
      updateQuestion(index, {
        ...question,
        inputType,
        scoreMode: undefined,
        completedScore: undefined,
        emptyScore: undefined,
        validation: undefined,
        options:
          question.options && question.options.length >= 2
            ? question.options
            : [
                { id: firstId, text: "", value: 0 },
                { id: secondId, text: "", value: 1 },
              ],
      });
      return;
    }
    updateQuestion(index, {
      ...question,
      inputType,
      scoreMode: question.scoreMode || "filled",
      completedScore: Number.isFinite(question.completedScore) ? question.completedScore : 1,
      emptyScore: Number.isFinite(question.emptyScore) ? question.emptyScore : 0,
      options: [],
    });
  }

  return (
    <EditorSection
      action={
        <div className="flex flex-wrap justify-end gap-2">
          {composeMode && (
            <>
              <button
                className={`h-9 rounded-xl border px-4 text-sm font-medium transition ${
                  optionsExpanded
                    ? "border-[var(--lxxl-green)] bg-[#F2F7F4] text-[var(--lxxl-green)]"
                    : "border-[var(--lxxl-border)] bg-white text-[var(--lxxl-ink)] hover:border-[var(--lxxl-green)]"
                }`}
                type="button"
                onClick={() => setOptionsExpanded(true)}
              >
                全部展开
              </button>
              <button
                className={`h-9 rounded-xl border px-4 text-sm font-medium transition ${
                  checkMode
                    ? "border-[var(--lxxl-green)] bg-[#F2F7F4] text-[var(--lxxl-green)]"
                    : "border-[var(--lxxl-border)] bg-white text-[var(--lxxl-ink)] hover:border-[var(--lxxl-green)]"
                }`}
                type="button"
                onClick={() => {
                  setCheckMode((active) => {
                    if (!active && optionsExpanded) {
                      setOptionsExpanded(false);
                    }
                    if (active) {
                      setCheckedIds([]);
                    }
                    return !active;
                  });
                }}
              >
                勾选删除
              </button>
            </>
          )}
          <AddButton disabled={disabled || fixedStructure} onClick={addQuestion}>
            新增题目
          </AddButton>
        </div>
      }
      description={
        composeMode
          ? "默认只显示题目，选项收起。删除题目时要选择如何处理报告结果。正式题目可以先保存；发布版本时才会核对报告结果和题目内容是否补齐。"
          : fixedStructure
            ? "固定计分量表可修改题目和选项文案，但题目 ID、选项 ID、分值及题目数量保持锁定。"
            : "题目可为选择题、填空题或数字题。填空/数字题可按是否填写或填写数字计分；选择题可在选项上配置追问计分。"
      }
      title="正式题目与选项"
    >
      <div className="space-y-4">
        {questions.map((question, questionIndex) => {
          const inputType = getQuestionInputType(question);
          const checked = checkedIds.includes(question.id);
          const showDetails = !composeMode || optionsExpanded;
          return (
          <div
            key={question.id || questionIndex}
            className={`rounded-xl border border-[var(--lxxl-border)] bg-[#FCFBF8] p-4 ${
              showDetails ? "" : "[&>:not(:first-child)]:hidden"
            }`}
          >
            <div className="flex items-start gap-3">
              {composeMode && checkMode && (
                <button
                  aria-checked={checked}
                  aria-label={`勾选${question.text || question.id}`}
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    checked
                      ? "border-[var(--lxxl-green)] bg-[var(--lxxl-green)]"
                      : "border-[var(--lxxl-border)] bg-white"
                  }`}
                  role="checkbox"
                  type="button"
                  onClick={() =>
                    setCheckedIds((current) =>
                      current.includes(question.id)
                        ? current.filter((id) => id !== question.id)
                        : [...current, question.id],
                    )
                  }
                >
                  {checked && <span className="h-2 w-2 rounded-full bg-white" />}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <CardHeader
                  index={questionIndex}
                  label={question.text || question.id || "未命名题目"}
                  removeDisabled={disabled || fixedStructure || questions.length <= 1}
                  onRemove={() =>
                    composeMode
                      ? requestRemoval([question])
                      : removeQuestion(questionIndex)
                  }
                />
                {composeMode && question.sourceAssessmentTitle && (
                  <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                    来自母量表 {question.sourceAssessmentTitle}
                    {question.sourceQuestionId ? ` · ${question.sourceQuestionId}` : ""}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <CompactField label="题目 ID">
                <input
                  className={compactInputClass}
                  disabled={disabled || fixedStructure}
                  value={question.id}
                  onChange={(event) => changeQuestionId(questionIndex, event.target.value)}
                />
              </CompactField>
              <CompactField label="题目类型">
                <select
                  className={compactInputClass}
                  disabled={disabled || fixedStructure}
                  value={inputType}
                  onChange={(event) =>
                    changeInputType(
                      questionIndex,
                      event.target.value as AssessmentQuestionInputType,
                    )
                  }
                >
                  <option value="choice">选择题</option>
                  <option value="text">填空题</option>
                  <option value="number">数字题</option>
                </select>
              </CompactField>
              <CompactField className="md:col-span-2" label="题目内容">
                <textarea
                  className={compactTextareaClass}
                  disabled={disabled}
                  value={question.text}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { ...question, text: event.target.value })
                  }
                />
              </CompactField>
              <CompactField className="md:col-span-3" label="题目提示">
                <input
                  className={compactInputClass}
                  disabled={disabled}
                  value={question.helpText || ""}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { ...question, helpText: event.target.value })
                  }
                />
              </CompactField>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  checked={question.required}
                  disabled={disabled || fixedStructure}
                  type="checkbox"
                  onChange={(event) =>
                    updateQuestion(questionIndex, { ...question, required: event.target.checked })
                  }
                />
                必答
              </label>
            </div>

            {(inputType === "text" || inputType === "number") && (
              <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-[var(--lxxl-border)] bg-white p-4 md:grid-cols-4">
                <CompactField label="计分方式">
                  <select
                    className={compactInputClass}
                    disabled={disabled || fixedStructure}
                    value={question.scoreMode || "filled"}
                    onChange={(event) =>
                      updateQuestion(questionIndex, {
                        ...question,
                        scoreMode: event.target.value as AssessmentScoreMode,
                      })
                    }
                  >
                    <option value="filled">按是否填写</option>
                    {inputType === "number" && <option value="value">按填写数字</option>}
                  </select>
                </CompactField>
                {(question.scoreMode || "filled") === "filled" && (
                  <>
                    <CompactField label="已填写得分">
                      <input
                        className={compactInputClass}
                        disabled={disabled || fixedStructure}
                        step="any"
                        type="number"
                        value={question.completedScore ?? 1}
                        onChange={(event) =>
                          updateQuestion(questionIndex, {
                            ...question,
                            completedScore: numberValue(event.target.value, 1),
                          })
                        }
                      />
                    </CompactField>
                    <CompactField label="未填写得分">
                      <input
                        className={compactInputClass}
                        disabled={disabled || fixedStructure || question.required}
                        step="any"
                        type="number"
                        value={question.emptyScore ?? 0}
                        onChange={(event) =>
                          updateQuestion(questionIndex, {
                            ...question,
                            emptyScore: numberValue(event.target.value, 0),
                          })
                        }
                      />
                    </CompactField>
                  </>
                )}
                {inputType === "number" && (
                  <>
                    <CompactField label="数字最小值">
                      <input
                        className={compactInputClass}
                        disabled={disabled || fixedStructure}
                        step="any"
                        type="number"
                        value={question.validation?.min ?? ""}
                        onChange={(event) =>
                          updateQuestion(questionIndex, {
                            ...question,
                            validation: {
                              ...question.validation,
                              min:
                                event.target.value === ""
                                  ? undefined
                                  : numberValue(event.target.value, 0),
                            },
                          })
                        }
                      />
                    </CompactField>
                    <CompactField label="数字最大值">
                      <input
                        className={compactInputClass}
                        disabled={disabled || fixedStructure}
                        step="any"
                        type="number"
                        value={question.validation?.max ?? ""}
                        onChange={(event) =>
                          updateQuestion(questionIndex, {
                            ...question,
                            validation: {
                              ...question.validation,
                              max:
                                event.target.value === ""
                                  ? undefined
                                  : numberValue(event.target.value, 0),
                            },
                          })
                        }
                      />
                    </CompactField>
                  </>
                )}
              </div>
            )}

            {inputType === "choice" && (
            <div className="mt-4 rounded-xl border border-[var(--lxxl-border)] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">选项</div>
                <SmallButton
                  disabled={disabled || fixedStructure}
                  onClick={() => {
                    const allOptionIds = questions.flatMap((item) =>
                      (item.options || []).map((option) => option.id),
                    );
                    const id = createStableId(`${question.id}-option`, allOptionIds);
                    updateQuestion(questionIndex, {
                      ...question,
                      options: [
                        ...(question.options || []),
                        { id, text: "", value: question.options?.length || 0 },
                      ],
                    });
                  }}
                >
                  添加选项
                </SmallButton>
              </div>
              <div className="mt-3 space-y-3">
                {(question.options || []).map((option, optionIndex) => (
                  <div
                    key={optionIndex}
                    className="space-y-2 rounded-lg border border-[var(--lxxl-border)] bg-[#FCFBF8] p-3"
                  >
                  <div
                    className={`grid grid-cols-1 gap-2 ${
                      definition.scoringType === "match"
                        ? "lg:grid-cols-[1fr_1.5fr_0.7fr_1.3fr_auto]"
                        : "lg:grid-cols-[1fr_1.8fr_0.8fr_auto]"
                    }`}
                  >
                    <input
                      aria-label="选项 ID"
                      className={compactInputClass}
                      disabled={disabled || fixedStructure}
                      placeholder="选项 ID"
                      value={option.id}
                      onChange={(event) =>
                        updateQuestion(questionIndex, {
                          ...question,
                          options: replaceAt(question.options, optionIndex, {
                            ...option,
                            id: event.target.value,
                          }),
                        })
                      }
                    />
                    <input
                      aria-label="选项文案"
                      className={compactInputClass}
                      disabled={disabled}
                      placeholder="选项文案"
                      value={option.text}
                      onChange={(event) =>
                        updateQuestion(questionIndex, {
                          ...question,
                          options: replaceAt(question.options, optionIndex, {
                            ...option,
                            text: event.target.value,
                          }),
                        })
                      }
                    />
                    <input
                      aria-label="选项分值"
                      className={compactInputClass}
                      disabled={disabled || fixedStructure}
                      placeholder="分值"
                      step="any"
                      type="number"
                      value={option.value}
                      onChange={(event) =>
                        updateQuestion(questionIndex, {
                          ...question,
                          options: replaceAt(question.options, optionIndex, {
                            ...option,
                            value: numberValue(event.target.value, 0),
                          }),
                        })
                      }
                    />
                    {definition.scoringType === "match" && (
                      <MatchWeightsEditor
                        disabled={disabled}
                        results={definition.matchResults || []}
                        value={option.matchTags}
                        onChange={(matchTags) =>
                          updateQuestion(questionIndex, {
                            ...question,
                            options: replaceAt(question.options, optionIndex, {
                              ...option,
                              matchTags,
                            }),
                          })
                        }
                      />
                    )}
                    <RemoveButton
                      disabled={disabled || fixedStructure || question.options.length <= 2}
                      label="删除选项"
                      onClick={() =>
                        updateQuestion(questionIndex, {
                          ...question,
                          options: question.options.filter((_, index) => index !== optionIndex),
                        })
                      }
                    />
                  </div>
                  <OptionFollowUpEditor
                    disabled={disabled || fixedStructure}
                    option={option}
                    onChange={(nextOption) =>
                      updateQuestion(questionIndex, {
                        ...question,
                        options: replaceAt(question.options, optionIndex, nextOption),
                      })
                    }
                  />
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>
          );
        })}
      </div>
      {composeMode && (
        <div className="mt-4 flex justify-end">
          <button
            className="h-10 rounded-xl border border-[#E8B7B2] px-4 text-sm font-medium text-[#A13F37] transition hover:bg-[#FFF5F4] disabled:cursor-not-allowed disabled:border-[var(--lxxl-border)] disabled:bg-[#F7F5F2] disabled:text-[var(--lxxl-muted)]"
            disabled={disabled || !checkMode || checkedIds.length === 0}
            type="button"
            onClick={() =>
              requestRemoval(questions.filter((question) => checkedIds.includes(question.id)))
            }
          >
            一键批量删除
          </button>
        </div>
      )}
      {pendingRemoval && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold">删除题目</h3>
            <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--lxxl-ink)]">
              {groupQuestionsBySource(pendingRemoval).map((group) => (
                <p key={group.name}>
                  将删除{group.name}下的题目（{group.labels.join("、")}）。参与记分的题目会去掉这些题。
                </p>
              ))}
              <p className="text-[var(--lxxl-muted)]">
                正式题目可以先保存。发布版本时，如果报告结果没有补齐，就不能发布。
              </p>
            </div>
            <div className="mt-5 space-y-3">
              <button
                className="w-full rounded-xl border border-[#E8B7B2] px-4 py-3 text-left text-sm leading-6 text-[#A13F37] transition hover:bg-[#FFF5F4]"
                type="button"
                onClick={() => confirmRemoval("clear-explanations")}
              >
                <span className="font-medium">
                  A. 去掉该题，并删除报告结果中所有解释
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#8F3832]">
                  清除各结果项的面向来访说明、面向分析方说明和建议，保留结果等级。请到报告结果中点击对应结果项打开详细信息后重新编辑。
                </span>
              </button>
              <button
                className="w-full rounded-xl border border-[var(--lxxl-border)] px-4 py-3 text-left text-sm leading-6 text-[var(--lxxl-ink)] transition hover:border-[var(--lxxl-green)]"
                type="button"
                onClick={() => confirmRemoval("clear-bounds")}
              >
                <span className="font-medium">
                  B. 去掉该题，保留解释，并清空全部分数
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--lxxl-muted)]">
                  保留各结果项的说明和建议，清空每个区间的最低分和最高分。发布前需要把这些数字补回。
                </span>
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                className="h-10 rounded-xl border border-[var(--lxxl-border)] px-4 text-sm font-medium text-[var(--lxxl-muted)]"
                type="button"
                onClick={() => setPendingRemoval(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingSave && (
        <ConfirmOverlay
          confirmLabel={savingBatch ? "保存中..." : "保存"}
          cancelLabel="暂不保存"
          disabled={savingBatch}
          title="保存草稿"
          onCancel={() => {
            if (!savingBatch) {
              setPendingSave(null);
            }
          }}
          onConfirm={() => void confirmBatchSave()}
        >
          <p className="text-sm leading-6 text-[var(--lxxl-ink)]">
            题目已从当前编辑内容中移除，报告结果已按所选方式处理。是否保存？保存后不会发布。发布版本前需要把报告结果补齐。
          </p>
        </ConfirmOverlay>
      )}
    </EditorSection>
  );
}

function OptionFollowUpEditor({
  disabled,
  option,
  onChange,
}: {
  disabled: boolean;
  option: AssessmentOption;
  onChange: (option: AssessmentOption) => void;
}) {
  const followUp = option.followUp;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-[var(--lxxl-muted)]">
        <input
          checked={Boolean(followUp)}
          disabled={disabled}
          type="checkbox"
          onChange={(event) => {
            if (!event.target.checked) {
              const { followUp: _removed, ...rest } = option;
              onChange(rest);
              return;
            }
            onChange({
              ...option,
              followUp: {
                inputType: "number",
                label: "",
                required: false,
                scoreMode: "filled",
                completedScore: 1,
                emptyScore: 0,
              },
            });
          }}
        />
        选择后需要追问（填空/数字），并按填写情况计分
      </label>
      {followUp && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <CompactField label="追问类型">
            <select
              className={compactInputClass}
              disabled={disabled}
              value={followUp.inputType}
              onChange={(event) => {
                const inputType = event.target.value as AssessmentOptionFollowUp["inputType"];
                onChange({
                  ...option,
                  followUp: {
                    ...followUp,
                    inputType,
                    scoreMode:
                      inputType === "text" && followUp.scoreMode === "value"
                        ? "filled"
                        : followUp.scoreMode,
                  },
                });
              }}
            >
              <option value="text">填空</option>
              <option value="number">数字</option>
            </select>
          </CompactField>
          <CompactField label="追问提示">
            <input
              className={compactInputClass}
              disabled={disabled}
              placeholder="如：请填写天数"
              value={followUp.label || ""}
              onChange={(event) =>
                onChange({
                  ...option,
                  followUp: { ...followUp, label: event.target.value },
                })
              }
            />
          </CompactField>
          <CompactField label="计分方式">
            <select
              className={compactInputClass}
              disabled={disabled}
              value={followUp.scoreMode}
              onChange={(event) =>
                onChange({
                  ...option,
                  followUp: {
                    ...followUp,
                    scoreMode: event.target.value as AssessmentScoreMode,
                  },
                })
              }
            >
              <option value="filled">按是否填写</option>
              {followUp.inputType === "number" && (
                <option value="value">按填写数字</option>
              )}
            </select>
          </CompactField>
          {followUp.scoreMode === "filled" ? (
            <>
              <CompactField label="已填得分">
                <input
                  className={compactInputClass}
                  disabled={disabled}
                  step="any"
                  type="number"
                  value={followUp.completedScore ?? 1}
                  onChange={(event) =>
                    onChange({
                      ...option,
                      followUp: {
                        ...followUp,
                        completedScore: numberValue(event.target.value, 1),
                      },
                    })
                  }
                />
              </CompactField>
              <CompactField label="未填得分">
                <input
                  className={compactInputClass}
                  disabled={disabled || Boolean(followUp.required)}
                  step="any"
                  type="number"
                  value={followUp.emptyScore ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...option,
                      followUp: {
                        ...followUp,
                        emptyScore: numberValue(event.target.value, 0),
                      },
                    })
                  }
                />
              </CompactField>
            </>
          ) : (
            <>
              <CompactField label="数字最小">
                <input
                  className={compactInputClass}
                  disabled={disabled}
                  step="any"
                  type="number"
                  value={followUp.validation?.min ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...option,
                      followUp: {
                        ...followUp,
                        validation: {
                          ...followUp.validation,
                          min:
                            event.target.value === ""
                              ? undefined
                              : numberValue(event.target.value, 0),
                        },
                      },
                    })
                  }
                />
              </CompactField>
              <CompactField label="数字最大">
                <input
                  className={compactInputClass}
                  disabled={disabled}
                  step="any"
                  type="number"
                  value={followUp.validation?.max ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...option,
                      followUp: {
                        ...followUp,
                        validation: {
                          ...followUp.validation,
                          max:
                            event.target.value === ""
                              ? undefined
                              : numberValue(event.target.value, 0),
                        },
                      },
                    })
                  }
                />
              </CompactField>
            </>
          )}
          <label className="flex items-end gap-2 pb-2 text-sm md:col-span-5">
            <input
              checked={Boolean(followUp.required)}
              disabled={disabled}
              type="checkbox"
              onChange={(event) =>
                onChange({
                  ...option,
                  followUp: { ...followUp, required: event.target.checked },
                })
              }
            />
            追问必填
          </label>
        </div>
      )}
    </div>
  );
}

function createEmptyMergedDimension(existingIds: string[]): AssessmentDimension {
  const id = createStableId("merged", existingIds);
  return {
    id,
    title: "新合并结果",
    questionIds: [],
    reverseQuestionIds: [],
    calculationMode: "simple",
    aggregate: "sum",
    scoreRanges: [
      {
        min: 0,
        max: 1,
        level: "新结果",
        visitorDescription: "",
        analystDescription: "",
        suggestions: [],
      },
    ],
  };
}

function ComposedSourceReportEditor({
  definition,
  disabled,
  onChange,
}: {
  definition: AssessmentDefinition;
  disabled: boolean;
  onChange: (definition: AssessmentDefinition) => void;
}) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const reports = definition.sourceReports || [];
  const parentReports = reports.filter((report) => report.sourceId !== COMPOSED_MERGED_SOURCE_ID);
  const mergedReport = reports.find((report) => report.sourceId === COMPOSED_MERGED_SOURCE_ID);
  const mergedDimensions = mergedReport?.dimensions || [];
  const allQuestions = definition.questions;
  const allQuestionIds = allQuestions.map((question) => question.id);

  function setReports(
    next: NonNullable<AssessmentDefinition["sourceReports"]>,
  ) {
    onChange({
      ...definition,
      sourceReports: next,
    });
  }

  function updateReport(
    sourceId: string,
    next: NonNullable<AssessmentDefinition["sourceReports"]>[number],
  ) {
    setReports(reports.map((item) => (item.sourceId === sourceId ? next : item)));
  }

  function ensureMergedReport() {
    if (mergedReport) {
      return mergedReport;
    }
    return {
      sourceId: COMPOSED_MERGED_SOURCE_ID,
      sourceTitle: COMPOSED_MERGED_SOURCE_TITLE,
      scoringType: "dimension" as const,
      scoringPreset: "generic-dimension-v1" as const,
      questionIds: allQuestionIds,
      dimensions: [] as AssessmentDimension[],
    };
  }

  function updateMergedDimensions(dimensions: AssessmentDimension[]) {
    const nextMerged = {
      ...ensureMergedReport(),
      questionIds: allQuestionIds,
      dimensions,
    };
    if (mergedReport) {
      updateReport(COMPOSED_MERGED_SOURCE_ID, nextMerged);
      return;
    }
    setReports([...reports, nextMerged]);
  }

  function toggleDetails(key: string) {
    setExpandedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-[var(--lxxl-muted)]">
        每张母量表的报告结果按原结构拼接；底部「合并结果」可跨母量表选题记分。默认只显示结果名称；点击某一项可打开详细信息。删题后请补齐解释或分数，未补齐时不能发布版本。
      </p>
      {parentReports.length === 0 && (
        <p className="text-sm text-[var(--lxxl-muted)]">正在读取母量表的报告结果...</p>
      )}
      {parentReports.map((report) => {
        const owned = definition.questions.filter(
          (question) => question.sourceAssessmentId === report.sourceId,
        );
        const questions = owned.length
          ? owned
          : definition.questions.filter((question) => report.questionIds.includes(question.id));
        const dimensions = report.dimensions || [];
        return (
          <EditorSection
            key={report.sourceId}
            description="与该母量表原来的报告结果一致。计算方式沿用母量表，不可改。"
            title={report.sourceTitle}
          >
            <div className="space-y-4">
              {dimensions.length === 0 && (
                <p className="text-sm text-[var(--lxxl-muted)]">这一段还没有结果项。</p>
              )}
              {dimensions.map((dimension, dimensionIndex) => {
                const detailsKey = `${report.sourceId}:${dimension.id || dimensionIndex}`;
                const detailsOpen = expandedKeys.includes(detailsKey);
                return (
                  <div
                    key={dimension.id || dimensionIndex}
                    className={`rounded-xl border bg-[#FCFBF8] p-4 transition ${
                      detailsOpen
                        ? "border-[var(--lxxl-green)]"
                        : "border-[var(--lxxl-border)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        aria-expanded={detailsOpen}
                        className="min-w-0 flex-1 rounded-lg text-left outline-none transition hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-[var(--lxxl-green)]"
                        type="button"
                        onClick={() => toggleDetails(detailsKey)}
                      >
                        <div className="flex items-center gap-2 px-1 py-0.5">
                          <span className="text-sm font-medium text-[var(--lxxl-muted)]">
                            {dimensionIndex + 1}.
                          </span>
                          <span className="truncate text-sm font-semibold text-[var(--lxxl-ink)]">
                            {dimension.title || dimension.id || "未命名结果"}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-[var(--lxxl-muted)]">
                            {detailsOpen ? "收起详细信息" : "打开详细信息"}
                          </span>
                        </div>
                      </button>
                      <RemoveButton
                        disabled={disabled}
                        label="删除结果项"
                        onClick={() =>
                          updateReport(report.sourceId, {
                            ...report,
                            dimensions: dimensions.filter((_, index) => index !== dimensionIndex),
                          })
                        }
                      />
                    </div>
                    {detailsOpen && (
                      <div className="mt-4 space-y-4">
                        <CompactField label="计算方式">
                          <div className="rounded-lg border border-[var(--lxxl-border)] bg-[#F7F5F2] px-3 py-2 text-sm text-[var(--lxxl-muted)]">
                            {(dimension.calculationMode || "simple") === "formula"
                              ? "设置公式计算（沿用母量表，不可修改）"
                              : `${
                                  dimension.aggregate === "product"
                                    ? "全部相乘"
                                    : dimension.aggregate === "average"
                                      ? "平均数"
                                      : "全部相加"
                                }（沿用母量表，不可修改）`}
                          </div>
                        </CompactField>
                        {(dimension.calculationMode || "simple") === "formula" && (
                          <CompactField label="计算公式">
                            <div className="rounded-lg border border-[var(--lxxl-border)] bg-[#F7F5F2] px-3 py-2 font-mono text-sm text-[var(--lxxl-muted)]">
                              {dimension.formula?.trim() || "（无公式）"}
                            </div>
                          </CompactField>
                        )}
                        <div className="rounded-xl border border-[var(--lxxl-border)] bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-medium">参与记分的题目</div>
                            <span className="text-xs text-[var(--lxxl-muted)]">
                              已选 {dimension.questionIds.length}/{questions.length}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
                            勾选表示参与该结果项记分；勾选后可再勾「反向计分」。计算方式沿用母量表，不可改。
                          </p>
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {questions.map((question) => {
                              const selected = dimension.questionIds.includes(question.id);
                              const reverseIds = dimension.reverseQuestionIds || [];
                              const knownIds = questions.map((item) => item.id);
                              return (
                                <div
                                  key={question.id}
                                  className="rounded-lg border border-[var(--lxxl-border)] px-3 py-2"
                                >
                                  <label className="flex items-start gap-2 text-xs leading-5">
                                    <input
                                      checked={selected}
                                      className="mt-1"
                                      disabled={disabled}
                                      type="checkbox"
                                      onChange={(event) => {
                                        const questionIds = event.target.checked
                                          ? [...dimension.questionIds, question.id]
                                          : dimension.questionIds.filter((id) => id !== question.id);
                                        const currentFormula = dimension.formula ?? "";
                                        const formula =
                                          (dimension.calculationMode || "simple") !== "formula"
                                            ? dimension.formula
                                            : event.target.checked
                                              ? currentFormula.trim()
                                                ? `${currentFormula.trim()} + ${question.id}`
                                                : question.id
                                              : removeFormulaQuestionId(
                                                  currentFormula,
                                                  question.id,
                                                  knownIds,
                                                );
                                        updateReport(report.sourceId, {
                                          ...report,
                                          dimensions: dimensions.map((item, index) =>
                                            index === dimensionIndex
                                              ? {
                                                  ...item,
                                                  questionIds,
                                                  formula,
                                                  reverseQuestionIds: reverseIds.filter((id) =>
                                                    questionIds.includes(id),
                                                  ),
                                                }
                                              : item,
                                          ),
                                        });
                                      }}
                                    />
                                    <span>
                                      <span className="font-medium">
                                        {question.sourceQuestionId || question.id}
                                      </span>
                                      <span className="ml-2 text-[var(--lxxl-muted)]">
                                        {question.text || "未命名题目"}
                                      </span>
                                    </span>
                                  </label>
                                  {selected && (
                                    <label className="mt-2 flex items-center gap-2 pl-5 text-xs text-[var(--lxxl-muted)]">
                                      <input
                                        checked={reverseIds.includes(question.id)}
                                        disabled={disabled}
                                        type="checkbox"
                                        onChange={(event) =>
                                          updateReport(report.sourceId, {
                                            ...report,
                                            dimensions: dimensions.map((item, index) =>
                                              index === dimensionIndex
                                                ? {
                                                    ...item,
                                                    reverseQuestionIds: event.target.checked
                                                      ? [...reverseIds, question.id]
                                                      : reverseIds.filter((id) => id !== question.id),
                                                  }
                                                : item,
                                            ),
                                          })
                                        }
                                      />
                                      反向计分
                                    </label>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <ScoreRangeEditor
                          disabled={disabled}
                          ranges={dimension.scoreRanges || []}
                          onChange={(scoreRanges) =>
                            updateReport(report.sourceId, {
                              ...report,
                              dimensions: dimensions.map((item, index) =>
                                index === dimensionIndex ? { ...item, scoreRanges } : item,
                              ),
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </EditorSection>
        );
      })}

      <EditorSection
        action={
          <AddButton
            disabled={disabled}
            onClick={() =>
              updateMergedDimensions([
                ...mergedDimensions,
                createEmptyMergedDimension(mergedDimensions.map((item) => item.id)),
              ])
            }
          >
            新增维度
          </AddButton>
        }
        description="可跨所有参与组合的题目新建结果项。新增后默认不勾选题目；展开详细信息后，每道题都可勾选参与记分和反向计分。"
        title={COMPOSED_MERGED_SOURCE_TITLE}
      >
        <div className="space-y-4">
          {mergedDimensions.length === 0 && (
            <p className="text-sm text-[var(--lxxl-muted)]">
              还没有合并结果。点击右上角「新增维度」开始配置。
            </p>
          )}
          {mergedDimensions.map((dimension, dimensionIndex) => {
            const detailsKey = `${COMPOSED_MERGED_SOURCE_ID}:${dimension.id || dimensionIndex}`;
            const detailsOpen = expandedKeys.includes(detailsKey);
            const calculationMode = dimension.calculationMode ?? "simple";
            const reverseIds = dimension.reverseQuestionIds || [];
            let formulaError = "";
            if (calculationMode === "formula") {
              try {
                compileDimensionFormula(dimension.formula || "", allQuestionIds);
              } catch (error) {
                formulaError = error instanceof Error ? error.message : "公式不合法";
              }
            }
            return (
              <div
                key={dimension.id || dimensionIndex}
                className={`rounded-xl border bg-[#FCFBF8] p-4 transition ${
                  detailsOpen ? "border-[var(--lxxl-green)]" : "border-[var(--lxxl-border)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    aria-expanded={detailsOpen}
                    className="min-w-0 flex-1 rounded-lg text-left outline-none transition hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-[var(--lxxl-green)]"
                    type="button"
                    onClick={() => toggleDetails(detailsKey)}
                  >
                    <div className="flex items-center gap-2 px-1 py-0.5">
                      <span className="text-sm font-medium text-[var(--lxxl-muted)]">
                        {dimensionIndex + 1}.
                      </span>
                      <span className="truncate text-sm font-semibold text-[var(--lxxl-ink)]">
                        {dimension.title || dimension.id || "未命名合并结果"}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-[var(--lxxl-muted)]">
                        {detailsOpen ? "收起详细信息" : "打开详细信息"}
                      </span>
                    </div>
                  </button>
                  <RemoveButton
                    disabled={disabled}
                    label="删除合并结果"
                    onClick={() =>
                      updateMergedDimensions(
                        mergedDimensions.filter((_, index) => index !== dimensionIndex),
                      )
                    }
                  />
                </div>
                {detailsOpen && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <CompactField label="结果名称">
                        <input
                          className={compactInputClass}
                          disabled={disabled}
                          value={dimension.title}
                          onChange={(event) =>
                            updateMergedDimensions(
                              mergedDimensions.map((item, index) =>
                                index === dimensionIndex
                                  ? { ...item, title: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </CompactField>
                      <CompactField label="计算方式">
                        <div className="flex h-9 items-center gap-4 rounded-lg border border-[var(--lxxl-border)] bg-white px-3 text-sm">
                          {(["simple", "formula"] as const).map((mode) => (
                            <label className="flex cursor-pointer items-center gap-1.5" key={mode}>
                              <input
                                checked={calculationMode === mode}
                                disabled={disabled}
                                name={`merged-calculation-${dimensionIndex}`}
                                type="radio"
                                onChange={() =>
                                  updateMergedDimensions(
                                    mergedDimensions.map((item, index) =>
                                      index === dimensionIndex
                                        ? {
                                            ...item,
                                            calculationMode: mode,
                                            formula:
                                              mode === "formula"
                                                ? item.formula ?? item.questionIds.join(" + ")
                                                : undefined,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              />
                              {mode === "simple" ? "简单计算" : "设置公式计算"}
                            </label>
                          ))}
                        </div>
                      </CompactField>
                      {calculationMode === "simple" ? (
                        <CompactField className="md:col-span-2" label="简单计算">
                          <select
                            className={compactInputClass}
                            disabled={disabled}
                            value={dimension.aggregate}
                            onChange={(event) =>
                              updateMergedDimensions(
                                mergedDimensions.map((item, index) =>
                                  index === dimensionIndex
                                    ? {
                                        ...item,
                                        aggregate: event.target
                                          .value as AssessmentDimension["aggregate"],
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            <option value="sum">全部相加</option>
                            <option value="product">全部相乘</option>
                            <option value="average">平均数</option>
                          </select>
                        </CompactField>
                      ) : (
                        <CompactField className="md:col-span-2" label="计算公式">
                          <input
                            className={compactInputClass}
                            disabled={disabled}
                            placeholder="例如：(q1 + q2) / q3"
                            value={dimension.formula ?? ""}
                            onChange={(event) => {
                              const formula = event.target.value;
                              const questionIds = formulaQuestionIds(formula, allQuestionIds);
                              updateMergedDimensions(
                                mergedDimensions.map((item, index) =>
                                  index === dimensionIndex
                                    ? {
                                        ...item,
                                        formula,
                                        questionIds,
                                        reverseQuestionIds: reverseIds.filter((id) =>
                                          questionIds.includes(id),
                                        ),
                                      }
                                    : item,
                                ),
                              );
                            }}
                          />
                          <p
                            className={`mt-1 text-xs ${
                              formulaError ? "text-[#A13F37]" : "text-[var(--lxxl-muted)]"
                            }`}
                          >
                            {formulaError || "仅支持题目 ID、+、-、*、/ 和英文括号 ()。"}
                          </p>
                        </CompactField>
                      )}
                    </div>
                    <div className="rounded-xl border border-[var(--lxxl-border)] bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">参与记分的题目</div>
                        <span className="text-xs text-[var(--lxxl-muted)]">
                          已选 {dimension.questionIds.length}/{allQuestions.length}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
                        可选全部参与组合的题目；每道题都可单独勾选「反向计分」。勾选反向计分时会自动纳入参与记分。
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {allQuestions.map((question) => {
                          const selected = dimension.questionIds.includes(question.id);
                          const isReverse = reverseIds.includes(question.id);
                          return (
                            <div
                              key={question.id}
                              className="rounded-lg border border-[var(--lxxl-border)] px-3 py-2"
                            >
                              <label className="flex items-start gap-2 text-xs leading-5">
                                <input
                                  checked={selected}
                                  className="mt-1"
                                  disabled={disabled}
                                  type="checkbox"
                                  onChange={(event) => {
                                    const questionIds = event.target.checked
                                      ? [...dimension.questionIds, question.id]
                                      : dimension.questionIds.filter((id) => id !== question.id);
                                    const currentFormula = dimension.formula ?? "";
                                    const formula =
                                      calculationMode !== "formula"
                                        ? dimension.formula
                                        : event.target.checked
                                          ? currentFormula.trim()
                                            ? `${currentFormula.trim()} + ${question.id}`
                                            : question.id
                                          : removeFormulaQuestionId(
                                              currentFormula,
                                              question.id,
                                              allQuestionIds,
                                            );
                                    updateMergedDimensions(
                                      mergedDimensions.map((item, index) =>
                                        index === dimensionIndex
                                          ? {
                                              ...item,
                                              questionIds,
                                              formula,
                                              reverseQuestionIds: reverseIds.filter((id) =>
                                                questionIds.includes(id),
                                              ),
                                            }
                                          : item,
                                      ),
                                    );
                                  }}
                                />
                                <span>
                                  <span className="font-medium">
                                    {question.sourceQuestionId || question.id}
                                  </span>
                                  {question.sourceAssessmentTitle && (
                                    <span className="ml-1 text-[var(--lxxl-muted)]">
                                      （{question.sourceAssessmentTitle}）
                                    </span>
                                  )}
                                  <span className="ml-2 text-[var(--lxxl-muted)]">
                                    {question.text || "未命名题目"}
                                  </span>
                                </span>
                              </label>
                              <label className="mt-2 flex items-center gap-2 pl-5 text-xs text-[var(--lxxl-muted)]">
                                <input
                                  checked={isReverse}
                                  disabled={disabled}
                                  type="checkbox"
                                  onChange={(event) => {
                                    const enableReverse = event.target.checked;
                                    let questionIds = dimension.questionIds;
                                    let formula = dimension.formula;
                                    if (enableReverse && !selected) {
                                      questionIds = [...dimension.questionIds, question.id];
                                      if (calculationMode === "formula") {
                                        const currentFormula = dimension.formula ?? "";
                                        formula = currentFormula.trim()
                                          ? `${currentFormula.trim()} + ${question.id}`
                                          : question.id;
                                      }
                                    }
                                    updateMergedDimensions(
                                      mergedDimensions.map((item, index) =>
                                        index === dimensionIndex
                                          ? {
                                              ...item,
                                              questionIds,
                                              formula,
                                              reverseQuestionIds: enableReverse
                                                ? [...new Set([...reverseIds, question.id])]
                                                : reverseIds.filter((id) => id !== question.id),
                                            }
                                          : item,
                                      ),
                                    );
                                  }}
                                />
                                反向计分
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <ScoreRangeEditor
                      disabled={disabled}
                      ranges={dimension.scoreRanges || []}
                      onChange={(scoreRanges) =>
                        updateMergedDimensions(
                          mergedDimensions.map((item, index) =>
                            index === dimensionIndex ? { ...item, scoreRanges } : item,
                          ),
                        )
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </EditorSection>
    </div>
  );
}

function ResultFields({
  composeMode = false,
  coverageSummaries,
  definition,
  disabled,
  fixedStructure,
  onChange,
  onUploadStateChange,
}: {
  composeMode?: boolean;
  coverageSummaries: AssessmentScoreCoverageSummary[];
  definition: AssessmentDefinition;
  disabled: boolean;
  fixedStructure: boolean;
  onChange: (definition: AssessmentDefinition) => void;
  onUploadStateChange: (delta: number) => void;
}) {
  if (composeMode) {
    return (
      <ComposedSourceReportEditor
        definition={definition}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }
  const hasScoreRanges = definition.scoringType === "sum" || definition.scoringType === "psqi";
  const hasDimensions = definition.scoringType === "dimension";
  const hasMatchResults = definition.scoringType === "match" || definition.scoringType === "aas";
  const profiles = definition.reportProfiles || [];
  const legacySumPreset =
    definition.scoringType === "sum" &&
    definition.scoringPreset === "generic-sum-v1";

  return (
    <div className="space-y-5">
      {coverageSummaries.length > 0 && (
        <ScoreCoveragePanel summaries={coverageSummaries} />
      )}

      {hasScoreRanges && (
        <EditorSection
          description="每个可达分值必须且只能落入一个区间；上下限包含边界值。"
          title="总分报告区间"
        >
          {legacySumPreset && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4D7B5] bg-[#FFF9EA] p-4">
              <div>
                <div className="text-sm font-medium text-[#6F5A24]">
                  旧版总分计分模板
                </div>
                <p className="mt-1 text-xs leading-5 text-[#806C39]">
                  generic-sum-v1 保持历史口径，不应用反向题且不统一小数精度。升级后才可配置反向题，并按两位小数匹配报告区间。
                </p>
              </div>
              <SmallButton
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...definition,
                    scoringPreset: "generic-sum-v2",
                  })
                }
              >
                升级计分模板
              </SmallButton>
            </div>
          )}
          {definition.scoringType === "sum" && !legacySumPreset && (
            <ReverseQuestionSelector
              definition={definition}
              disabled={disabled}
              onChange={onChange}
            />
          )}
          <ScoreRangeEditor
            disabled={disabled}
            ranges={definition.scoreRanges || []}
            onChange={(scoreRanges) => onChange({ ...definition, scoreRanges })}
          />
        </EditorSection>
      )}

      {hasDimensions && (
        <DimensionEditor
          definition={definition}
          disabled={disabled}
          onChange={onChange}
        />
      )}

      {hasMatchResults && (
        <MatchResultEditor
          definition={definition}
          disabled={disabled}
          fixedStructure={fixedStructure}
          onChange={onChange}
          onUploadStateChange={onUploadStateChange}
        />
      )}

      {profiles.length > 0 && (
        <ReportProfileEditor
          definition={definition}
          disabled={disabled}
          fixedStructure={fixedStructure}
          onChange={onChange}
          onUploadStateChange={onUploadStateChange}
        />
      )}

      {!hasScoreRanges && !hasDimensions && !hasMatchResults && profiles.length === 0 && (
        <EditorEmpty text="该固定计分量表没有可编辑的结构化报告内容，可在高级 JSON 中查看完整定义。" />
      )}
    </div>
  );
}

function ScoreCoveragePanel({
  summaries,
}: {
  summaries: AssessmentScoreCoverageSummary[];
}) {
  return (
    <EditorSection
      description="系统会精确枚举当前题目能够产生的分值；非必答题未填写按 0 分计算，平均分按运行时规则保留两位小数。所有可达分值都必须命中一个报告区间。"
      title="计分覆盖校验"
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {summaries.map((summary) => {
          const valid =
            !summary.validationError &&
            summary.uncoveredScores.length === 0;
          return (
            <div
              className={`rounded-xl border px-4 py-3 ${
                valid
                  ? "border-[#CFE1D6] bg-[#F2F7F4]"
                  : "border-[#E8B7B2] bg-[#FFF5F4]"
              }`}
              key={summary.path}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{summary.label}</div>
                  {summary.parentDimensionId && (
                    <p className="mt-1 text-xs text-[var(--lxxl-muted)]">
                      二级维度 · 从属于 {summary.parentDimensionId}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {summary.parentDimensionId && <Badge tone="gold">子维度</Badge>}
                  <Badge tone={valid ? "green" : "red"}>
                    {valid ? "覆盖完整" : "需要调整"}
                  </Badge>
                </div>
              </div>
              {summary.validationError ? (
                <p className="mt-2 text-xs leading-5 text-[#A13F37]">
                  {summary.validationError}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-xs leading-5 text-[var(--lxxl-muted)]">
                    可达范围 {formatCoverageScore(summary.minimum)}–
                    {formatCoverageScore(summary.maximum)}，共{" "}
                    {summary.reachableCount.toLocaleString("zh-CN")} 个可达分值。
                  </p>
                  {summary.uncoveredScores.length > 0 && (
                    <p className="mt-1 text-xs leading-5 text-[#A13F37]">
                      未覆盖：
                      {summary.uncoveredScores
                        .slice(0, 12)
                        .map(formatCoverageScore)
                        .join("、")}
                      {summary.uncoveredScores.length > 12
                        ? ` 等 ${summary.uncoveredScores.length.toLocaleString("zh-CN")} 个`
                        : ""}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </EditorSection>
  );
}

function formatCoverageScore(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("zh-CN")
    : value.toLocaleString("zh-CN", { maximumFractionDigits: 12 });
}

function ReverseQuestionSelector({
  definition,
  disabled,
  onChange,
}: {
  definition: AssessmentDefinition;
  disabled: boolean;
  onChange: (definition: AssessmentDefinition) => void;
}) {
  const reverseIds = definition.reverseQuestionIds || [];
  return (
    <div className="mb-4 rounded-xl border border-dashed border-[var(--lxxl-border)] bg-[#FCFBF8] p-4">
      <div className="text-sm font-medium">反向计分题</div>
      <div className="mt-3 flex flex-wrap gap-3">
        {definition.questions.map((question) => (
          <label
            key={question.id}
            className="flex items-center gap-2 rounded-lg border border-[var(--lxxl-border)] bg-white px-3 py-2 text-xs"
          >
            <input
              checked={reverseIds.includes(question.id)}
              disabled={disabled}
              type="checkbox"
              onChange={(event) =>
                onChange({
                  ...definition,
                  reverseQuestionIds: event.target.checked
                    ? [...reverseIds, question.id]
                    : reverseIds.filter((id) => id !== question.id),
                })
              }
            />
            {question.id} · {question.text || "未命名题目"}
          </label>
        ))}
      </div>
    </div>
  );
}

function DimensionEditor({
  definition,
  disabled,
  onChange,
}: {
  definition: AssessmentDefinition;
  disabled: boolean;
  onChange: (definition: AssessmentDefinition) => void;
}) {
  const dimensions = definition.dimensions || [];
  const [expandedQuestionSections, setExpandedQuestionSections] = useState<
    Record<number, boolean>
  >({});

  function setDimensions(next: AssessmentDimension[]) {
    onChange({ ...definition, dimensions: next });
  }

  return (
    <EditorSection
      action={
        <AddButton
          disabled={disabled}
          onClick={() => {
            const id = createStableId("dimension", dimensions.map((item) => item.id));
            const firstQuestionId = definition.questions[0]?.id;
            setDimensions([
              ...dimensions,
              {
                id,
                title: "",
                intro: "",
                questionIds: firstQuestionId ? [firstQuestionId] : [],
                reverseQuestionIds: [],
                calculationMode: "simple",
                aggregate: "sum",
                scoreRanges: [
                  {
                    min: 0,
                    max: 1,
                    level: "",
                    visitorDescription: "",
                    analystDescription: "",
                    suggestions: [],
                  },
                ],
              },
            ]);
          }}
        >
          新增维度
        </AddButton>
      }
      description="每个维度独立配置题目、计算方式和结果区间。将维度 ID 写成“父维度ID.子维度ID”（如 A.b）即可建立二级从属关系。"
      title="维度与报告区间"
    >
      <div className="space-y-4">
        {dimensions.map((dimension, dimensionIndex) => {
          const dimensionReverseIds = dimension.reverseQuestionIds || [];
          const calculationMode = dimension.calculationMode ?? "simple";
          const allQuestionIds = definition.questions.map((question) => question.id);
          const parentDimensionId = getDimensionParentId(dimension.id);
          const parentDimension = parentDimensionId
            ? dimensions.find((item) => item.id === parentDimensionId)
            : undefined;
          const questionsExpanded =
            expandedQuestionSections[dimensionIndex] ?? true;
          let formulaError = "";
          if (calculationMode === "formula") {
            try {
              compileDimensionFormula(dimension.formula ?? "", allQuestionIds);
            } catch (error) {
              formulaError = error instanceof Error ? error.message : "公式不合法";
            }
          }
          return (
            <div
              key={dimensionIndex}
              className={`rounded-xl border bg-[#FCFBF8] p-4 ${
                parentDimensionId
                  ? "ml-4 border-l-4 border-l-[var(--lxxl-green)]"
                  : "border-[var(--lxxl-border)]"
              }`}
            >
              <CardHeader
                index={dimensionIndex}
                label={`${parentDimensionId ? "↳ " : ""}${dimension.title || dimension.id || "未命名维度"}`}
                removeDisabled={disabled || dimensions.length <= 1}
                onRemove={() =>
                  setDimensions(dimensions.filter((_, index) => index !== dimensionIndex))
                }
              />
              {parentDimensionId && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#F2F7F4] px-3 py-2 text-xs text-[var(--lxxl-muted)]">
                  <Badge tone={parentDimension ? "green" : "red"}>二级维度</Badge>
                  <span>
                    从属于{" "}
                    <strong className="text-[var(--lxxl-text)]">
                      {parentDimension
                        ? `${parentDimension.title || parentDimension.id}（${parentDimensionId}）`
                        : parentDimensionId}
                    </strong>
                    {!parentDimension && "，请先创建对应的父维度"}
                  </span>
                </div>
              )}
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <CompactField label="维度 ID">
                  <input
                    className={compactInputClass}
                    disabled={disabled}
                    value={dimension.id}
                    onChange={(event) =>
                      setDimensions(
                        replaceAt(dimensions, dimensionIndex, {
                          ...dimension,
                          id: event.target.value,
                        }),
                      )
                    }
                  />
                </CompactField>
                <CompactField className="md:col-span-2" label="维度名称">
                  <input
                    className={compactInputClass}
                    disabled={disabled}
                    value={dimension.title}
                    onChange={(event) =>
                      setDimensions(
                        replaceAt(dimensions, dimensionIndex, {
                          ...dimension,
                          title: event.target.value,
                        }),
                      )
                    }
                  />
                </CompactField>
                <CompactField label="计算方式">
                  <div className="flex h-9 items-center gap-4 rounded-lg border border-[var(--lxxl-border)] bg-white px-3 text-sm">
                    {(["simple", "formula"] as const).map((mode) => (
                      <label className="flex cursor-pointer items-center gap-1.5" key={mode}>
                        <input
                          checked={calculationMode === mode}
                          disabled={disabled}
                          name={`dimension-calculation-${dimensionIndex}`}
                          type="radio"
                          onChange={() =>
                            setDimensions(
                              replaceAt(dimensions, dimensionIndex, {
                                ...dimension,
                                calculationMode: mode,
                                formula:
                                  mode === "formula"
                                    ? dimension.formula ?? dimension.questionIds.join(" + ")
                                    : undefined,
                              }),
                            )
                          }
                        />
                        {mode === "simple" ? "简单计算" : "设置公式计算"}
                      </label>
                    ))}
                  </div>
                </CompactField>
                {calculationMode === "simple" ? (
                  <CompactField className="md:col-span-4" label="简单计算">
                    <select
                      className={compactInputClass}
                      disabled={disabled}
                      value={dimension.aggregate}
                      onChange={(event) =>
                        setDimensions(
                          replaceAt(dimensions, dimensionIndex, {
                            ...dimension,
                            aggregate: event.target.value as AssessmentDimension["aggregate"],
                          }),
                        )
                      }
                    >
                      <option value="sum">全部相加</option>
                      <option value="product">全部相乘</option>
                      <option value="average">平均数</option>
                    </select>
                  </CompactField>
                ) : (
                  <CompactField className="md:col-span-4" label="计算公式">
                    <input
                      className={compactInputClass}
                      disabled={disabled}
                      placeholder="例如：(q1 + q2) / q3"
                      value={dimension.formula ?? ""}
                      onChange={(event) => {
                        const formula = event.target.value;
                        const questionIds = formulaQuestionIds(formula, allQuestionIds);
                        setDimensions(
                          replaceAt(dimensions, dimensionIndex, {
                            ...dimension,
                            formula,
                            questionIds,
                            reverseQuestionIds: dimensionReverseIds.filter((id) =>
                              questionIds.includes(id),
                            ),
                          }),
                        );
                      }}
                    />
                    <p className={`mt-1 text-xs ${formulaError ? "text-[#A13F37]" : "text-[var(--lxxl-muted)]"}`}>
                      {formulaError || "仅支持题目 ID、+、-、*、/ 和英文括号 ()。"}
                    </p>
                  </CompactField>
                )}
                <CompactField className="md:col-span-4" label="维度说明">
                  <textarea
                    className={compactTextareaClass}
                    disabled={disabled}
                    value={dimension.intro || ""}
                    onChange={(event) =>
                      setDimensions(
                        replaceAt(dimensions, dimensionIndex, {
                          ...dimension,
                          intro: event.target.value,
                        }),
                      )
                    }
                  />
                </CompactField>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--lxxl-border)] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    aria-expanded={questionsExpanded}
                    className="flex items-center gap-2 text-left text-sm font-medium"
                    type="button"
                    onClick={() =>
                      setExpandedQuestionSections((current) => ({
                        ...current,
                        [dimensionIndex]: !questionsExpanded,
                      }))
                    }
                  >
                    <span aria-hidden>{questionsExpanded ? "▾" : "▸"}</span>
                    <span>参与计算的题目</span>
                    <span className="text-xs font-normal text-[var(--lxxl-muted)]">
                      已选 {dimension.questionIds.length}/{definition.questions.length}
                    </span>
                  </button>
                  {questionsExpanded && (
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-[var(--lxxl-green)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={disabled}
                        type="button"
                        onClick={() =>
                          setDimensions(
                            replaceAt(dimensions, dimensionIndex, {
                              ...dimension,
                              questionIds: allQuestionIds,
                              formula:
                                calculationMode === "formula"
                                  ? allQuestionIds.join(" + ")
                                  : dimension.formula,
                            }),
                          )
                        }
                      >
                        全选题目
                      </button>
                      <button
                        className="text-xs text-[var(--lxxl-muted)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={disabled}
                        type="button"
                        onClick={() =>
                          setDimensions(
                            replaceAt(dimensions, dimensionIndex, {
                              ...dimension,
                              questionIds: [],
                              reverseQuestionIds: [],
                              formula:
                                calculationMode === "formula" ? "" : dimension.formula,
                            }),
                          )
                        }
                      >
                        取消全选
                      </button>
                    </div>
                  )}
                </div>
                {questionsExpanded && (
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {definition.questions.map((question) => {
                    const selected = dimension.questionIds.includes(question.id);
                    return (
                      <div
                        key={question.id}
                        className="rounded-lg border border-[var(--lxxl-border)] px-3 py-2"
                      >
                        <label className="flex items-start gap-2 text-xs leading-5">
                          <input
                            checked={selected}
                            className="mt-1"
                            disabled={disabled}
                            type="checkbox"
                            onChange={(event) => {
                              const questionIds = event.target.checked
                                ? [...dimension.questionIds, question.id]
                                : dimension.questionIds.filter((id) => id !== question.id);
                              const currentFormula = dimension.formula ?? "";
                              const formula =
                                calculationMode !== "formula"
                                  ? dimension.formula
                                  : event.target.checked
                                    ? currentFormula.trim()
                                      ? `${currentFormula.trim()} + ${question.id}`
                                      : question.id
                                    : removeFormulaQuestionId(
                                        currentFormula,
                                        question.id,
                                        allQuestionIds,
                                      );
                              setDimensions(
                                replaceAt(dimensions, dimensionIndex, {
                                  ...dimension,
                                  questionIds,
                                  formula,
                                  reverseQuestionIds: dimensionReverseIds.filter((id) =>
                                    questionIds.includes(id),
                                  ),
                                }),
                              );
                            }}
                          />
                          <span>
                            <span className="font-medium">{question.id}</span> ·{" "}
                            {question.text || "未命名题目"}
                          </span>
                        </label>
                        {selected && (
                          <label className="mt-2 flex items-center gap-2 pl-5 text-xs text-[var(--lxxl-muted)]">
                            <input
                              checked={dimensionReverseIds.includes(question.id)}
                              disabled={disabled}
                              type="checkbox"
                              onChange={(event) =>
                                setDimensions(
                                  replaceAt(dimensions, dimensionIndex, {
                                    ...dimension,
                                    reverseQuestionIds: event.target.checked
                                      ? [...dimensionReverseIds, question.id]
                                      : dimensionReverseIds.filter((id) => id !== question.id),
                                  }),
                                )
                              }
                            />
                            反向计分
                          </label>
                        )}
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <ScoreRangeEditor
                  disabled={disabled}
                  ranges={dimension.scoreRanges}
                  onChange={(scoreRanges) =>
                    setDimensions(
                      replaceAt(dimensions, dimensionIndex, { ...dimension, scoreRanges }),
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </EditorSection>
  );
}

function MatchResultEditor({
  definition,
  disabled,
  fixedStructure,
  onChange,
  onUploadStateChange,
}: {
  definition: AssessmentDefinition;
  disabled: boolean;
  fixedStructure: boolean;
  onChange: (definition: AssessmentDefinition) => void;
  onUploadStateChange: (delta: number) => void;
}) {
  const results = definition.matchResults || [];

  function setResults(next: AssessmentMatchResult[]) {
    onChange({ ...definition, matchResults: next });
  }

  function changeResult(index: number, next: AssessmentMatchResult) {
    const previous = results[index];
    if (previous.id === next.id) {
      setResults(replaceAt(results, index, next));
      return;
    }
    onChange({
      ...definition,
      matchResults: replaceAt(results, index, next),
      questions: definition.questions.map((question) => ({
        ...question,
        options: question.options.map((option) => {
          if (!option.matchTags || !(previous.id in option.matchTags)) {
            return option;
          }
          const matchTags = { ...option.matchTags };
          const weight = matchTags[previous.id];
          delete matchTags[previous.id];
          matchTags[next.id] = weight;
          return { ...option, matchTags };
        }),
      })),
    });
  }

  function removeResult(index: number) {
    const removedId = results[index].id;
    onChange({
      ...definition,
      matchResults: results.filter((_, itemIndex) => itemIndex !== index),
      questions: definition.questions.map((question) => ({
        ...question,
        options: question.options.map((option) => {
          if (!option.matchTags || !(removedId in option.matchTags)) {
            return option;
          }
          const matchTags = { ...option.matchTags };
          delete matchTags[removedId];
          return { ...option, matchTags };
        }),
      })),
    });
  }

  return (
    <EditorSection
      action={
        <AddButton
          disabled={disabled || fixedStructure}
          onClick={() => {
            const id = createStableId("result", results.map((item) => item.id));
            setResults([
              ...results,
              {
                id,
                title: "",
                description: "",
                suggestions: [],
                image: "",
                shareText: "",
              },
            ]);
          }}
        >
          新增结果
        </AddButton>
      }
      description="匹配权重最高的结果会生成对应报告；结果 ID 必须与题目选项中的匹配标签一致。"
      title="匹配结果报告"
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {results.map((result, resultIndex) => (
          <ReportContentCard
            key={resultIndex}
            disabled={disabled}
            fixedStructure={fixedStructure}
            imageHelpText="支持 JPEG、PNG、WebP，单张不超过 5MB；留空时 EAP 使用占位内容。"
            index={resultIndex}
            item={result}
            onChange={(next) => changeResult(resultIndex, next)}
            onRemove={() => removeResult(resultIndex)}
            onUploadStateChange={onUploadStateChange}
            removeDisabled={disabled || fixedStructure || results.length <= 1}
          />
        ))}
      </div>
    </EditorSection>
  );
}

function ReportProfileEditor({
  definition,
  disabled,
  fixedStructure,
  onChange,
  onUploadStateChange,
}: {
  definition: AssessmentDefinition;
  disabled: boolean;
  fixedStructure: boolean;
  onChange: (definition: AssessmentDefinition) => void;
  onUploadStateChange: (delta: number) => void;
}) {
  const profiles = definition.reportProfiles || [];

  function setProfiles(next: AssessmentReportProfile[]) {
    onChange({ ...definition, reportProfiles: next });
  }

  return (
    <EditorSection
      description="固定计分程序根据这些稳定 ID 选择报告文案。ID 和条目数量不可修改。"
      title="固定计分报告文案"
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {profiles.map((profile, profileIndex) => (
          <ReportContentCard
            key={profileIndex}
            disabled={disabled}
            fixedStructure={fixedStructure}
            imageHelpText="当前固定量表报告暂不展示此图片；保留字段用于协议兼容。"
            index={profileIndex}
            item={profile}
            onChange={(next) => setProfiles(replaceAt(profiles, profileIndex, next))}
            onRemove={() => setProfiles(profiles.filter((_, index) => index !== profileIndex))}
            onUploadStateChange={onUploadStateChange}
            removeDisabled={disabled || fixedStructure}
          />
        ))}
      </div>
    </EditorSection>
  );
}

function ReportContentCard<T extends AssessmentMatchResult | AssessmentReportProfile>({
  item,
  imageHelpText,
  index,
  disabled,
  fixedStructure,
  removeDisabled,
  onChange,
  onRemove,
  onUploadStateChange,
}: {
  item: T;
  imageHelpText: string;
  index: number;
  disabled: boolean;
  fixedStructure: boolean;
  removeDisabled: boolean;
  onChange: (item: T) => void;
  onRemove: () => void;
  onUploadStateChange: (delta: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--lxxl-border)] bg-[#FCFBF8] p-4">
      <CardHeader
        index={index}
        label={item.title || item.id || "未命名结果"}
        removeDisabled={removeDisabled}
        onRemove={onRemove}
      />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <CompactField label="结果 ID">
          <input
            className={compactInputClass}
            disabled={disabled || fixedStructure}
            value={item.id}
            onChange={(event) => onChange({ ...item, id: event.target.value })}
          />
        </CompactField>
        <CompactField label="结果标题">
          <input
            className={compactInputClass}
            disabled={disabled}
            value={item.title}
            onChange={(event) => onChange({ ...item, title: event.target.value })}
          />
        </CompactField>
        <CompactField className="md:col-span-2" label="结果说明">
          <textarea
            className={compactTextareaClass}
            disabled={disabled}
            value={item.description}
            onChange={(event) => onChange({ ...item, description: event.target.value })}
          />
        </CompactField>
        <CompactField className="md:col-span-2" label="建议（每行一条）">
          <LinesTextarea
            disabled={disabled}
            value={formatLines(item.suggestions)}
            onChange={(value) => onChange({ ...item, suggestions: parseLines(value) })}
          />
        </CompactField>
        <div className="block min-w-0 md:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-[var(--lxxl-muted)]">
            结果图片
          </span>
          <AssessmentImageField
            aspect="result"
            compact
            disabled={disabled}
            helpText={imageHelpText}
            inputLabel={`${item.title || item.id || `第 ${index + 1} 项`}结果图片地址`}
            value={item.image || ""}
            onChange={(image) => onChange({ ...item, image })}
            onUploadStateChange={onUploadStateChange}
          />
        </div>
        <CompactField label="分享文案">
          <input
            className={compactInputClass}
            disabled={disabled}
            value={item.shareText || ""}
            onChange={(event) => onChange({ ...item, shareText: event.target.value })}
          />
        </CompactField>
      </div>
    </div>
  );
}

function ScoreRangeEditor({
  ranges,
  disabled,
  onChange,
}: {
  ranges: AssessmentScoreRange[];
  disabled: boolean;
  onChange: (ranges: AssessmentScoreRange[]) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--lxxl-border)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">分数区间</div>
          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
            区间不可重叠，并需覆盖上方列出的全部可达分值；建议按分数从低到高排列。
          </div>
        </div>
        <SmallButton
          disabled={disabled}
          onClick={() =>
            onChange([
              ...ranges,
              {
                min: ranges.length
                  ? Math.max(...ranges.map((item) => (typeof item.max === "number" ? item.max : 0))) + 1
                  : 0,
                max: ranges.length
                  ? Math.max(...ranges.map((item) => (typeof item.max === "number" ? item.max : 0))) + 2
                  : 1,
                level: "",
                visitorDescription: "",
                analystDescription: "",
                suggestions: [],
              },
            ])
          }
        >
          添加区间
        </SmallButton>
      </div>
      <div className="mt-4 space-y-3">
        {ranges.map((range, rangeIndex) => (
          <div
            key={rangeIndex}
            className="rounded-xl border border-[var(--lxxl-border)] bg-[#FCFBF8] p-3"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[0.7fr_0.7fr_1fr_auto]">
              <CompactField label="最低分">
                <input
                  className={compactInputClass}
                  disabled={disabled}
                  step="any"
                  type="number"
                  value={range.min ?? ""}
                  onChange={(event) =>
                    onChange(
                      replaceAt(ranges, rangeIndex, {
                        ...range,
                        min: event.target.value === "" ? null : numberValue(event.target.value, 0),
                      }),
                    )
                  }
                />
              </CompactField>
              <CompactField label="最高分">
                <input
                  className={compactInputClass}
                  disabled={disabled}
                  step="any"
                  type="number"
                  value={range.max ?? ""}
                  onChange={(event) =>
                    onChange(
                      replaceAt(ranges, rangeIndex, {
                        ...range,
                        max: event.target.value === "" ? null : numberValue(event.target.value, 0),
                      }),
                    )
                  }
                />
              </CompactField>
              <CompactField label="结果等级">
                <input
                  className={compactInputClass}
                  disabled={disabled}
                  value={range.level}
                  onChange={(event) =>
                    onChange(
                      replaceAt(ranges, rangeIndex, {
                        ...range,
                        level: event.target.value,
                      }),
                    )
                  }
                />
              </CompactField>
              <div className="flex items-end justify-end pb-1">
                <RemoveButton
                  disabled={disabled || ranges.length <= 1}
                  label="删除区间"
                  onClick={() => onChange(ranges.filter((_, index) => index !== rangeIndex))}
                />
              </div>
            </div>
            <CompactField className="mt-3" label="面向来访结果说明" required>
              <textarea
                className={compactTextareaClass}
                disabled={disabled}
                value={range.visitorDescription}
                onChange={(event) =>
                  onChange(
                    replaceAt(ranges, rangeIndex, {
                      ...range,
                      visitorDescription: event.target.value,
                    }),
                  )
                }
              />
            </CompactField>
            <CompactField className="mt-3" label="面向分析方结果说明" required>
              <textarea
                className={compactTextareaClass}
                disabled={disabled}
                value={range.analystDescription}
                onChange={(event) =>
                  onChange(
                    replaceAt(ranges, rangeIndex, {
                      ...range,
                      analystDescription: event.target.value,
                    }),
                  )
                }
              />
            </CompactField>
            <CompactField className="mt-3" label="建议（每行一条）">
              <LinesTextarea
                disabled={disabled}
                value={formatLines(range.suggestions)}
                onChange={(value) =>
                  onChange(
                    replaceAt(ranges, rangeIndex, {
                      ...range,
                      suggestions: parseLines(value),
                    }),
                  )
                }
              />
            </CompactField>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvancedJsonEditor({
  jsonDraft,
  fixedScoring,
}: {
  jsonDraft: string;
  fixedScoring: boolean;
}) {
  return (
    <EditorSection
      action={
        <button
          className="h-9 rounded-xl border border-[var(--lxxl-green)] px-4 text-sm font-medium text-[var(--lxxl-green)] disabled:opacity-40"
          type="button"
          onClick={() => void navigator.clipboard.writeText(jsonDraft)}
        >
          复制 JSON
        </button>
      }
      description={
        fixedScoring
          ? "固定计分量表的 JSON 仅供核对，避免误改服务端计分依赖的稳定结构。"
          : "完整 JSON 由结构化表单实时生成，仅供核对和复制；请在对应表单区修改内容。"
      }
      title="完整量表 JSON"
    >
      <textarea
        aria-label="完整量表 JSON"
        className="min-h-[520px] w-full resize-y rounded-xl border border-[var(--lxxl-border)] bg-[#1F2925] p-4 font-mono text-xs leading-6 text-[#E8F2ED] outline-none focus:border-[var(--lxxl-green)] disabled:cursor-not-allowed disabled:opacity-80"
        readOnly
        spellCheck={false}
        value={jsonDraft}
      />
    </EditorSection>
  );
}

function VersionsPanel({
  detail,
  archived,
  loading,
  onRestore,
}: {
  detail?: AssessmentAdminDetail;
  archived: boolean;
  loading: boolean;
  onRestore: (version: number) => Promise<void>;
}) {
  if (!detail) {
    return <EditorEmpty text={loading ? "正在加载历史版本..." : "量表详情尚未加载。"} />;
  }
  if (detail.versions.length === 0) {
    return <EditorEmpty text="该量表还没有已发布的历史版本。" />;
  }

  return (
    <EditorSection
      description="历史发布版本不可直接修改。恢复会复制内容到草稿，确认并再次发布后才会对 EAP 用户生效。"
      title="已发布版本"
    >
      {detail.draftVersion && (
        <div className="mb-4 rounded-xl border border-[#E7D4A4] bg-[#FFF9E9] px-4 py-3 text-sm leading-6 text-[#816326]">
          当前已有 v{detail.draftVersion} 草稿。恢复历史版本会先备份并覆盖当前草稿，请确认没有其他管理员正在编辑。
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-[var(--lxxl-border)]">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">版本</th>
              <th className="px-5 py-3 font-medium">状态</th>
              <th className="px-5 py-3 font-medium">发布时间</th>
              <th className="px-5 py-3 font-medium">内容指纹</th>
              <th className="px-5 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {detail.versions.map((version) => (
              <tr key={version.version} className="border-t border-[var(--lxxl-border)]">
                <td className="px-5 py-4 font-medium">v{version.version}</td>
                <td className="px-5 py-4">
                  {detail.publishedVersion === version.version ? (
                    <Badge tone="green">当前发布</Badge>
                  ) : (
                    <Badge>历史版本</Badge>
                  )}
                </td>
                <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                  {formatFullDateTime(version.publishedAt)}
                </td>
                <td
                  className="max-w-[280px] truncate px-5 py-4 font-mono text-xs text-[var(--lxxl-muted)]"
                  title={version.revision}
                >
                  {version.revision}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    className="text-sm font-medium text-[var(--lxxl-green)] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={loading}
                    title={
                      archived
                        ? "恢复为草稿，发布后重新启用"
                        : detail.draftVersion
                          ? "备份并覆盖当前草稿"
                          : "恢复为草稿"
                    }
                    type="button"
                    onClick={() => void onRestore(version.version)}
                  >
                    恢复为草稿
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </EditorSection>
  );
}

function MatchWeightsEditor({
  value,
  results,
  disabled,
  onChange,
}: {
  value?: Record<string, number>;
  results: AssessmentMatchResult[];
  disabled: boolean;
  onChange: (value: Record<string, number>) => void;
}) {
  function setWeight(resultId: string, rawValue: string) {
    const next = { ...(value || {}) };
    if (rawValue.trim() === "") {
      delete next[resultId];
    } else {
      next[resultId] = numberValue(rawValue, 0);
    }
    onChange(next);
  }

  return (
    <div className="flex min-w-[180px] flex-wrap gap-2">
      {results.map((result) => (
        <label
          key={result.id}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-[var(--lxxl-border)] bg-white px-2"
          title={result.title}
        >
          <span className="max-w-20 truncate text-[11px] text-[var(--lxxl-muted)]">
            {result.id}
          </span>
          <input
            aria-label={`${result.title || result.id}匹配权重`}
            className="h-8 min-w-12 flex-1 bg-transparent text-right text-xs outline-none"
            disabled={disabled}
            placeholder="-"
            step="any"
            type="number"
            value={value?.[result.id] ?? ""}
            onChange={(event) => setWeight(result.id, event.target.value)}
          />
        </label>
      ))}
      {results.length === 0 && (
        <span className="text-xs leading-8 text-[#A13F37]">请先新增报告结果</span>
      )}
    </div>
  );
}

function LinesTextarea({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <textarea
      className={compactTextareaClass}
      disabled={disabled}
      value={draft}
      onBlur={() => {
        const normalized = formatLines(parseLines(draft));
        setDraft(normalized);
        onChange(normalized);
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        onChange(nextDraft);
      }}
    />
  );
}

function EditorSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--lxxl-border)] px-5 py-4">
        <div>
          <h4 className="font-semibold">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">{description}</p>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function CompactField({
  label,
  className = "",
  required = false,
  children,
}: {
  label: string;
  className?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--lxxl-muted)]">
        {label}
        {required && <span className="ml-1 text-[#B34B43]">*</span>}
      </span>
      {children}
    </label>
  );
}

function CardHeader({
  index,
  label,
  removeDisabled,
  onRemove,
}: {
  index: number;
  label: string;
  removeDisabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-[var(--lxxl-muted)]">第 {index + 1} 项</div>
        <div className="mt-1 truncate text-sm font-semibold">{label}</div>
      </div>
      <RemoveButton disabled={removeDisabled} label="删除" onClick={onRemove} />
    </div>
  );
}

function ActionHint({
  hint,
  children,
}: {
  hint?: string;
  children: ReactNode;
}) {
  if (!hint) {
    return <>{children}</>;
  }
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden w-64 rounded-lg bg-[#243028] px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg group-hover:block"
        role="tooltip"
      >
        {hint}
      </span>
    </span>
  );
}

function ConfirmOverlay({
  title,
  confirmLabel,
  cancelLabel = "取消",
  disabled = false,
  children,
  onCancel,
  onConfirm,
}: {
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  disabled?: boolean;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="mt-4">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="h-10 rounded-xl border border-[var(--lxxl-border)] px-4 text-sm font-medium text-[var(--lxxl-muted)]"
            disabled={disabled}
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="h-10 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white disabled:opacity-40"
            disabled={disabled}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function groupQuestionsBySource(questions: AssessmentQuestion[]) {
  const groups: Array<{ name: string; labels: string[] }> = [];
  for (const question of questions) {
    const name = question.sourceAssessmentTitle || "未标注来源";
    const label = question.sourceQuestionId || question.id;
    const current = groups.find((group) => group.name === name);
    if (current) {
      current.labels.push(label);
    } else {
      groups.push({ name, labels: [label] });
    }
  }
  return groups;
}

function AddButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="h-9 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SmallButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-lg border border-[var(--lxxl-border)] px-3 py-1.5 text-xs font-medium text-[var(--lxxl-green)] transition hover:border-[var(--lxxl-green)] disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RemoveButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="rounded-lg px-2 py-1 text-xs font-medium text-[#A13F37] transition hover:bg-[#FFF5F4] disabled:cursor-not-allowed disabled:opacity-30"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function EditorEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--lxxl-border)] bg-[#FCFBF8] px-5 py-10 text-center text-sm text-[var(--lxxl-muted)]">
      {text}
    </div>
  );
}

function replaceAt<T>(items: T[], index: number, next: T) {
  return items.map((item, itemIndex) => (itemIndex === index ? next : item));
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function serializeDefinition(definition: AssessmentDefinition) {
  return JSON.stringify(definition, null, 2);
}

function changeSignature(
  previous: unknown,
  next: unknown,
  path = "",
): { path: string; structural: boolean } | null {
  if (Object.is(previous, next)) {
    return null;
  }
  const previousObject = previous !== null && typeof previous === "object";
  const nextObject = next !== null && typeof next === "object";
  if (!previousObject || !nextObject) {
    return { path: path || "value", structural: false };
  }
  if (Array.isArray(previous) || Array.isArray(next)) {
    if (!Array.isArray(previous) || !Array.isArray(next) || previous.length !== next.length) {
      return { path: path || "list", structural: true };
    }
    for (let index = 0; index < previous.length; index += 1) {
      const child = changeSignature(previous[index], next[index], `${path}[${index}]`);
      if (child) {
        return child;
      }
    }
    return null;
  }
  const keys = new Set([
    ...Object.keys(previous as Record<string, unknown>),
    ...Object.keys(next as Record<string, unknown>),
  ]);
  for (const key of keys) {
    const child = changeSignature(
      (previous as Record<string, unknown>)[key],
      (next as Record<string, unknown>)[key],
      path ? `${path}.${key}` : key,
    );
    if (child) {
      return child;
    }
  }
  return null;
}

function lifecycleLabel(status: AssessmentAdminDetail["lifecycleStatus"]) {
  return status === "published" ? "已发布" : status === "draft" ? "草稿" : "已归档";
}

function lifecycleTone(
  status: AssessmentAdminDetail["lifecycleStatus"],
): "green" | "gold" | "red" {
  return status === "published" ? "green" : status === "draft" ? "gold" : "red";
}

function scoringTypeLabel(type: AssessmentScoringType) {
  const labels: Record<AssessmentScoringType, string> = {
    sum: "总分区间",
    dimension: "多维度",
    match: "结果匹配",
    aas: "AAS 固定计分",
    psqi: "PSQI 固定计分",
    pbi: "PBI 固定计分",
    cbcl: "CBCL 固定计分",
    "dark-light": "暗黑人格固定计分",
  };
  return labels[type];
}
