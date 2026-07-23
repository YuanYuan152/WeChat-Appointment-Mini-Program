"use client";

import type { Dispatch, SetStateAction } from "react";

import { AssessmentEditorDialog } from "@/components/assessments/AssessmentEditorDialog";
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
import { formatFullDateTime } from "@/lib/format";
import type {
  AssessmentAdminDetail,
  AssessmentDefinition,
  AssessmentLifecycleStatus,
  AssessmentListFilters,
  AssessmentListItem,
} from "@/types/assessment";

export type AssessmentEditorMode = "create" | "edit" | "versions" | null;

export function AssessmentsPanel({
  items,
  total,
  page,
  pageSize,
  listLoading,
  detailLoading,
  actionLoading,
  draftFilters,
  setDraftFilters,
  selectedDetail,
  editorMode,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
  onOpenCreate,
  onOpenDetail,
  onCloseEditor,
  onSaveDefinition,
  onPublish,
  onArchive,
  onArchiveItem,
  onRestoreVersion,
}: {
  items: AssessmentListItem[];
  total: number;
  page: number;
  pageSize: number;
  listLoading: boolean;
  detailLoading: boolean;
  actionLoading: boolean;
  draftFilters: AssessmentListFilters;
  setDraftFilters: Dispatch<SetStateAction<AssessmentListFilters>>;
  selectedDetail?: AssessmentAdminDetail;
  editorMode: AssessmentEditorMode;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenCreate: () => void;
  onOpenDetail: (assessmentId: string, mode?: Exclude<AssessmentEditorMode, "create" | null>) => void;
  onCloseEditor: () => void;
  onSaveDefinition: (definition: AssessmentDefinition) => Promise<AssessmentAdminDetail | undefined>;
  onPublish: (detail: AssessmentAdminDetail) => Promise<AssessmentAdminDetail | undefined>;
  onArchive: (detail: AssessmentAdminDetail) => Promise<AssessmentAdminDetail | undefined>;
  onArchiveItem: (assessmentId: string) => Promise<void>;
  onRestoreVersion: (
    detail: AssessmentAdminDetail,
    version: number,
  ) => Promise<AssessmentAdminDetail | undefined>;
}) {
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
              <h2 className="text-xl font-semibold tracking-normal">量表管理</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
                管理 EAP 专业量表和趣味量表的草稿、发布版本及报告内容。发布后历史版本保持不变。
              </p>
            </div>
            <button
              className="h-10 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white transition hover:bg-[var(--lxxl-green-dark)]"
              type="button"
              onClick={onOpenCreate}
            >
              新增量表
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueryField label="量表名称 / ID">
              <input
                className={queryControlClass}
                placeholder="输入量表名称或 ID"
                value={draftFilters.keyword || ""}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, keyword: event.target.value }))
                }
              />
            </QueryField>
            <QueryField label="量表类型">
              <select
                className={queryControlClass}
                value={draftFilters.category || ""}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    category: event.target.value as AssessmentListFilters["category"],
                  }))
                }
              >
                <option value="">全部类型</option>
                <option value="professional">专业量表</option>
                <option value="fun">趣味量表</option>
              </select>
            </QueryField>
            <QueryField label="生命周期状态">
              <select
                className={queryControlClass}
                value={draftFilters.status || ""}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    status: event.target.value as AssessmentListFilters["status"],
                  }))
                }
              >
                <option value="">全部状态</option>
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="archived">已归档</option>
              </select>
            </QueryField>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <QueryButton type="submit" />
            <QueryResetButton onClick={onReset} />
          </div>
        </form>

        <div className="relative border-t border-[var(--lxxl-border)]">
          {listLoading && items.length > 0 && (
            <div className="absolute inset-x-0 top-0 z-10 bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
              正在加载量表...
            </div>
          )}
          {items.length === 0 ? (
            <EmptyState text={listLoading ? "正在加载量表..." : "暂无符合条件的量表。"} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full border-collapse text-sm">
                  <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                    <tr>
                      <th className="px-5 py-3 font-medium">量表</th>
                      <th className="px-5 py-3 font-medium">类型</th>
                      <th className="px-5 py-3 font-medium">状态</th>
                      <th className="px-5 py-3 font-medium">内容</th>
                      <th className="px-5 py-3 font-medium">版本</th>
                      <th className="px-5 py-3 font-medium">更新时间</th>
                      <th className="px-5 py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const hiddenByArchive =
                        item.status === "archived" || Boolean(item.archivedAt);
                      const hasRecoveryDraft = hiddenByArchive && Boolean(item.draftVersion);
                      const archived = hiddenByArchive && !hasRecoveryDraft;
                      const effectiveStatus: AssessmentLifecycleStatus = hasRecoveryDraft
                        ? "draft"
                        : archived
                          ? "archived"
                          : item.status;
                      return (
                        <tr key={item.id} className="border-t border-[var(--lxxl-border)] align-top">
                          <td className="max-w-[320px] px-5 py-4">
                            <div className="font-medium">{item.title}</div>
                            <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{item.id}</div>
                            {item.subtitle && (
                              <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--lxxl-muted)]">
                                {item.subtitle}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">{categoryLabel(item.category)}</td>
                          <td className="px-5 py-4">
                            <Badge tone={statusTone(effectiveStatus)}>
                              {statusLabel(effectiveStatus)}
                            </Badge>
                            {archived && (
                              <div className="mt-2 max-w-36 text-xs leading-5 text-[#A13F37]">
                                可在历史版本中恢复为草稿
                              </div>
                            )}
                            {hasRecoveryDraft && (
                              <div className="mt-2 max-w-40 text-xs leading-5 text-[#967342]">
                                量表仍处于下线状态，发布草稿后重新启用
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div>{item.questionCount} 题</div>
                            <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                              约 {item.duration} 分钟 · {scoringTypeLabel(item.scoringType)}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div>发布：{item.publishedVersion ? `v${item.publishedVersion}` : "-"}</div>
                            <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                              草稿：{item.draftVersion ? `v${item.draftVersion}` : "-"}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-[var(--lxxl-muted)]">
                            {formatFullDateTime(item.updatedAt)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex flex-wrap justify-end gap-x-4 gap-y-2">
                              <TableActionButton
                                disabled={archived}
                                title={archived ? "归档状态暂不支持编辑" : undefined}
                                onClick={() => onOpenDetail(item.id, "edit")}
                              >
                                编辑
                              </TableActionButton>
                              <TableActionButton onClick={() => onOpenDetail(item.id, "versions")}>
                                版本
                              </TableActionButton>
                              {!hiddenByArchive && (
                                <TableActionButton
                                  disabled={actionLoading}
                                  tone="danger"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `确定归档“${item.title}”吗？归档后 EAP 用户将无法继续打开该量表。`,
                                      )
                                    ) {
                                      void onArchiveItem(item.id);
                                    }
                                  }}
                                >
                                  归档
                                </TableActionButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

      {editorMode && (
        <AssessmentEditorDialog
          actionLoading={actionLoading}
          detail={selectedDetail}
          detailLoading={detailLoading}
          initialMode={editorMode}
          onArchive={onArchive}
          onClose={onCloseEditor}
          onPublish={onPublish}
          onRestoreVersion={onRestoreVersion}
          onSave={onSaveDefinition}
        />
      )}
    </>
  );
}

function categoryLabel(category: AssessmentListItem["category"]) {
  return category === "professional" ? "专业量表" : "趣味量表";
}

function statusLabel(status: AssessmentLifecycleStatus) {
  const labels: Record<AssessmentLifecycleStatus, string> = {
    draft: "草稿",
    published: "已发布",
    archived: "已归档",
  };
  return labels[status];
}

function statusTone(status: AssessmentLifecycleStatus): "green" | "gold" | "red" {
  if (status === "published") {
    return "green";
  }
  if (status === "draft") {
    return "gold";
  }
  return "red";
}

function scoringTypeLabel(type: AssessmentListItem["scoringType"]) {
  const labels: Record<AssessmentListItem["scoringType"], string> = {
    sum: "总分",
    dimension: "维度",
    match: "匹配",
    aas: "AAS 固定计分",
    psqi: "PSQI 固定计分",
    pbi: "PBI 固定计分",
    cbcl: "CBCL 固定计分",
    "dark-light": "暗黑人格固定计分",
  };
  return labels[type];
}
