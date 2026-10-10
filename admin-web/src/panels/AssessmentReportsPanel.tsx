"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { AssessmentReportDialog } from "@/components/assessments/AssessmentReportDialog";
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
import { formatUtcFullDateTime } from "@/lib/format";
import { fetchAssessments } from "@/services/assessments";
import { fetchAssessmentReportSourceOptions } from "@/services/assessmentReports";
import type { AssessmentListItem } from "@/types/assessment";
import type {
  AssessmentReportDetail,
  AssessmentReportListFilters,
  AssessmentReportListItem,
  AssessmentReportSourceOption,
} from "@/types/assessmentReport";

export function AssessmentReportsPanel({
  accountId,
  items,
  total,
  page,
  pageSize,
  listLoading,
  detailLoading,
  detailTarget,
  selectedDetail,
  draftFilters,
  setDraftFilters,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
  onOpenDetail,
  onCloseDetail,
}: {
  accountId: number | null;
  items: AssessmentReportListItem[];
  total: number;
  page: number;
  pageSize: number;
  listLoading: boolean;
  detailLoading: boolean;
  detailTarget?: AssessmentReportListItem;
  selectedDetail?: AssessmentReportDetail;
  draftFilters: AssessmentReportListFilters;
  setDraftFilters: Dispatch<SetStateAction<AssessmentReportListFilters>>;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenDetail: (item: AssessmentReportListItem) => void;
  onCloseDetail: () => void;
}) {
  const patientScoped = accountId !== null;
  const patient = patientScoped ? items[0] : undefined;
  const subject =
    patient?.patientName || (accountId ? `来访者 ${accountId}` : "");
  const [assessmentOptions, setAssessmentOptions] = useState<
    AssessmentListItem[]
  >([]);
  const [sourceOptions, setSourceOptions] = useState<
    AssessmentReportSourceOption[]
  >([
    { key: "mini-legacy", label: "自有EAP网页" },
  ]);

  useEffect(() => {
    if (patientScoped) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchAssessments({
          page: 1,
          pageSize: 200,
        });
        if (!cancelled) {
          setAssessmentOptions(result.items || []);
        }
      } catch {
        if (!cancelled) {
          setAssessmentOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientScoped]);

  // 列表刷新后同步来源筛选项（含新出现的 EAP量表.网站名.公司名）
  useEffect(() => {
    if (patientScoped || listLoading) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const sources = await fetchAssessmentReportSourceOptions();
        if (!cancelled && sources.items?.length) {
          setSourceOptions(sources.items);
        }
      } catch {
        // 保留已有选项
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientScoped, listLoading, total]);

  const assessmentSelectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of assessmentOptions) {
      if (item.id && item.title) {
        map.set(item.id, item.title);
      }
    }
    // 若当前筛选项不在已发布列表中，仍保留可选项
    if (
      draftFilters.assessmentId &&
      !map.has(draftFilters.assessmentId)
    ) {
      map.set(draftFilters.assessmentId, draftFilters.assessmentId);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "zh-CN"),
    );
  }, [assessmentOptions, draftFilters.assessmentId]);

  const mergedSourceOptions = useMemo(() => {
    const key = draftFilters.sourceKey?.trim();
    if (!key || sourceOptions.some((option) => option.key === key)) {
      return sourceOptions;
    }
    const label =
      key === "mini-legacy"
        ? "自有EAP网页"
        : key === "eap"
          ? "EAP量表"
          : key.startsWith("eap:")
            ? `EAP量表.${key.slice(4)}`
            : key;
    return [...sourceOptions, { key, label }];
  }, [draftFilters.sourceKey, sourceOptions]);

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
        <form
          className="px-6 py-5 sm:px-7 lg:px-8"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-normal">
                量表填写结果
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
                {patientScoped
                  ? `查看${subject}的 EAP 量表与自有 EAP 网页报告。`
                  : "按来访者、量表、来源和完成时间查看测评报告。报告内容以提交时快照为准。"}
              </p>
            </div>
            {patientScoped && (
              <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-right text-sm">
                <div className="font-medium">{subject}</div>
                <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                  {patient?.patientMobile || `账号 ID ${accountId}`}
                </div>
              </div>
            )}
          </div>

          <div
            className={`mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              patientScoped ? "xl:grid-cols-3" : "xl:grid-cols-4"
            }`}
          >
            {!patientScoped && (
              <>
                <QueryField label="来访者">
                  <input
                    className={queryControlClass}
                    placeholder="姓名、昵称或手机号"
                    maxLength={100}
                    value={draftFilters.keyword || ""}
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        keyword: event.target.value,
                      }))
                    }
                  />
                </QueryField>
                <QueryField label="量表名称">
                  <select
                    className={queryControlClass}
                    value={draftFilters.assessmentId || ""}
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        assessmentId: event.target.value,
                      }))
                    }
                  >
                    <option value="">全部量表</option>
                    {assessmentSelectOptions.map(([id, title]) => (
                      <option key={id} value={id}>
                        {title}
                      </option>
                    ))}
                  </select>
                </QueryField>
                <QueryField label="量表类型">
                  <select
                    className={queryControlClass}
                    value={draftFilters.category || ""}
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        category: event.target
                          .value as AssessmentReportListFilters["category"],
                      }))
                    }
                  >
                    <option value="">全部类型</option>
                    <option value="professional">专业量表</option>
                    <option value="fun">趣味量表</option>
                  </select>
                </QueryField>
              </>
            )}
            <QueryField label="报告来源">
              <select
                className={queryControlClass}
                value={draftFilters.sourceKey || ""}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    sourceKey: event.target.value,
                    source: "",
                  }))
                }
              >
                <option value="">全部来源</option>
                {mergedSourceOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </QueryField>
            {!patientScoped && (
              <QueryField label="完成时间">
                <input
                  className={queryControlClass}
                  type="date"
                  value={draftFilters.completedAt || ""}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      completedAt: event.target.value,
                    }))
                  }
                />
              </QueryField>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <QueryButton type="submit" />
            <QueryResetButton onClick={onReset} />
          </div>
        </form>

        <div className="relative border-t border-[var(--lxxl-border)]">
          {listLoading && items.length > 0 && (
            <div className="absolute inset-x-0 top-0 z-10 bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
              正在加载量表报告...
            </div>
          )}
          {items.length === 0 ? (
            <EmptyState
              text={listLoading ? "正在加载量表报告..." : "暂无符合条件的量表报告。"}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] border-collapse text-sm">
                  <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                    <tr>
                      <th className="px-5 py-3 font-medium">来访者</th>
                      <th className="px-5 py-3 font-medium">量表</th>
                      <th className="px-5 py-3 font-medium">来源</th>
                      <th className="px-5 py-3 font-medium">报告摘要</th>
                      <th className="px-5 py-3 font-medium">完成时间</th>
                      <th className="px-5 py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        className="border-t border-[var(--lxxl-border)] align-top"
                        key={`${item.source}-${item.reportId}`}
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium">{item.patientName}</div>
                          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                            {item.patientMobile || `账号 ID ${item.accountId}`}
                          </div>
                        </td>
                        <td className="max-w-[280px] px-5 py-4">
                          <div className="font-medium">{item.assessmentTitle}</div>
                          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                            {item.assessmentId}
                            {item.assessmentVersion
                              ? ` · v${item.assessmentVersion}`
                              : ""}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-2">
                            <Badge
                              tone={item.source === "eap" ? "green" : "gold"}
                            >
                              {formatReportSourceLabel(item)}
                            </Badge>
                            <span className="text-xs text-[var(--lxxl-muted)]">
                              {item.category === "professional"
                                ? "专业量表"
                                : "趣味量表"}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-[360px] px-5 py-4 leading-6 text-[var(--lxxl-muted)]">
                          {item.resultSummary || "-"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-[var(--lxxl-muted)]">
                          {formatUtcFullDateTime(item.completedAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <TableActionButton
                            onClick={() => onOpenDetail(item)}
                          >
                            查看报告
                          </TableActionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </>
          )}
        </div>
      </section>

      {(detailLoading || detailTarget || selectedDetail) && (
        <AssessmentReportDialog
          detail={selectedDetail}
          loading={detailLoading}
          target={detailTarget}
          onClose={onCloseDetail}
        />
      )}
    </>
  );
}

function formatReportSourceLabel(item: AssessmentReportListItem) {
  if (item.sourceLabel?.trim()) {
    return item.sourceLabel.trim();
  }
  if (item.source === "mini-legacy") {
    return "自有EAP网页";
  }
  const detail = (item.sourceDetail || "")
    .trim()
    .replace(/^EAP量表\./, "")
    .replace(" · ", ".")
    .replace(/·/g, ".");
  if (detail) {
    return `EAP量表.${detail}`;
  }
  return "EAP量表";
}
