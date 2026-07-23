"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Badge, QueryField, queryControlClass } from "@/components/ui";
import {
  changeAssessmentScoringType,
  createDefaultAssessmentDefinition,
  createStableId,
  formatLines,
  isFixedScoringType,
  parseLines,
  validateAssessmentDefinition,
} from "@/lib/assessmentEditor";
import { formatFullDateTime } from "@/lib/format";
import type { AssessmentEditorMode } from "@/panels/AssessmentsPanel";
import type {
  AssessmentAdminDetail,
  AssessmentDefinition,
  AssessmentDemographicInputType,
  AssessmentDemographicQuestion,
  AssessmentDimension,
  AssessmentMatchResult,
  AssessmentQuestion,
  AssessmentReportProfile,
  AssessmentScoreRange,
  AssessmentScoringType,
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
    () => detail?.definition || createDefaultAssessmentDefinition("sum"),
    [detail?.definition],
  );
  const [currentDetail, setCurrentDetail] = useState(detail);
  const [definition, setDefinition] = useState<AssessmentDefinition>(initialDefinition);
  const [baseline, setBaseline] = useState(() => serializeDefinition(initialDefinition));
  const [activeTab, setActiveTab] = useState<EditorTab>(
    initialMode === "versions" ? "versions" : "basic",
  );
  const [jsonDraft, setJsonDraft] = useState(() => serializeDefinition(initialDefinition));
  const [localError, setLocalError] = useState("");
  const closeRef = useRef<() => void>(() => undefined);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const serializedDefinition = useMemo(() => serializeDefinition(definition), [definition]);
  const dirty = serializedDefinition !== baseline;
  const issues = useMemo(() => validateAssessmentDefinition(definition), [definition]);
  const blockingIssues = issues.filter((issue) => issue.severity === "error");
  const fixedScoring = isFixedScoringType(definition.scoringType);
  const archived = currentDetail?.lifecycleStatus === "archived";

  useEffect(() => {
    if (!detail || detail.revision === currentDetail?.revision) {
      return;
    }
    setCurrentDetail(detail);
    setDefinition(detail.definition);
    const nextBaseline = serializeDefinition(detail.definition);
    setBaseline(nextBaseline);
    setJsonDraft(nextBaseline);
    setLocalError("");
  }, [currentDetail?.revision, detail]);

  const attemptClose = useCallback(() => {
    if (actionLoading) {
      return;
    }
    if (dirty && !window.confirm("当前量表还有未保存的修改，确定关闭吗？")) {
      return;
    }
    onClose();
  }, [actionLoading, dirty, onClose]);

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
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousActiveElement?.focus();
    };
  }, []);

  function updateDefinition(next: AssessmentDefinition) {
    setDefinition(next);
    if (activeTab !== "advanced") {
      setJsonDraft(serializeDefinition(next));
    }
    setLocalError("");
  }

  function applyDetail(next: AssessmentAdminDetail) {
    setCurrentDetail(next);
    setDefinition(next.definition);
    const nextBaseline = serializeDefinition(next.definition);
    setBaseline(nextBaseline);
    setJsonDraft(nextBaseline);
    setLocalError("");
  }

  async function save() {
    if (blockingIssues.length > 0) {
      setLocalError(`请先处理 ${blockingIssues.length} 项校验问题，再保存草稿。`);
      return;
    }
    const result = await onSave(definition);
    if (result) {
      applyDetail(result);
    }
  }

  async function publish() {
    if (!currentDetail || dirty || !currentDetail.draftVersion) {
      return;
    }
    if (!window.confirm(`确定发布 ${definition.title || definition.id} 的 v${currentDetail.draftVersion} 草稿吗？`)) {
      return;
    }
    const result = await onPublish(currentDetail);
    if (result) {
      applyDetail(result);
    }
  }

  async function archive() {
    if (!currentDetail || archived) {
      return;
    }
    if (!window.confirm("归档后 EAP 用户将无法继续打开该量表，确定归档吗？")) {
      return;
    }
    const result = await onArchive(currentDetail);
    if (result) {
      applyDetail(result);
      onClose();
    }
  }

  async function restoreVersion(version: number) {
    if (!currentDetail) {
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
            disabled={actionLoading}
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
                  disabled={archived || actionLoading}
                  fixedScoring={fixedScoring}
                  isCreate={isCreate}
                  onChange={updateDefinition}
                />
              )}
              {activeTab === "demographics" && (
                <DemographicFields
                  definition={definition}
                  disabled={archived || actionLoading}
                  fixedStructure={false}
                  onChange={updateDefinition}
                />
              )}
              {activeTab === "questions" && (
                <QuestionFields
                  definition={definition}
                  disabled={archived || actionLoading}
                  fixedStructure={fixedScoring}
                  onChange={updateDefinition}
                />
              )}
              {activeTab === "results" && (
                <ResultFields
                  definition={definition}
                  disabled={archived || actionLoading}
                  fixedStructure={fixedScoring}
                  onChange={updateDefinition}
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
                  loading={detailLoading || actionLoading}
                  onRestore={restoreVersion}
                />
              )}
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-[var(--lxxl-border)] bg-white px-5 py-4 sm:px-6">
          {(localError || blockingIssues.length > 0) && (
            <div className="mb-3 rounded-xl bg-[#FFF5F4] px-4 py-3 text-sm text-[#A13F37]">
              {localError || `当前有 ${blockingIssues.length} 项内容需要完善。`}
              {blockingIssues.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                  {blockingIssues.slice(0, 6).map((issue) => (
                    <li key={`${issue.path}-${issue.message}`}>
                      {issue.path ? `${issue.path}：` : ""}
                      {issue.message}
                    </li>
                  ))}
                  {blockingIssues.length > 6 && <li>另有 {blockingIssues.length - 6} 项未显示</li>}
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
              <button
                className="h-10 rounded-xl border border-[var(--lxxl-border)] px-4 text-sm font-medium text-[var(--lxxl-muted)] transition hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)] disabled:opacity-40"
                disabled={actionLoading}
                type="button"
                onClick={attemptClose}
              >
                关闭
              </button>
              {currentDetail && !archived && (
                <button
                  className="h-10 rounded-xl border border-[#E8B7B2] px-4 text-sm font-medium text-[#A13F37] transition hover:bg-[#FFF5F4] disabled:opacity-40"
                  disabled={actionLoading}
                  type="button"
                  onClick={() => void archive()}
                >
                  归档
                </button>
              )}
              {!archived && (
                <button
                  className="h-10 rounded-xl border border-[var(--lxxl-green)] px-4 text-sm font-medium text-[var(--lxxl-green)] transition hover:bg-[#F2F7F4] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={actionLoading || !currentDetail?.draftVersion || dirty}
                  title={
                    dirty
                      ? "请先保存当前修改"
                      : currentDetail?.draftVersion
                        ? "发布当前草稿"
                        : "当前没有可发布草稿"
                  }
                  type="button"
                  onClick={() => void publish()}
                >
                  发布草稿
                </button>
              )}
              {!archived && activeTab !== "versions" && (
                <button
                  className="h-10 rounded-xl bg-[var(--lxxl-green)] px-5 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={actionLoading || blockingIssues.length > 0 || (!dirty && Boolean(currentDetail))}
                  type="button"
                  onClick={() => void save()}
                >
                  {actionLoading ? "处理中..." : isCreate && !currentDetail ? "创建草稿" : "保存草稿"}
                </button>
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
}: {
  definition: AssessmentDefinition;
  isCreate: boolean;
  fixedScoring: boolean;
  disabled: boolean;
  onChange: (definition: AssessmentDefinition) => void;
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

      <EditorSection description="这些内容会显示在 EAP 量表列表和答题引导页。" title="展示信息">
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
          <QueryField label="封面图片地址" required>
            <input
              className={queryControlClass}
              disabled={disabled}
              placeholder="/static/assessments/example.jpg"
              value={definition.cover}
              onChange={(event) => patch({ cover: event.target.value })}
            />
          </QueryField>
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
          <QueryField className="md:col-span-2" label="答题说明">
            <textarea
              className={textareaClass}
              disabled={disabled}
              value={definition.instructions || ""}
              onChange={(event) => patch({ instructions: event.target.value })}
            />
          </QueryField>
          <QueryField className="md:col-span-2" label="量表特点">
            <textarea
              className={textareaClass}
              disabled={disabled}
              value={definition.features || ""}
              onChange={(event) => patch({ features: event.target.value })}
            />
          </QueryField>
          <QueryField className="md:col-span-2" label="报告引导文案">
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
}: {
  definition: AssessmentDefinition;
  disabled: boolean;
  fixedStructure: boolean;
  onChange: (definition: AssessmentDefinition) => void;
}) {
  const questions = definition.questions;

  function setQuestions(next: AssessmentQuestion[]) {
    onChange({ ...definition, questions: next });
  }

  function updateQuestion(index: number, next: AssessmentQuestion) {
    setQuestions(replaceAt(questions, index, next));
  }

  function changeQuestionId(index: number, nextId: string) {
    const previousId = questions[index].id;
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
      })),
    });
  }

  function removeQuestion(index: number) {
    const removedId = questions[index].id;
    onChange({
      ...definition,
      questions: questions.filter((_, itemIndex) => itemIndex !== index),
      reverseQuestionIds: definition.reverseQuestionIds?.filter((id) => id !== removedId),
      dimensions: definition.dimensions?.map((dimension) => ({
        ...dimension,
        questionIds: dimension.questionIds.filter((id) => id !== removedId),
        reverseQuestionIds: dimension.reverseQuestionIds?.filter((id) => id !== removedId),
      })),
    });
  }

  function addQuestion() {
    const id = createStableId("q", questions.map((item) => item.id));
    const optionIds = new Set(questions.flatMap((item) => item.options.map((option) => option.id)));
    const firstId = createStableId(`${id}-a`, Array.from(optionIds));
    optionIds.add(firstId);
    const secondId = createStableId(`${id}-b`, Array.from(optionIds));
    setQuestions([
      ...questions,
      {
        id,
        text: "",
        required: true,
        options: [
          { id: firstId, text: "", value: 0 },
          { id: secondId, text: "", value: 1 },
        ],
      },
    ]);
  }

  return (
    <EditorSection
      action={
        <AddButton disabled={disabled || fixedStructure} onClick={addQuestion}>
          新增题目
        </AddButton>
      }
      description={
        fixedStructure
          ? "固定计分量表可修改题目和选项文案，但题目 ID、选项 ID、分值及题目数量保持锁定。"
          : "选项 ID 在整份量表内必须唯一；匹配型量表可分别填写每个报告结果的权重。"
      }
      title="正式题目与选项"
    >
      <div className="space-y-4">
        {questions.map((question, questionIndex) => (
          <div
            key={questionIndex}
            className="rounded-xl border border-[var(--lxxl-border)] bg-[#FCFBF8] p-4"
          >
            <CardHeader
              index={questionIndex}
              label={question.text || question.id || "未命名题目"}
              removeDisabled={disabled || fixedStructure || questions.length <= 1}
              onRemove={() => removeQuestion(questionIndex)}
            />
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <CompactField label="题目 ID">
                <input
                  className={compactInputClass}
                  disabled={disabled || fixedStructure}
                  value={question.id}
                  onChange={(event) => changeQuestionId(questionIndex, event.target.value)}
                />
              </CompactField>
              <CompactField className="md:col-span-3" label="题目内容">
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

            <div className="mt-4 rounded-xl border border-[var(--lxxl-border)] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">选项</div>
                <SmallButton
                  disabled={disabled || fixedStructure}
                  onClick={() => {
                    const allOptionIds = questions.flatMap((item) =>
                      item.options.map((option) => option.id),
                    );
                    const id = createStableId(`${question.id}-option`, allOptionIds);
                    updateQuestion(questionIndex, {
                      ...question,
                      options: [...question.options, { id, text: "", value: question.options.length }],
                    });
                  }}
                >
                  添加选项
                </SmallButton>
              </div>
              <div className="mt-3 space-y-3">
                {question.options.map((option, optionIndex) => (
                  <div
                    key={optionIndex}
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
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </EditorSection>
  );
}

function ResultFields({
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
  const hasScoreRanges = definition.scoringType === "sum" || definition.scoringType === "psqi";
  const hasDimensions = definition.scoringType === "dimension";
  const hasMatchResults = definition.scoringType === "match" || definition.scoringType === "aas";
  const profiles = definition.reportProfiles || [];

  return (
    <div className="space-y-5">
      {hasScoreRanges && (
        <EditorSection
          description="每个分数只能落入一个区间；上下限包含边界值。"
          title="总分报告区间"
        >
          {definition.scoringType === "sum" && (
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
        />
      )}

      {profiles.length > 0 && (
        <ReportProfileEditor
          definition={definition}
          disabled={disabled}
          fixedStructure={fixedStructure}
          onChange={onChange}
        />
      )}

      {!hasScoreRanges && !hasDimensions && !hasMatchResults && profiles.length === 0 && (
        <EditorEmpty text="该固定计分量表没有可编辑的结构化报告内容，可在高级 JSON 中查看完整定义。" />
      )}
    </div>
  );
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
                aggregate: "sum",
                scoreRanges: [
                  {
                    min: 0,
                    max: 1,
                    level: "",
                    description: "",
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
      description="每个维度选择参与计算的题目，可单独设置反向计分题和结果区间。"
      title="维度与报告区间"
    >
      <div className="space-y-4">
        {dimensions.map((dimension, dimensionIndex) => {
          const dimensionReverseIds = dimension.reverseQuestionIds || [];
          return (
            <div
              key={dimensionIndex}
              className="rounded-xl border border-[var(--lxxl-border)] bg-[#FCFBF8] p-4"
            >
              <CardHeader
                index={dimensionIndex}
                label={dimension.title || dimension.id || "未命名维度"}
                removeDisabled={disabled || dimensions.length <= 1}
                onRemove={() =>
                  setDimensions(dimensions.filter((_, index) => index !== dimensionIndex))
                }
              />
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
                <CompactField label="汇总方式">
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
                    <option value="sum">求和</option>
                    <option value="average">平均值</option>
                  </select>
                </CompactField>
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
                <div className="text-sm font-medium">参与计算的题目</div>
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
                              setDimensions(
                                replaceAt(dimensions, dimensionIndex, {
                                  ...dimension,
                                  questionIds,
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
}: {
  definition: AssessmentDefinition;
  disabled: boolean;
  fixedStructure: boolean;
  onChange: (definition: AssessmentDefinition) => void;
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
            index={resultIndex}
            item={result}
            onChange={(next) => changeResult(resultIndex, next)}
            onRemove={() => removeResult(resultIndex)}
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
}: {
  definition: AssessmentDefinition;
  disabled: boolean;
  fixedStructure: boolean;
  onChange: (definition: AssessmentDefinition) => void;
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
            index={profileIndex}
            item={profile}
            onChange={(next) => setProfiles(replaceAt(profiles, profileIndex, next))}
            onRemove={() => setProfiles(profiles.filter((_, index) => index !== profileIndex))}
            removeDisabled={disabled || fixedStructure}
          />
        ))}
      </div>
    </EditorSection>
  );
}

function ReportContentCard<T extends AssessmentMatchResult | AssessmentReportProfile>({
  item,
  index,
  disabled,
  fixedStructure,
  removeDisabled,
  onChange,
  onRemove,
}: {
  item: T;
  index: number;
  disabled: boolean;
  fixedStructure: boolean;
  removeDisabled: boolean;
  onChange: (item: T) => void;
  onRemove: () => void;
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
        <CompactField label="结果图片">
          <input
            className={compactInputClass}
            disabled={disabled}
            value={item.image || ""}
            onChange={(event) => onChange({ ...item, image: event.target.value })}
          />
        </CompactField>
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
          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">区间不可重叠，建议按分数从低到高排列。</div>
        </div>
        <SmallButton
          disabled={disabled}
          onClick={() =>
            onChange([
              ...ranges,
              {
                min: ranges.length ? Math.max(...ranges.map((item) => item.max)) + 1 : 0,
                max: ranges.length ? Math.max(...ranges.map((item) => item.max)) + 2 : 1,
                level: "",
                description: "",
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[0.7fr_0.7fr_1fr_2fr_auto]">
              <CompactField label="最低分">
                <input
                  className={compactInputClass}
                  disabled={disabled}
                  step="any"
                  type="number"
                  value={range.min}
                  onChange={(event) =>
                    onChange(
                      replaceAt(ranges, rangeIndex, {
                        ...range,
                        min: numberValue(event.target.value, 0),
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
                  value={range.max}
                  onChange={(event) =>
                    onChange(
                      replaceAt(ranges, rangeIndex, {
                        ...range,
                        max: numberValue(event.target.value, 0),
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
              <CompactField label="结果说明">
                <textarea
                  className={compactTextareaClass}
                  disabled={disabled}
                  value={range.description}
                  onChange={(event) =>
                    onChange(
                      replaceAt(ranges, rangeIndex, {
                        ...range,
                        description: event.target.value,
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
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--lxxl-muted)]">{label}</span>
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
