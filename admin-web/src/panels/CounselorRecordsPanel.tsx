import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { formatDateTime } from "@/lib/format";
import type { CounselorCaseRecord, CounselorCompletedConsultation } from "@/types/api";

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
  riskLevel: "A" | "B" | "C" | "D";
  reason: string;
  headerInfo: Record<string, string>;
  photoUrls: string[];
  amendmentStatus?: string | null;
  amendmentRejectReason?: string | null;
}

const HEADER_FIELDS: Array<{ key: string; label: string }> = [
  { key: "code", label: "代码" },
  { key: "gender", label: "性别" },
  { key: "consult_method", label: "咨询方式" },
  { key: "session_number", label: "咨询次数" },
  { key: "start_year", label: "开始年份" },
  { key: "start_month", label: "开始月份" },
  { key: "start_day", label: "开始日期" },
  { key: "start_hour", label: "开始小时" },
  { key: "start_minute", label: "开始分钟" },
  { key: "end_hour", label: "结束小时" },
  { key: "end_minute", label: "结束分钟" },
  { key: "counselor_signature", label: "咨询师签名" },
];

const RISK_LEVEL_OPTIONS = [
  { value: "A", label: "一级风险/危机：转介处理" },
  { value: "B", label: "二级风险/危机：上报同心理咨询中心/督导/危机干预小组" },
  { value: "C", label: "三级风险/危机：告知相关联系人并讨论安全计划" },
  { value: "D", label: "无危机：一般咨询" },
] as const;

