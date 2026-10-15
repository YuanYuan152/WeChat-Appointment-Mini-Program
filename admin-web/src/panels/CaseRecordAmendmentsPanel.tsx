import { useEffect, useRef, useState } from "react";

import type { CaseRecordAmendment } from "@/types/api";
import { formatDateTime } from "@/lib/format";
import { CaseRecordsViewSwitch } from "@/components/CaseRecordsViewSwitch";
import { Badge, CollapsibleSection, PanelHeader, TableActionButton } from "@/components/ui";
import { QueryButton, QueryField, QueryResetButton, queryControlClass } from "@/components/ui";
import { DetailDrawer } from "@/components/boards/DetailDrawer";
import type { CaseRecordPeriod } from "@/services/records";

const PERIOD_OPTIONS: Array<{ value: CaseRecordPeriod; label: string }> = [
  { value: "all", label: "全部时间" },
  { value: "month", label: "本月" },
  { value: "week", label: "一周内" },
  { value: "today", label: "当天" },
];

export function CaseRecordAmendmentsPanel({
  amendments,
  amendmentsLoading,
  focusedAmendmentId,
  amendmentStatus,
  setAmendmentStatus,
  period,
  setPeriod,
  counselorKeyword,
  setCounselorKeyword,
  onApplyFilters,
  onResetFilters,
  onApproveAmendment,
  onRejectAmendment,
}: {
  amendments?: CaseRecordAmendment[];
  amendmentsLoading?: boolean;
  focusedAmendmentId?: number | null;
  amendmentStatus: string;
  setAmendmentStatus: (value: string) => void;
  period: CaseRecordPeriod;
  setPeriod: (value: CaseRecordPeriod) => void;
  counselorKeyword: string;
  setCounselorKeyword: (value: string) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onApproveAmendment: (amendmentId: number) => void;
  onRejectAmendment: (amendmentId: number, rejectReason: string) => void;
}) {
  const [selectedAmendment, setSelectedAmendment] = useState<CaseRecordAmendment | null>(null);
  const [rejectingAmendment, setRejectingAmendment] = useState<CaseRecordAmendment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const focusedAmendmentHandledRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusedAmendmentId) {
      focusedAmendmentHandledRef.current = null;
      return;
    }
    if (focusedAmendmentHandledRef.current === focusedAmendmentId) {
      return;
    }
    const matched = amendments?.find((item) => item.id === focusedAmendmentId);
    if (!matched) {
      return;
    }
    focusedAmendmentHandledRef.current = focusedAmendmentId;
    setSelectedAmendment(matched);
  }, [amendments, focusedAmendmentId]);

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader
        title="咨询记录审核"
        description="咨询师提交修改申请后，管理员可查看变更内容并通过或驳回。"
        action={<CaseRecordsViewSwitch active="amendments" />}
      />
      <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
        <div className="flex flex-wrap items-end gap-4">
          <QueryField label="时间范围" className="w-full sm:w-44">
            <select
              className={queryControlClass}
              value={period}
              onChange={(event) => setPeriod(event.target.value as CaseRecordPeriod)}
            >
              {PERIOD_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </QueryField>
          <QueryField label="审核状态" className="w-full sm:w-56">
            <select
              className={queryControlClass}
              value={amendmentStatus}
              onChange={(event) => setAmendmentStatus(event.target.value)}
            >
              <option value="PENDING">待审核</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已拒绝</option>
              <option value="ALL">全部</option>
            </select>
          </QueryField>
          <QueryField label="咨询师姓名" className="w-full sm:w-56">
            <input
              className={queryControlClass}
              placeholder="输入咨询师姓名"
              value={counselorKeyword}
              onChange={(event) => setCounselorKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onApplyFilters();
              }}
            />
          </QueryField>
          <QueryButton onClick={onApplyFilters}>查询</QueryButton>
          <QueryResetButton onClick={onResetFilters}>重置</QueryResetButton>
        </div>
      </div>
      <div className="relative px-1 pb-2">
        {amendmentsLoading && amendments && amendments.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在刷新修改申请...
          </div>
        )}
        {!amendments || amendments.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[var(--lxxl-muted)]">
            {amendmentsLoading ? "正在加载修改申请..." : "暂无修改申请。"}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">提交时间</th>
                <th className="px-5 py-3 font-medium">咨询师</th>
                <th className="px-5 py-3 font-medium">咨询时间</th>
                <th className="px-5 py-3 font-medium">原因</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {amendments.map((item) => (
                <tr key={item.id} className="border-t border-[var(--lxxl-border)]">
                  <td className="px-5 py-4 text-[var(--lxxl-muted)]">{formatDateTime(item.createdAt)}</td>
                  <td className="px-5 py-4 font-medium">{item.counselorName}</td>
                  <td className="px-5 py-4 text-[var(--lxxl-muted)]">{amendmentConsultationTime(item)}</td>
                  <td className="max-w-xs px-5 py-4 text-[var(--lxxl-muted)]">{item.reason || "-"}</td>
                  <td className="px-5 py-4">
                    <Badge tone={item.status === "REJECTED" ? "red" : item.status === "APPROVED" ? "green" : "gold"}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-3">
                      <TableActionButton disabled={amendmentsLoading} onClick={() => setSelectedAmendment(item)}>
                        查看
                      </TableActionButton>
                      {item.status === "PENDING" && (
                        <>
                          <TableActionButton disabled={amendmentsLoading} onClick={() => onApproveAmendment(item.id)}>
                            通过
                          </TableActionButton>
                          <TableActionButton
                            disabled={amendmentsLoading}
                            tone="danger"
                            onClick={() => {
                              setRejectingAmendment(item);
                              setRejectReason("");
                            }}
                          >
                            驳回
                          </TableActionButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selectedAmendment && (
        <DetailDrawer title="咨询记录修改申请" onClose={() => setSelectedAmendment(null)}>
          <div className="text-sm text-[var(--lxxl-muted)]">
            咨询师：{selectedAmendment.counselorName} · 咨询时间：{amendmentConsultationTime(selectedAmendment)}
          </div>
          {(() => {
            const changedFields = amendmentChangedFields(selectedAmendment);
            return (
              <>
                {changedFields.map((field) => (
                  <RecordCompareBlock
                    key={field.key}
                    title={field.title}
                    current={field.current}
                    proposed={field.proposed}
                  />
                ))}
                {changedFields.length === 0 && (
                  <div className="mt-4 text-sm text-[var(--lxxl-muted)]">本次申请无文字字段变更。</div>
                )}
              </>
            );
          })()}
          <div className="mt-6 text-sm">
            <div className="font-semibold">修改原因</div>
            <div className="mt-2 whitespace-pre-wrap text-[var(--lxxl-muted)]">{selectedAmendment.reason || "-"}</div>
          </div>
        </DetailDrawer>
      )}
      {rejectingAmendment && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-6">
          <section className="w-full max-w-lg rounded-xl border border-[var(--lxxl-border)] bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">驳回修改申请</h3>
            <p className="mt-2 text-sm text-[var(--lxxl-muted)]">
              {rejectingAmendment.counselorName} · {amendmentConsultationTime(rejectingAmendment)}
            </p>
            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-medium text-[var(--lxxl-muted)]">驳回原因</span>
              <textarea
                className={`${queryControlClass} h-28 resize-none py-3`}
                placeholder="请输入驳回原因"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <QueryResetButton
                onClick={() => {
                  setRejectingAmendment(null);
                  setRejectReason("");
                }}
              >
                关闭
              </QueryResetButton>
              <QueryButton
                disabled={!rejectReason.trim()}
                onClick={() => {
                  onRejectAmendment(rejectingAmendment.id, rejectReason);
                  setRejectingAmendment(null);
                  setRejectReason("");
                }}
              >
                确认
              </QueryButton>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function amendmentConsultationTime(item: CaseRecordAmendment) {
  return item.consultationStartTime ? formatDateTime(item.consultationStartTime) : "-";
}

function amendmentChangedFields(item: CaseRecordAmendment) {
  const fields = [
    {
      key: "subjective",
      title: "患者情况记录（主观陈述）",
      current: item.current.subjective,
      proposed: item.proposed.subjective,
    },
    {
      key: "objective",
      title: "客观观察",
      current: item.current.objective,
      proposed: item.proposed.objective,
    },
    {
      key: "assessment",
      title: "评估分析",
      current: item.current.assessment,
      proposed: item.proposed.assessment,
    },
    {
      key: "plan",
      title: "计划方向",
      current: item.current.plan,
      proposed: item.proposed.plan,
    },
  ];
  return fields.filter(
    (field) => (field.current || "").trim() !== (field.proposed || "").trim(),
  );
}

function RecordCompareBlock({
  title,
  current,
  proposed,
}: {
  title: string;
  current?: string | null;
  proposed?: string | null;
}) {
  return (
    <CollapsibleSection title={title}>
      <div className="mt-3 grid grid-cols-1 gap-3">
        <div className="rounded-xl bg-[#FAF8F4] p-3">
          <div className="text-xs font-medium text-[var(--lxxl-muted)]">当前内容</div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{current || "-"}</div>
        </div>
        <div className="rounded-xl border border-[var(--lxxl-border)] p-3">
          <div className="text-xs font-medium text-[var(--lxxl-muted)]">申请修改为</div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{proposed || "-"}</div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
