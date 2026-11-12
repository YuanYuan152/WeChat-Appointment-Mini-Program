"use client";

import { useMemo, useState } from "react";

import {
  DataCard,
  EmptyHint,
  FollowUpChip,
  PrivacyNote,
  SegmentedControl,
  SeverityChip,
} from "@/components/enterpriseData/ui";
import { Pagination } from "@/components/ui";
import {
  FOLLOW_UP_KEYS,
  FOLLOW_UP_META,
  chinaDateTimeText,
  fieldValue,
  followUpStatusOf,
  formatScore,
  isFlaggedSeverity,
  isOpenAlert,
  severityRank,
  type ScopedDataset,
} from "@/lib/enterpriseData";
import type { EnterpriseDataset, EnterpriseReportItem, FollowUpStatus } from "@/types/enterpriseData";

type LevelFilter = "risk" | "high" | "mid" | "watch" | "all";

export function AlertsTab({
  dataset,
  scoped,
  onOpenFollowUp,
  onOpenRespondent,
  onOpenReport,
}: {
  dataset: EnterpriseDataset;
  scoped: ScopedDataset;
  onOpenFollowUp: (report: EnterpriseReportItem) => void;
  onOpenRespondent: (key: string) => void;
  onOpenReport: (report: EnterpriseReportItem) => void;
}) {
  const [level, setLevel] = useState<LevelFilter>("risk");
  const [status, setStatus] = useState<FollowUpStatus | "open" | "all">("open");
  const [assessmentId, setAssessmentId] = useState("");
  const [onlyLatest, setOnlyLatest] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const respondentByKey = useMemo(
    () => new Map(dataset.respondents.map((item) => [item.key, item])),
    [dataset.respondents],
  );
  const infoFields = useMemo(
    () => dataset.fields.filter((field) => ["dept", "post", "category", "workLoc"].includes(field.id)).slice(0, 2),
    [dataset.fields],
  );

  const candidates = useMemo(
    () => scoped.reports.filter((report) => isFlaggedSeverity(report.severity)),
    [scoped.reports],
  );
  const summary = useMemo(() => {
    const open = candidates.filter((report) => isOpenAlert(report));
    return {
      highOpen: open.filter((report) => report.severity === "high").length,
      midOpen: open.filter((report) => report.severity === "mid").length,
      pending: candidates.filter((report) => isOpenAlert(report) && followUpStatusOf(report) === "pending").length,
      closed: candidates.filter((report) => FOLLOW_UP_META[followUpStatusOf(report)].closed).length,
    };
  }, [candidates]);

  const list = useMemo(() => {
    return candidates
      .filter((report) => {
        if (level === "risk" && report.severity !== "high" && report.severity !== "mid") return false;
        if ((level === "high" || level === "mid" || level === "watch") && report.severity !== level) return false;
        const current = followUpStatusOf(report);
        if (status === "open" && FOLLOW_UP_META[current].closed) return false;
        if (status !== "open" && status !== "all" && current !== status) return false;
        if (assessmentId && report.assessmentId !== assessmentId) return false;
        if (onlyLatest && !report.isLatest) return false;
        return true;
      })
      .sort(
        (left, right) =>
          severityRank(right.severity) - severityRank(left.severity)
          || (right.completedAt || "").localeCompare(left.completedAt || ""),
      );
  }, [assessmentId, candidates, level, onlyLatest, status]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(list.length / pageSize)));
  const pageItems = list.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5">
      <PrivacyNote>
        风险提醒由量表结果等级自动识别（重度 / 中度 / 轻度等关键词），可在“跟进”中人工调整等级与记录处理过程。员工个人信息与测评结果仅供 EAP 服务团队开展专业跟进，请勿向企业方披露可识别个人身份的内容，紧急情况按危机干预流程处理。
      </PrivacyNote>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "高风险 · 未处理", value: summary.highOpen, color: "#B3261E" },
          { label: "中度风险 · 未处理", value: summary.midOpen, color: "#B86A1E" },
          { label: "待联系", value: summary.pending, color: "#2C2C2C" },
          { label: "已缓解 / 无需跟进", value: summary.closed, color: "#2F7A55" },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl border border-[var(--lxxl-border)] bg-white px-5 py-4">
            <span className="text-sm text-[var(--lxxl-muted)]">{item.label}</span>
            <span className="text-3xl font-semibold" style={{ color: item.color }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <DataCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--lxxl-border)] px-5 py-4">
          <SegmentedControl<LevelFilter>
            options={[
              { value: "risk", label: "中高风险" },
              { value: "high", label: "高风险" },
              { value: "mid", label: "中度" },
              { value: "watch", label: "一般关注" },
              { value: "all", label: "全部" },
            ]}
            value={level}
            onChange={(value) => {
              setLevel(value);
              setPage(1);
            }}
          />
          <select
            aria-label="跟进状态"
            className="h-9 rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none focus:border-[var(--lxxl-green)]"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as FollowUpStatus | "open" | "all");
              setPage(1);
            }}
          >
            <option value="open">未处理完毕</option>
            <option value="all">全部状态</option>
            {FOLLOW_UP_KEYS.map((key) => (
              <option key={key} value={key}>
                {FOLLOW_UP_META[key].label}
              </option>
            ))}
          </select>
          <select
            aria-label="量表"
            className="h-9 rounded-xl border border-[var(--lxxl-border)] bg-white px-3 text-sm outline-none focus:border-[var(--lxxl-green)]"
            value={assessmentId}
            onChange={(event) => {
              setAssessmentId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">全部量表</option>
            {dataset.assessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.title}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-[var(--lxxl-muted)]">
            <input
              checked={onlyLatest}
              className="h-4 w-4 accent-[var(--lxxl-green)]"
              type="checkbox"
              onChange={(event) => {
                setOnlyLatest(event.target.checked);
                setPage(1);
              }}
            />
            仅看每人最近一次
          </label>
          <span className="ml-auto text-xs text-[var(--lxxl-muted)]">共 {list.length} 条</span>
        </div>

        {pageItems.length === 0 ? (
          <div className="p-5">
            <EmptyHint text="当前筛选条件下没有风险提醒" />
          </div>
        ) : (
          <div className="divide-y divide-[var(--lxxl-border)]">
            {pageItems.map((report) => {
              const respondent = respondentByKey.get(report.respondentKey);
              const followUp = report.followUp;
              const groupText = respondent
                ? infoFields
                    .map((field) => fieldValue(respondent, field.id))
                    .filter((value) => value !== "未填写")
                    .join(" · ")
                : "";
              return (
                <div key={report.publicId} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityChip severity={report.severity} size="xs" />
                      {followUp?.severityOverride && (
                        <span className="rounded-full bg-[#F4F1EB] px-2 py-0.5 text-[11px] text-[var(--lxxl-muted)]">人工调整</span>
                      )}
                      {!report.isLatest && (
                        <span className="rounded-full bg-[#F4F1EB] px-2 py-0.5 text-[11px] text-[var(--lxxl-muted)]">已有更新答卷</span>
                      )}
                      <button
                        className="truncate text-sm font-semibold hover:text-[var(--lxxl-green)]"
                        type="button"
                        onClick={() => onOpenRespondent(report.respondentKey)}
                      >
                        {respondent?.displayName || "填写者"}
                      </button>
                      {respondent?.empNo && <span className="text-xs text-[var(--lxxl-muted)]">工号 {respondent.empNo}</span>}
                      {groupText && <span className="text-xs text-[var(--lxxl-muted)]">{groupText}</span>}
                    </div>
                    <div className="mt-1.5 text-sm text-[#4A4A4A]">
                      <span className="font-medium">{report.assessmentTitle}</span>
                      <span className="mx-2 text-[var(--lxxl-border)]">|</span>
                      {report.triggers.length > 0
                        ? report.triggers
                            .map((item) => `${item.title} ${item.level}${item.score !== null ? `（${formatScore(item.score)} 分）` : ""}`)
                            .join("、")
                        : report.summary || "人工调整为风险"}
                    </div>
                    <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                      完成于 {chinaDateTimeText(report.completedAt)}
                      {followUp?.owner ? ` · 跟进人 ${followUp.owner}` : ""}
                      {followUp?.updatedAt ? ` · ${followUp.updatedBy || "工作人员"} 更新于 ${chinaDateTimeText(followUp.updatedAt)}` : ""}
                    </div>
                    {followUp?.note && <div className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#5A5A5A]">备注：{followUp.note}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <FollowUpChip status={followUpStatusOf(report)} />
                    <button
                      className="text-sm font-medium text-[var(--lxxl-green)] hover:text-[var(--lxxl-green-dark)]"
                      type="button"
                      onClick={() => onOpenReport(report)}
                    >
                      报告
                    </button>
                    <button
                      className="h-8 rounded-lg bg-[var(--lxxl-green)] px-3 text-sm font-medium text-white hover:bg-[var(--lxxl-green-dark)]"
                      type="button"
                      onClick={() => onOpenFollowUp(report)}
                    >
                      跟进
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          total={list.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </DataCard>
    </div>
  );
}