export function CounselorRecordsPanel({
  consultations,
  records,
  selectedForm,
  listLoading,
  formLoading,
  setSelectedForm,
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
  setSelectedForm: Dispatch<SetStateAction<CounselorRecordFormState | undefined>>;
  onOpenCreate: (consultation: CounselorCompletedConsultation) => void;
  onOpenView: (recordId: number) => void;
  onOpenAmend: (recordId: number) => void;
  onCloseForm: () => void;
  onSubmitForm: () => void;
}) {
  const [consultationPage, setConsultationPage] = useState(1);
  const [consultationPageSize, setConsultationPageSize] = useState(20);
  const [recordPage, setRecordPage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(20);
  const consultationRows = consultations || [];
  const recordRows = records || [];
  const pagedConsultations = useMemo(() => {
    const start = (consultationPage - 1) * consultationPageSize;
    return consultationRows.slice(start, start + consultationPageSize);
  }, [consultationPage, consultationPageSize, consultationRows]);
  const pagedRecords = useMemo(() => {
    const start = (recordPage - 1) * recordPageSize;
    return recordRows.slice(start, start + recordPageSize);
  }, [recordPage, recordPageSize, recordRows]);

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
          <div className="px-6 py-5 sm:px-7 lg:px-8">
            <h3 className="text-base font-semibold">已完成咨询</h3>
            <p className="mt-1 text-sm text-[var(--lxxl-muted)]">选择未填写记录的咨询进行填写。</p>
          </div>
          {consultationRows.length === 0 ? (
            <EmptyState text={listLoading ? "正在加载咨询..." : "暂无可填写咨询。"} />
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
                  {pagedConsultations.map((item) => (
                    <tr key={item.Id} className="border-t border-[var(--lxxl-border)]">
                      <td className="px-5 py-4 font-medium">{item.PatientName}</td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">
                        {formatDateTime(item.StartTime)} 至 {formatDateTime(item.EndTime)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={item.HasRecord ? "green" : "gold"}>{item.HasRecord ? "已填写" : "待填写"}</Badge>
                      </td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{formatDateTime(item.RecordUpdatedAt)}</td>
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
                  ))}
                </tbody>
              </table>
              <Pagination
                page={consultationPage}
                pageSize={consultationPageSize}
                total={consultationRows.length}
                onPageChange={setConsultationPage}
                onPageSizeChange={(next) => {
                  setConsultationPage(1);
                  setConsultationPageSize(next);
                }}
              />
            </>
          )}
        </div>

        <div className="border-t border-[var(--lxxl-border)]">
          <div className="px-6 py-5 sm:px-7 lg:px-8">
            <h3 className="text-base font-semibold">已提交记录</h3>
            <p className="mt-1 text-sm text-[var(--lxxl-muted)]">查看已提交内容、修改申请状态和时间戳。</p>
          </div>
          {recordRows.length === 0 ? (
            <EmptyState text={listLoading ? "正在加载记录..." : "暂无已提交记录。"} />
          ) : (
            <>
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">记录</th>
                    <th className="px-5 py-3 font-medium">咨询</th>
                    <th className="px-5 py-3 font-medium">创建时间</th>
                    <th className="px-5 py-3 font-medium">更新时间</th>
                    <th className="px-5 py-3 font-medium">修改申请</th>
                    <th className="px-5 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecords.map((item) => (
                    <tr key={item.Id} className="border-t border-[var(--lxxl-border)]">
                      <td className="px-5 py-4 font-medium">记录 #{item.Id}</td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">咨询 #{item.ConsultationId}</td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{formatDateTime(item.CreatedAt)}</td>
                      <td className="px-5 py-4 text-[var(--lxxl-muted)]">{formatDateTime(item.UpdatedAt)}</td>
                      <td className="px-5 py-4">
                        {item.AmendmentStatus ? (
                          <Badge tone={item.AmendmentStatus === "REJECTED" ? "red" : item.AmendmentStatus === "APPROVED" ? "green" : "gold"}>
                            {item.AmendmentStatus}
                          </Badge>
                        ) : (
                          <span className="text-[var(--lxxl-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-3">
                          <TableActionButton onClick={() => onOpenView(item.Id)}>查看</TableActionButton>
                          <TableActionButton onClick={() => onOpenAmend(item.Id)}>申请修改</TableActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={recordPage}
                pageSize={recordPageSize}
                total={recordRows.length}
                onPageChange={setRecordPage}
                onPageSizeChange={(next) => {
                  setRecordPage(1);
                  setRecordPageSize(next);
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
              <RecordFormFields form={selectedForm} readonly={selectedForm.mode === "view"} setForm={setSelectedForm} />
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

function RecordFormFields({
  form,
  readonly,
  setForm,
}: {
  form: CounselorRecordFormState;
  readonly: boolean;
  setForm: Dispatch<SetStateAction<CounselorRecordFormState | undefined>>;
}) {
  const updateField = (field: keyof CounselorRecordFormState, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
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
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold">表头信息</h4>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {HEADER_FIELDS.map((item) => (
            <QueryField key={item.key} label={item.label}>
              <input
                className={queryControlClass}
                readOnly={readonly}
                value={form.headerInfo[item.key] || ""}
                onChange={(event) => updateHeader(item.key, event.target.value)}
              />
            </QueryField>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <TextareaField
          label="主观资料"
          readonly={readonly}
          value={form.subjective}
          onChange={(value) => updateField("subjective", value)}
        />
        <TextareaField
          label="客观资料"
          readonly={readonly}
          value={form.objective}
          onChange={(value) => updateField("objective", value)}
        />
        <TextareaField
          label="评估"
          readonly={readonly}
          value={form.assessment}
          onChange={(value) => updateField("assessment", value)}
        />
        <TextareaField
          label="计划"
          readonly={readonly}
          value={form.plan}
          onChange={(value) => updateField("plan", value)}
        />
      </div>

      <QueryField label="风险/危机等级">
        <select
          className={queryControlClass}
          disabled={readonly}
          value={form.riskLevel}
          onChange={(event) => updateField("riskLevel", event.target.value)}
        >
          {RISK_LEVEL_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </QueryField>

      {form.mode === "amend" && (
        <TextareaField
          label="修改原因"
          readonly={readonly}
          value={form.reason}
          onChange={(value) => updateField("reason", value)}
        />
      )}

      {form.photoUrls.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">附件</h4>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {form.photoUrls.map((url) => (
              <a key={url} className="text-xs text-[var(--lxxl-green)] underline" href={url} rel="noreferrer" target="_blank">
                {url}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TextareaField({
  label,
  value,
  readonly,
  onChange,
}: {
  label: string;
  value: string;
  readonly: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <QueryField label={label}>
      <textarea
        className={`${queryControlClass} h-28 resize-none py-3`}
        readOnly={readonly}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </QueryField>
  );
}
