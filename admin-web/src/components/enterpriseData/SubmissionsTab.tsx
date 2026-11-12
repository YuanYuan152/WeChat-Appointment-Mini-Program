"use client";

import { useMemo, useState } from "react";

import { DataCard, EmptyHint, FollowUpChip, SeverityChip } from "@/components/enterpriseData/ui";
import { Pagination, queryControlClass } from "@/components/ui";
import {
  SEVERITY_KEYS,
  SEVERITY_META,
  chinaDateTimeText,
  formatScore,
  type ScopedDataset,
} from "@/lib/enterpriseData";
import type { EnterpriseDataset, EnterpriseReportItem, Severity } from "@/types/enterpriseData";

type SeverityFilter = Severity | "none" | "";

export function SubmissionsTab({
  dataset,
  scoped,
  isAdmin,
  onOpenReport,
  onOpenRespondent,
  onOpenFollowUp,
  onDeleteReport,
}: {
  dataset: EnterpriseDataset;
  scoped: ScopedDataset;
  isAdmin: boolean;
  onOpenReport: (report: EnterpriseReportItem) => void;
  onOpenRespondent: (key: string) => void;
  onOpenFollowUp: (report: EnterpriseReportItem) => void;
  onDeleteReport: (report: EnterpriseReportItem) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter>("");
  const [latestOnly, setLatestOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const respondentByKey = useMemo(
    () => new Map(dataset.respondents.map((item) => [item.key, item])),
    [dataset.respondents],
  );

  const list = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return scoped.reports
      .filter((report) => {
        if (assessmentId && report.assessmentId !== assessmentId) return false;
        if (severity === "none" && report.severity !== null) return false;
        if (severity && severity !== "none" && report.severity !== severity) return false;
        if (latestOnly && !report.isLatest) return false;
        if (normalized) {
          const respondent = respondentByKey.get(report.respondentKey);
          const haystack = [
            respondent?.displayName,
            respondent?.empNo,
            respondent?.personnel?.username,
            report.summary,
            report.level,
            ...(respondent ? Object.values(respondent.info) : []),
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(normalized)) return false;
        }
        return true;
      })
      .sort((left, right) => (right.completedAt || "").localeCompare(left.completedAt || ""));
  }, [assessmentId, keyword, latestOnly, respondentByKey, scoped.reports, severity]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(list.length / pageSize)));
  const pageItems = list.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <DataCard bodyClassName="p-0">
      <div className="grid gap-3 border-b border-[var(--lxxl-border)] px-5 py-4 md:grid-cols-2 xl:grid-cols-5">
        <input
          aria-label="搜索答卷"
          className={`${queryControlClass} xl:col-span-2`}
          placeholder="搜索填写者 / 工号 / 结果"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="量表"
          className={queryControlClass}
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
        <select
          aria-label="风险等级"
          className={queryControlClass}
          value={severity}
          onChange={(event) => {
            setSeverity(event.target.value as SeverityFilter);
            setPage(1);
          }}
        >
          <option value="">全部风险等级</option>
          {SEVERITY_KEYS.map((key) => (
            <option key={key} value={key}>
              {SEVERITY_META[key].label}
            </option>
          ))}
          <option value="none">未分级</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--lxxl-muted)]">
          <input
            checked={latestOnly}
            className="h-4 w-4 accent-[var(--lxxl-green)]"
            type="checkbox"
            onChange={(event) => {
              setLatestOnly(event.target.checked);
              setPage(1);
            }}
          />
          仅看每人每量表最近一次
        </label>
      </div>

      {pageItems.length === 0 ? (
        <div className="p-5">
          <EmptyHint text="当前筛选条件下没有答卷" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-[#FAF8F4] text-left text-xs text-[var(--lxxl-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">完成时间</th>
                <th className="px-4 py-3 font-medium">填写者</th>
                <th className="px-4 py-3 font-medium">量表</th>
                <th className="px-4 py-3 font-medium">结果</th>
                <th className="px-4 py-3 font-medium">风险</th>
                <th className="px-4 py-3 font-medium">跟进</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((report) => {
                const respondent = respondentByKey.get(report.respondentKey);
                return (
                  <tr key={report.publicId} className="border-t border-[var(--lxxl-border)] align-top">
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-[var(--lxxl-muted)]">
                      {chinaDateTimeText(report.completedAt)}
                      {!report.isLatest && <div className="mt-1 text-[11px]">（已有更新答卷）</div>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-left font-medium hover:text-[var(--lxxl-green)]"
                        type="button"
                        onClick={() => onOpenRespondent(report.respondentKey)}
                      >
                        {respondent?.displayName || "填写者"}
                      </button>
                      {respondent?.empNo && <div className="mt-0.5 text-xs text-[var(--lxxl-muted)]">工号 {respondent.empNo}</div>}
                    </td>
                    <td className="px-4 py-3">{report.assessmentTitle}</td>
                    <td className="max-w-[320px] px-4 py-3 text-[#4A4A4A]">
                      {report.resultType === "dimension" ? (
                        <div className="flex flex-wrap gap-1">
                          {report.dimensions.map((dimension) => (
                            <span
                              key={dimension.id}
                              className="rounded-md px-1.5 py-0.5 text-[11px]"
                              style={{
                                background: dimension.severity ? SEVERITY_META[dimension.severity].bg : "#F4F1EB",
                                color: dimension.severity ? SEVERITY_META[dimension.severity].color : "#6B6B6B",
                              }}
                              title={dimension.level}
                            >
                              {dimension.title} {formatScore(dimension.score)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span>
                          {report.level || report.summary || "-"}
                          {report.score !== null && <span className="ml-1 text-xs text-[var(--lxxl-muted)]">（{formatScore(report.score)} 分）</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <SeverityChip severity={report.severity} size="xs" />
                      {report.followUp?.severityOverride && <div className="mt-1 text-[11px] text-[var(--lxxl-muted)]">人工调整</div>}
                    </td>
                    <td className="px-4 py-3">
                      {report.followUp ? <FollowUpChip size="xs" status={report.followUp.status} /> : <span className="text-xs text-[#C0BAB0]">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button className="text-sm font-medium text-[var(--lxxl-green)] hover:text-[var(--lxxl-green-dark)]" type="button" onClick={() => onOpenReport(report)}>
                          报告
                        </button>
                        <button className="text-sm font-medium text-[var(--lxxl-green)] hover:text-[var(--lxxl-green-dark)]" type="button" onClick={() => onOpenFollowUp(report)}>
                          {report.followUp ? "跟进" : "标记风险"}
                        </button>
                        {isAdmin && (
                          <button className="text-sm font-medium text-[#A13F37] hover:text-[#7F2F29]" type="button" onClick={() => onDeleteReport(report)}>
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
  );
}
