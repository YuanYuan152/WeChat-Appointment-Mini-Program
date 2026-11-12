"use client";

import { useMemo, useState } from "react";

import { DataCard, EmptyHint, SeverityChip, StatCard, StatusChip, TagChip } from "@/components/enterpriseData/ui";
import { Pagination, queryControlClass } from "@/components/ui";
import {
  EMPTY_GROUP_VALUE,
  RESPONDENT_STATUS_META,
  SEVERITY_KEYS,
  SEVERITY_META,
  buildArchiveRows,
  chinaDateTimeText,
  fieldValue,
  groupableFields,
  matchesKeyword,
  severityRank,
  tagColor,
} from "@/lib/enterpriseData";
import type { EnterpriseDataset, RespondentStatus, Severity } from "@/types/enterpriseData";

type SeverityFilter = Severity | "none" | "risk" | "";

export function ArchiveTab({
  dataset,
  onOpenRespondent,
}: {
  dataset: EnterpriseDataset;
  onOpenRespondent: (key: string) => void;
}) {
  const rows = useMemo(() => buildArchiveRows(dataset), [dataset]);
  const groupFields = useMemo(() => groupableFields(dataset.fields), [dataset.fields]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<RespondentStatus | "">("");
  const [severity, setSeverity] = useState<SeverityFilter>("");
  const [tag, setTag] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [fieldValueFilter, setFieldValueFilter] = useState("");
  const [sort, setSort] = useState<"recent" | "risk" | "name">("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const authorizedCount = dataset.enterprise.assessmentIds.length;
  const usedTags = useMemo(() => {
    const library = dataset.tagLibrary.flatMap((group) => group.tags);
    const extra = rows.flatMap((row) => row.tags).filter((item) => !library.includes(item));
    return [...new Set([...library, ...extra])];
  }, [dataset.tagLibrary, rows]);
  const fieldValues = useMemo(() => {
    if (!fieldId) return [];
    const values = new Set<string>();
    for (const row of rows) {
      if (row.respondent) values.add(fieldValue(row.respondent, fieldId));
    }
    return [...values].sort((left, right) =>
      left === EMPTY_GROUP_VALUE ? 1 : right === EMPTY_GROUP_VALUE ? -1 : left.localeCompare(right, "zh-CN"),
    );
  }, [fieldId, rows]);

  const filtered = useMemo(() => {
    const list = rows.filter((row) => {
      if (!matchesKeyword(row, keyword)) return false;
      if (status && row.status !== status) return false;
      if (severity === "risk" && row.severity !== "high" && row.severity !== "mid") return false;
      if (severity === "none" && (row.severity !== null || row.status === "todo")) return false;
      if (severity && severity !== "risk" && severity !== "none" && row.severity !== severity) return false;
      if (tag && !row.tags.includes(tag)) return false;
      if (fieldId && fieldValueFilter) {
        if (!row.respondent || fieldValue(row.respondent, fieldId) !== fieldValueFilter) return false;
      }
      return true;
    });
    return list.sort((left, right) => {
      if (sort === "risk") {
        return severityRank(right.severity) - severityRank(left.severity) || (right.lastAt || "").localeCompare(left.lastAt || "");
      }
      if (sort === "name") {
        return left.displayName.localeCompare(right.displayName, "zh-CN");
      }
      return (right.lastAt || "").localeCompare(left.lastAt || "");
    });
  }, [fieldId, fieldValueFilter, keyword, rows, severity, sort, status, tag]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const respondentRows = rows.filter((row) => row.respondent);
  const doneCount = rows.filter((row) => row.status === "done").length;
  const todoCount = rows.filter((row) => row.status === "todo").length;
  const taggedCount = rows.filter((row) => row.tags.length > 0).length;
  const columnFields = useMemo(() => {
    const preferred = ["dept", "post", "category", "workLoc"];
    return dataset.fields.filter((field) => preferred.includes(field.id)).slice(0, 2);
  }, [dataset.fields]);

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="已建档" note="至少提交过一份答卷" unit="人" value={respondentRows.length} />
        <StatCard label="完成全部量表" note={`当前授权 ${authorizedCount} 个量表`} unit="人" value={doneCount} />
        <StatCard
          label="未开始"
          note={dataset.enterprise.personnelEmployeeCount > 0 ? "人员表中尚未提交任何答卷" : "未生成人员表，无法统计"}
          unit={dataset.enterprise.personnelEmployeeCount > 0 ? "人" : ""}
          value={dataset.enterprise.personnelEmployeeCount > 0 ? todoCount : "—"}
        />
        <StatCard label="带人工标注" note={`标签库 ${dataset.tagLibrary.length} 组`} unit="人" value={taggedCount} />
      </div>

      <DataCard bodyClassName="p-0">
        <div className="grid gap-3 border-b border-[var(--lxxl-border)] px-5 py-4 md:grid-cols-2 xl:grid-cols-6">
          <input
            aria-label="搜索员工"
            className={`${queryControlClass} xl:col-span-2`}
            placeholder="搜索姓名 / 工号 / 站点账号 / 部门 / 标签"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              resetPage();
            }}
          />
          <select
            aria-label="完成状态"
            className={queryControlClass}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as RespondentStatus | "");
              resetPage();
            }}
          >
            <option value="">全部完成状态</option>
            {(Object.keys(RESPONDENT_STATUS_META) as RespondentStatus[]).map((key) => (
              <option key={key} value={key}>
                {RESPONDENT_STATUS_META[key].label}
              </option>
            ))}
          </select>
          <select
            aria-label="风险等级"
            className={queryControlClass}
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value as SeverityFilter);
              resetPage();
            }}
          >
            <option value="">全部风险等级</option>
            <option value="risk">中高风险</option>
            {SEVERITY_KEYS.map((key) => (
              <option key={key} value={key}>
                {SEVERITY_META[key].label}
              </option>
            ))}
            <option value="none">未分级</option>
          </select>
          <select
            aria-label="人工标签"
            className={queryControlClass}
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
              resetPage();
            }}
          >
            <option value="">全部标签</option>
            {usedTags.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            aria-label="排序"
            className={queryControlClass}
            value={sort}
            onChange={(event) => setSort(event.target.value as "recent" | "risk" | "name")}
          >
            <option value="recent">按最近填写</option>
            <option value="risk">按风险等级</option>
            <option value="name">按姓名</option>
          </select>
          {groupFields.length > 0 && (
            <div className="flex gap-2 md:col-span-2">
              <select
                aria-label="按员工信息筛选"
                className={queryControlClass}
                value={fieldId}
                onChange={(event) => {
                  setFieldId(event.target.value);
                  setFieldValueFilter("");
                  resetPage();
                }}
              >
                <option value="">按员工信息筛选</option>
                {groupFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="字段取值"
                className={queryControlClass}
                disabled={!fieldId}
                value={fieldValueFilter}
                onChange={(event) => {
                  setFieldValueFilter(event.target.value);
                  resetPage();
                }}
              >
                <option value="">全部取值</option>
                {fieldValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {pageItems.length === 0 ? (
          <div className="p-5">
            <EmptyHint text={rows.length === 0 ? "该企业链接下还没有员工填写" : "没有符合条件的员工档案"} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="bg-[#FAF8F4] text-left text-xs text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">员工</th>
                  <th className="px-4 py-3 font-medium">{columnFields.map((field) => field.label).join(" · ") || "基本信息"}</th>
                  <th className="px-4 py-3 font-medium">完成进度</th>
                  <th className="px-4 py-3 font-medium">风险等级</th>
                  <th className="px-4 py-3 font-medium">人工标签</th>
                  <th className="px-4 py-3 font-medium">最近填写</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row) => (
                  <tr
                    key={row.key}
                    className="cursor-pointer border-t border-[var(--lxxl-border)] align-middle transition hover:bg-[#FBFAF7]"
                    onClick={() => onOpenRespondent(row.key)}
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium">{row.displayName}</div>
                      <div className="mt-0.5 text-xs text-[var(--lxxl-muted)]">
                        {[row.empNo ? `工号 ${row.empNo}` : "", row.username ? `账号 ${row.username}` : ""].filter(Boolean).join(" · ") || "匿名填写"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#4A4A4A]">
                      {(() => {
                        const respondent = row.respondent;
                        if (!respondent) return "—";
                        return (
                          columnFields
                            .map((field) => fieldValue(respondent, field.id))
                            .filter((value) => value !== EMPTY_GROUP_VALUE)
                            .join(" · ") || "—"
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusChip size="xs" status={row.status} />
                        <span className="text-xs text-[var(--lxxl-muted)]">
                          {row.respondent?.completedCount ?? 0}/{authorizedCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "todo" ? <span className="text-xs text-[var(--lxxl-muted)]">—</span> : <SeverityChip severity={row.severity} size="xs" />}
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      {row.tags.length === 0 ? (
                        <span className="text-xs text-[#C0BAB0]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.tags.slice(0, 2).map((item) => (
                            <TagChip key={item} color={tagColor(item, dataset.tagLibrary)} tag={item} />
                          ))}
                          {row.tags.length > 2 && <span className="text-[11px] text-[var(--lxxl-muted)]">+{row.tags.length - 2}</span>}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--lxxl-muted)]">
                      {row.lastAt ? chinaDateTimeText(row.lastAt) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="text-sm font-medium text-[var(--lxxl-green)] hover:text-[var(--lxxl-green-dark)]"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenRespondent(row.key);
                        }}
                      >
                        查看档案
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          total={filtered.length}
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
