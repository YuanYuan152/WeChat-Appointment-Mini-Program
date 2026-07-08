import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { formatDateTime } from "@/lib/format";
import { API_BASE_URL } from "@/lib/api";
import {
  RISK_ASSESSMENT_ITEMS,
  RISK_ITEM_GUIDE_HINTS,
  RISK_LEVEL_GUIDE,
  calculateCrisisLevelChoice,
  formatRiskChoiceDisplay,
  normalizeRiskAssessment,
  normalizeRiskChoice,
  type RiskAssessmentData,
  type RiskAssessmentItemConfig,
  type RiskChoice,
} from "@/constants/caseRecordRiskAssessment";
import type { CounselorCaseRecord, CounselorCaseRecordRevision, CounselorCompletedConsultation } from "@/types/api";

import {
  Badge,
  EmptyState,
  Pagination,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";

export type CounselorRecordFormMode = "create" | "amend" | "view";

export interface CounselorRecordFormState {
  mode: CounselorRecordFormMode;
  consultationId: number;
  recordId?: number;
  title: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  riskAssessment: RiskAssessmentData;
  reason: string;
  headerInfo: Record<string, string>;
  photoUrls: string[];
  revisions?: CounselorCaseRecordRevision[];
  amendmentStatus?: string | null;
  amendmentRejectReason?: string | null;
}

export type CounselorRecordFormErrors = Record<string, string | undefined>;

const HEADER_FIELDS: Array<{ key: string; label: string; editable?: boolean }> = [
  { key: "code", label: "代码" },
  { key: "gender", label: "性别" },
  { key: "consult_method", label: "咨询方式" },
  { key: "session_number", label: "咨询次数" },
  { key: "start_year", label: "咨询开始年份" },
  { key: "start_month", label: "咨询开始月份" },
  { key: "start_day", label: "咨询开始日期" },
  { key: "start_hour", label: "咨询开始小时" },
  { key: "start_minute", label: "咨询开始分钟" },
  { key: "end_hour", label: "咨询结束小时" },
  { key: "end_minute", label: "咨询结束分钟" },
];

type CaseRecordTextKey = "subjective" | "objective" | "assessment" | "plan";
type ConsultationRecordStatusFilter = "ALL" | "PENDING" | "FILLED" | "AMENDED";

const CONSULTATION_RECORD_STATUS_OPTIONS: Array<{ value: ConsultationRecordStatusFilter; label: string }> = [
  { value: "ALL", label: "全部状态" },
  { value: "PENDING", label: "待填写" },
  { value: "FILLED", label: "已填写" },
  { value: "AMENDED", label: "已修改" },
];

const CASE_RECORD_TEXT_FIELDS: Array<{
  key: CaseRecordTextKey;
  label: string;
  hint?: string;
  placeholder: string;
}> = [
  {
    key: "subjective",
    label: "患者情况记录（主观陈述）",
    hint: "记录来访者本次陈述的主要内容、主诉与情绪状态。",
    placeholder: "请记录来访者主观陈述...",
  },
  {
    key: "objective",
    label: "客观观察",
    hint: "记录行为观察、情绪状态、量表结果或其它客观资料。",
    placeholder: "请记录客观观察与测试结果...",
  },
  {
    key: "assessment",
    label: "评估分析",
    hint: "记录风险等级判断、问题分析与咨询过程评估。",
    placeholder: "请记录风险等级判断、问题分析与咨询过程评估...",
  },
  {
    key: "plan",
    label: "计划方向",
    hint: "记录下次咨询方向、作业建议、处理措施或转介安排。",
    placeholder: "请记录咨询要点与处理措施...",
  },
];

export function CounselorRecordsPanel({
  consultations,
  records,
  selectedForm,
  listLoading,
  formLoading,
  formErrors,
  setSelectedForm,
  onClearFormError,
  onOpenCreate,
  onOpenView,
  onOpenAmend,
  onCloseForm,
  onSubmitForm,
}: {
  consultations?: CounselorCompletedConsultation[];
  records?: CounselorCaseRecord[];
  selectedForm?: CounselorRecordFormState;
  listLoading: boolean;
  formLoading: boolean;
  formErrors: CounselorRecordFormErrors;
  setSelectedForm: Dispatch<SetStateAction<CounselorRecordFormState | undefined>>;
  onClearFormError: (field: string) => void;
  onOpenCreate: (consultation: CounselorCompletedConsultation) => void;
  onOpenView: (recordId: number) => void;
  onOpenAmend: (recordId: number) => void;
  onCloseForm: () => void;
  onSubmitForm: () => void;
}) {
  const [consultationPage, setConsultationPage] = useState(1);
  const [consultationPageSize, setConsultationPageSize] = useState(20);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<ConsultationRecordStatusFilter>("ALL");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConsultationRecordStatusFilter>("ALL");
  const consultationRows = consultations || [];
  const recordRows = records || [];
  const recordById = useMemo(() => {
    const map = new Map<number, CounselorCaseRecord>();
    for (const record of recordRows) {
      map.set(record.Id, record);
    }
    return map;
  }, [recordRows]);
  const filteredConsultationRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return consultationRows.filter((item) => {
      const record = item.CaseRecordId ? recordById.get(item.CaseRecordId) : undefined;
      if (!matchesConsultationRecordStatus(item, record, statusFilter)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }
      return [
        item.PatientName,
        item.StartTime,
        item.EndTime,
        item.Note,
        record?.AmendmentStatus,
        item.HasRecord ? "已填写" : "待填写",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
    });
  }, [consultationRows, keyword, recordById, statusFilter]);
  const pagedConsultations = useMemo(() => {
    const start = (consultationPage - 1) * consultationPageSize;
    return filteredConsultationRows.slice(start, start + consultationPageSize);
  }, [consultationPage, consultationPageSize, filteredConsultationRows]);

  useEffect(() => {
    setConsultationPage(1);
  }, [keyword, statusFilter]);

  return (
    <>
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
        <div className="px-6 py-5 sm:px-7 lg:px-8">
          <h2 className="text-xl font-semibold tracking-normal">填写咨询记录</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            已完成咨询可以填写记录；已提交记录只能查看，如需修改需提交管理员审核。
          </p>
        </div>

        <div className="relative border-t border-[var(--lxxl-border)]">
          {listLoading && (consultationRows.length > 0 || recordRows.length > 0) && (
            <div className="absolute inset-x-0 top-0 z-10 bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
              正在加载咨询记录...
            </div>
          )}
          <form
            className="px-6 py-5 sm:px-7 lg:px-8"
            onSubmit={(event) => {
              event.preventDefault();
              setKeyword(keywordDraft.trim());
              setStatusFilter(statusDraft);
            }}
          >
            <h3 className="text-base font-semibold">咨询记录列表</h3>
            <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
              筛选待填写、已填写和已修改记录；选择单条咨询进行填写、查看或申请修改。
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <QueryField label="关键词">
                <input
                  className={queryControlClass}
                  placeholder="来访者姓名、时间"
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                />
              </QueryField>
              <QueryField label="记录状态">
                <select
                  className={queryControlClass}
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as ConsultationRecordStatusFilter)}
                >
                  {CONSULTATION_RECORD_STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </QueryField>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <QueryButton type="submit" />
              <QueryResetButton
                onClick={() => {
                  setKeywordDraft("");
                  setStatusDraft("ALL");
                  setKeyword("");
                  setStatusFilter("ALL");
                }}
              />
            </div>
          </form>

          {consultationRows.length === 0 ? (
            <EmptyState text={listLoading ? "正在加载咨询..." : "暂无可填写咨询。"} />
          ) : filteredConsultationRows.length === 0 ? (
            <EmptyState text="没有符合筛选条件的咨询记录。" />
          ) : (
            <>
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">来访者</th>
                    <th className="px-5 py-3 font-medium">咨询时间</th>
                    <th className="px-5 py-3 font-medium">记录状态</th>
                    <th className="px-5 py-3 font-medium">更新时间</th>
                    <th className="px-5 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedConsultations.map((item) => {
                    const record = item.CaseRecordId ? recordById.get(item.CaseRecordId) : undefined;
                    return (
                      <tr key={item.Id} className="border-t border-[var(--lxxl-border)]">
                        <td className="px-5 py-4 font-medium">{item.PatientName}</td>
                        <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                          {formatDateTime(item.StartTime)} 至 {formatDateTime(item.EndTime)}
                        </td>
                        <td className="px-5 py-4">{renderRecordStatusBadge(item, record)}</td>
                        <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                          {formatDateTime(item.RecordUpdatedAt || record?.UpdatedAt)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-3">
                            {item.CaseRecordId ? (
                              <>
                                <TableActionButton onClick={() => onOpenView(item.CaseRecordId || 0)}>
                                  查看
                                </TableActionButton>
                                <TableActionButton onClick={() => onOpenAmend(item.CaseRecordId || 0)}>
                                  申请修改
                                </TableActionButton>
                              </>
                            ) : (
                              <TableActionButton onClick={() => onOpenCreate(item)}>填写</TableActionButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                page={consultationPage}
                pageSize={consultationPageSize}
                total={filteredConsultationRows.length}
                onPageChange={setConsultationPage}
                onPageSizeChange={(next) => {
                  setConsultationPage(1);
                  setConsultationPageSize(next);
                }}
              />
            </>
          )}
        </div>
      </section>

      {selectedForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="presentation">
          <aside
            aria-label={selectedForm.title}
            aria-modal="true"
            className="flex h-full w-full max-w-[720px] flex-col border-l border-[var(--lxxl-border)] bg-white shadow-2xl"
            role="dialog"
          >
            <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
              <h3 className="text-lg font-semibold">{selectedForm.title}</h3>
              {selectedForm.amendmentRejectReason && (
                <p className="mt-2 text-sm text-[#A13F37]">驳回原因：{selectedForm.amendmentRejectReason}</p>
              )}
            </div>
            <div className="flex-1 overflow-auto px-6 py-5">
              <RecordFormFields
                errors={formErrors}
                form={selectedForm}
                readonly={selectedForm.mode === "view"}
                setForm={setSelectedForm}
                onClearError={onClearFormError}
              />
            </div>
            <div className="flex justify-start gap-3 border-t border-[var(--lxxl-border)] bg-white px-6 py-4">
              {selectedForm.mode !== "view" && (
                <QueryButton disabled={formLoading} onClick={onSubmitForm}>
                  {formLoading ? "提交中" : selectedForm.mode === "create" ? "提交记录" : "提交申请"}
                </QueryButton>
              )}
              <QueryResetButton onClick={onCloseForm}>关闭</QueryResetButton>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function matchesConsultationRecordStatus(
  consultation: CounselorCompletedConsultation,
  record: CounselorCaseRecord | undefined,
  statusFilter: ConsultationRecordStatusFilter,
) {
  if (statusFilter === "ALL") {
    return true;
  }
  if (statusFilter === "PENDING") {
    return !consultation.HasRecord && !consultation.CaseRecordId;
  }
  if (statusFilter === "AMENDED") {
    return Boolean(record?.AmendmentStatus);
  }
  return consultation.HasRecord && Boolean(consultation.CaseRecordId) && !record?.AmendmentStatus;
}

function renderRecordStatusBadge(
  consultation: CounselorCompletedConsultation,
  record: CounselorCaseRecord | undefined,
) {
  if (!consultation.HasRecord && !consultation.CaseRecordId) {
    return <Badge tone="gold">待填写</Badge>;
  }
  if (record?.AmendmentStatus) {
    const label = amendmentStatusLabel(record.AmendmentStatus);
    const tone = record.AmendmentStatus === "REJECTED" ? "red" : record.AmendmentStatus === "APPROVED" ? "green" : "gold";
    return <Badge tone={tone}>{label}</Badge>;
  }
  return <Badge tone="green">已填写</Badge>;
}

function amendmentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "修改待审核",
    APPROVED: "已修改",
    REJECTED: "修改被驳回",
  };
  return labels[status] || status;
}

function RecordFormFields({
  errors,
  form,
  readonly,
  setForm,
  onClearError,
}: {
  errors: CounselorRecordFormErrors;
  form: CounselorRecordFormState;
  readonly: boolean;
  setForm: Dispatch<SetStateAction<CounselorRecordFormState | undefined>>;
  onClearError: (field: string) => void;
}) {
  const updateField = (field: keyof CounselorRecordFormState, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    onClearError(String(field));
    onClearError("form");
  };
  const updateHeader = (key: string, value: string) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            headerInfo: { ...prev.headerInfo, [key]: value },
          }
        : prev,
    );
    onClearError(`header.${key}`);
    onClearError("form");
  };
  const updateRiskItem = (itemId: string, patch: Partial<{ choice: RiskChoice; note: string }>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const nextAssessment = normalizeRiskAssessment({
        items: {
          ...prev.riskAssessment.items,
          [itemId]: {
            choice: patch.choice ?? prev.riskAssessment.items[itemId]?.choice ?? "",
            note: patch.note ?? prev.riskAssessment.items[itemId]?.note ?? "",
          },
        },
      });
      return { ...prev, riskAssessment: nextAssessment };
    });
    onClearError("riskAssessment");
    onClearError(`risk.${itemId}`);
    onClearError("form");
  };

  return (
    <div className="space-y-6">
      {errors.form && (
        <div className="rounded-xl border border-[#F0B8B2] bg-[#FFF4F2] px-4 py-3 text-sm leading-6 text-[#A13F37]">
          {errors.form}
        </div>
      )}
      <div className="space-y-4">
        {CASE_RECORD_TEXT_FIELDS.map((item) => (
          <TextareaField
            key={item.key}
            error={errors[item.key]}
            hint={item.hint}
            label={item.label}
            placeholder={item.placeholder}
            required={!readonly}
            readonly={readonly}
            value={form[item.key]}
            onChange={(value) => updateField(item.key, value)}
          />
        ))}
      </div>

      <PhotoSection readonly={readonly} urls={form.photoUrls} />
      {(form.revisions || []).length > 0 && <RevisionHistory revisions={form.revisions || []} />}

      <RiskAssessmentFormSection
        error={errors.riskAssessment}
        readonly={readonly}
        value={form.riskAssessment}
        onChange={updateRiskItem}
      />

      {form.mode === "amend" && (
        <TextareaField
          label="修改原因"
          error={errors.reason}
          required={!readonly}
          readonly={readonly}
          value={form.reason}
          onChange={(value) => updateField("reason", value)}
        />
      )}

      <div className="border-t border-[var(--lxxl-border)] pt-5">
        <h4 className="text-sm font-semibold">表头信息</h4>
        <p className="mt-1 text-xs text-[var(--lxxl-muted)]">
          咨询单信息已自动带入，系统生成字段不可修改。
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {HEADER_FIELDS.map((item) => {
            const disabled = readonly || !item.editable;
            return (
              <QueryField
                key={item.key}
                error={errors[`header.${item.key}`]}
                label={item.label}
                required={!readonly}
              >
                <input
                  className={`${queryControlClass} disabled:bg-[#F7F4EF] disabled:text-[var(--lxxl-muted)]`}
                  disabled={disabled}
                  value={form.headerInfo[item.key] || ""}
                  onChange={(event) => updateHeader(item.key, event.target.value)}
                />
              </QueryField>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RiskAssessmentFormSection({
  error,
  readonly,
  value,
  onChange,
}: {
  error?: string;
  readonly: boolean;
  value: RiskAssessmentData;
  onChange: (itemId: string, patch: Partial<{ choice: RiskChoice; note: string }>) => void;
}) {
  const normalized = normalizeRiskAssessment(value);
  const crisisChoice = calculateCrisisLevelChoice(normalized);
  const crisisItem = RISK_ASSESSMENT_ITEMS.find((item) => item.id === "crisis_level");

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">
            个案风险评估表{!readonly && <span className="ml-1 text-[#B94A48]">*</span>}
          </h4>
          <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">
            请逐项选择对应选项；第 10 项由系统根据前 9 项自动计算，不可手动修改。
          </p>
        </div>
        {crisisItem && (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskLevelToneClass(crisisChoice)}`}>
            {formatRiskChoiceDisplay(crisisItem.id, crisisChoice)}
          </span>
        )}
      </div>
      {error && (
        <div className="mt-3 rounded-lg border border-[#F0B8B2] bg-[#FFF4F2] px-3 py-2 text-sm text-[#A13F37]">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {RISK_ASSESSMENT_ITEMS.map((item) => {
          if (item.id === "crisis_level") {
            return <CalculatedRiskLevel key={item.id} choice={crisisChoice} item={item} />;
          }
          return (
            <RiskQuestion
              key={item.id}
              item={item}
              readonly={readonly}
              value={normalized.items[item.id] || { choice: "", note: "" }}
              onChange={onChange}
            />
          );
        })}
      </div>

      <div className="mt-4 rounded-lg bg-[#FAF8F4] p-3 text-xs leading-6 text-[var(--lxxl-muted)]">
        <div className="font-semibold text-[#3D5A4E]">风险等级说明</div>
        <div className="mt-2 whitespace-pre-wrap">{RISK_LEVEL_GUIDE}</div>
      </div>
    </section>
  );
}

function RiskQuestion({
  item,
  readonly,
  value,
  onChange,
}: {
  item: RiskAssessmentItemConfig;
  readonly: boolean;
  value: { choice: RiskChoice; note?: string };
  onChange: (itemId: string, patch: Partial<{ choice: RiskChoice; note: string }>) => void;
}) {
  const selectedChoice = normalizeRiskChoice(value.choice || "", item.id);
  const displayChoices = readonly && selectedChoice ? item.choices.filter((choice) => choice === selectedChoice) : item.choices;
  const needsNote = selectedChoice && item.noteChoices.includes(selectedChoice);
  const noteRequired = selectedChoice && (item.noteRequiredChoices ?? item.noteChoices).includes(selectedChoice);
  const guideHint = RISK_ITEM_GUIDE_HINTS[item.id];

  return (
    <div className="border-t border-[var(--lxxl-border)] pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3D5A4E] text-xs font-semibold text-white">
          {item.index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#2C2C2C]">
            {item.label}
            {!readonly && <span className="ml-1 text-[#B94A48]">*</span>}
          </div>
          {item.description && <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">{item.description}</p>}
          {guideHint && (
            <div className="mt-3 whitespace-pre-wrap rounded-lg border-l-4 border-[#E4A94B] bg-[#FFF8E6] px-3 py-2 text-xs leading-5 text-[#8A5A16]">
              {guideHint}
            </div>
          )}
          <div className="mt-3 grid grid-cols-1 gap-2">
            {displayChoices.map((choice) => {
              const normalizedChoice = normalizeRiskChoice(choice, item.id);
              const active = selectedChoice === normalizedChoice;
              return (
                <button
                  key={choice}
                  className={`rounded-lg border px-3 py-2 text-left text-sm leading-6 transition ${
                    active
                      ? "border-[#3D5A4E] bg-[#EEF5F1] text-[#2F4D42]"
                      : "border-[var(--lxxl-border)] bg-white text-[#2C2C2C] hover:border-[#C9D5CE]"
                  } ${readonly ? "cursor-default hover:border-[var(--lxxl-border)]" : ""}`}
                  disabled={readonly}
                  type="button"
                  onClick={() => onChange(item.id, { choice: normalizedChoice, note: selectedChoice === normalizedChoice ? value.note || "" : "" })}
                >
                  {formatRiskChoiceDisplay(item.id, normalizedChoice)}
                </button>
              );
            })}
          </div>
          {needsNote && (
            <div className="mt-3">
              {readonly ? (
                <div className="rounded-lg bg-[#FAF8F4] px-3 py-2 text-sm leading-6 text-[var(--lxxl-muted)]">
                  {value.note?.trim() || "-"}
                </div>
              ) : (
                <textarea
                  className={`${queryControlClass} min-h-20 resize-y py-3 text-sm`}
                  placeholder={noteRequired ? "请填写具体说明" : "请填写具体说明（选填）"}
                  value={value.note || ""}
                  onChange={(event) => onChange(item.id, { note: event.target.value })}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalculatedRiskLevel({
  choice,
  item,
}: {
  choice: "A" | "B" | "C" | "D";
  item: RiskAssessmentItemConfig;
}) {
  const guideHint = RISK_ITEM_GUIDE_HINTS[item.id];

  return (
    <div className="border-t border-[var(--lxxl-border)] pt-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3D5A4E] text-xs font-semibold text-white">
          {item.index}
        </span>
        <div className="min-w-0 flex-1 rounded-lg bg-[#FAF8F4] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#2C2C2C]">{item.label}</div>
              <p className="mt-1 text-xs text-[var(--lxxl-muted)]">系统根据前 9 项自动计算，不可手动修改。</p>
              {guideHint && <p className="mt-2 text-xs leading-5 text-[#8A5A16]">{guideHint}</p>}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskLevelToneClass(choice)}`}>
              {formatRiskChoiceDisplay(item.id, choice)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function riskLevelToneClass(choice: RiskChoice) {
  if (choice === "A" || choice === "B") return "bg-[#FFF1ED] text-[#A13F37]";
  if (choice === "C") return "bg-[#FFF6DE] text-[#8A6A1E]";
  return "bg-[#EAF4EE] text-[#2F4D42]";
}

function PhotoSection({ urls, readonly }: { urls: string[]; readonly: boolean }) {
  const visibleUrls = urls.filter(Boolean);
  return (
    <section className="rounded-xl bg-[#FAF8F4] p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold">相关照片</h4>
          <p className="mt-1 text-xs text-[var(--lxxl-muted)]">可上传咨询相关照片，最多 9 张。</p>
        </div>
        <span className="text-xs text-[var(--lxxl-muted)]">{visibleUrls.length}/9</span>
      </div>
      {visibleUrls.length === 0 && readonly ? (
        <p className="mt-4 text-sm text-[var(--lxxl-muted)]">暂无相关照片</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {visibleUrls.map((url) => {
            const src = normalizePhotoUrl(url);
            return (
              <a
                key={url}
                className="group relative block aspect-square overflow-hidden rounded-lg border border-[var(--lxxl-border)] bg-white"
                href={src}
                rel="noreferrer"
                target="_blank"
              >
                <img
                  alt="咨询相关照片"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                  src={src}
                />
              </a>
            );
          })}
          {!readonly && visibleUrls.length < 9 && (
            <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-[#D6D0C8] bg-white text-2xl text-[var(--lxxl-muted)]">
              +
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RevisionHistory({ revisions }: { revisions: CounselorCaseRecordRevision[] }) {
  return (
    <section className="rounded-xl bg-[#FAF8F4] p-4">
      <h4 className="text-sm font-semibold">修改历史</h4>
      <div className="mt-3 space-y-3">
        {revisions.map((revision) => (
          <div key={revision.Id} className="rounded-xl bg-white p-4 text-sm leading-6">
            <div className="text-xs text-[var(--lxxl-muted)]">{formatDateTime(revision.RevisedAt)}</div>
            <RevisionLine label="患者情况" value={revision.Subjective} />
            <RevisionLine label="客观观察" value={revision.Objective} />
            <RevisionLine label="评估分析" value={revision.Assessment} />
            <RevisionLine label="计划方向" value={revision.Plan} />
            {(revision.PhotoUrls || []).length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {revision.PhotoUrls.filter(Boolean).map((url) => {
                  const src = normalizePhotoUrl(url);
                  return (
                    <a
                      key={url}
                      className="block aspect-square overflow-hidden rounded-lg border border-[var(--lxxl-border)]"
                      href={src}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <img alt="历史照片" className="h-full w-full object-cover" src={src} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function TextareaField({
  label,
  hint,
  error,
  placeholder,
  required,
  value,
  readonly,
  onChange,
}: {
  label: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  readonly: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <section className="rounded-xl bg-[#FAF8F4] p-4">
      <QueryField error={error} label={label} required={required}>
        {hint && <p className="-mt-1 mb-2 text-xs leading-5 text-[var(--lxxl-muted)]">{hint}</p>}
        <textarea
          className={`${queryControlClass} min-h-32 resize-y bg-white py-3`}
          placeholder={placeholder}
          readOnly={readonly}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </QueryField>
    </section>
  );
}

function RevisionLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mt-2 whitespace-pre-wrap text-[var(--lxxl-muted)]">
      <span className="font-medium text-[#2C2C2C]">{label}：</span>
      {value || "-"}
    </div>
  );
}

function normalizePhotoUrl(url: string) {
  if (/^(https?:|data:|blob:)/i.test(url)) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}
