"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { ApiError } from "@/lib/api";
import { AssessmentsPanel } from "@/panels/AssessmentsPanel";
import {
  archiveAssessment,
  createAssessment,
  fetchAssessmentDetail,
  fetchAssessments,
  publishAssessment,
  restoreAssessmentVersion,
  updateAssessmentDraft,
} from "@/services/assessments";
import type {
  AssessmentAdminDetail,
  AssessmentDefinition,
  AssessmentListFilters,
  AssessmentListItem,
} from "@/types/assessment";

export type AssessmentEditorMode = "create" | "edit" | "versions" | null;

/**
 * `AssessmentsPanel` 的完整交互契约。
 *
 * Panel 只负责表单和交互展示；列表查询、详情读取、并发控制、生命周期防护及
 * mutation 后刷新均由 Screen 统一处理。所有 mutation 在成功时返回服务端最新
 * 详情，失败（包括 409）时返回 undefined，编辑器据此决定是否同步本地草稿。
 */
export interface AssessmentsPanelPropsContract {
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
  onOpenReports: (assessmentId?: string) => void;
  onOpenDetail: (
    assessmentId: string,
    mode?: Exclude<AssessmentEditorMode, "create" | null>,
  ) => Promise<void>;
  onCloseEditor: () => void;
  onSaveDefinition: (
    definition: AssessmentDefinition,
  ) => Promise<AssessmentAdminDetail | undefined>;
  onPublish: (
    detail: AssessmentAdminDetail,
  ) => Promise<AssessmentAdminDetail | undefined>;
  onArchive: (
    detail: AssessmentAdminDetail,
  ) => Promise<AssessmentAdminDetail | undefined>;
  onArchiveItem: (assessmentId: string) => Promise<void>;
  onRestoreVersion: (
    detail: AssessmentAdminDetail,
    version: number,
  ) => Promise<AssessmentAdminDetail | undefined>;
}

function getInitialFilters(): AssessmentListFilters {
  return {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    category: "",
    status: "",
    keyword: "",
  };
}

function normalizeFilters(filters: AssessmentListFilters): AssessmentListFilters {
  return {
    ...filters,
    keyword: filters.keyword?.trim() || "",
  };
}

function isSameQuery(
  first: AssessmentListFilters,
  second: AssessmentListFilters,
) {
  return (
    first.page === second.page &&
    first.pageSize === second.pageSize &&
    first.category === second.category &&
    first.status === second.status &&
    (first.keyword?.trim() || "") === (second.keyword?.trim() || "")
  );
}

function isConflictError(error: unknown) {
  return error instanceof ApiError && error.status === 409;
}

export function AssessmentsScreen() {
  return (
    <AppRoute sectionId="assessments">
      <AssessmentsScreenContent />
    </AppRoute>
  );
}

function AssessmentsScreenContent() {
  const router = useRouter();
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [draftFilters, setDraftFilters] = useState<AssessmentListFilters>(
    getInitialFilters,
  );
  const [queryFilters, setQueryFilters] = useState<AssessmentListFilters>(
    getInitialFilters,
  );
  const [items, setItems] = useState<AssessmentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] =
    useState<AssessmentAdminDetail>();
  const [editorMode, setEditorMode] = useState<AssessmentEditorMode>(null);
  const listRequestSequence = useRef(0);
  const detailRequestSequence = useRef(0);

  const loadList = useCallback(
    async (showLoadError = true) => {
      const requestSequence = ++listRequestSequence.current;
      setListLoading(true);
      try {
        const result = await fetchAssessments(queryFilters);
        if (requestSequence !== listRequestSequence.current) {
          return false;
        }
        setItems(result.items);
        setTotal(result.total);
        return true;
      } catch (error) {
        if (requestSequence === listRequestSequence.current && showLoadError) {
          showNotice(
            "error",
            error instanceof Error ? error.message : "量表列表加载失败",
          );
        }
        return false;
      } finally {
        if (requestSequence === listRequestSequence.current) {
          setListLoading(false);
        }
      }
    },
    [queryFilters, showNotice],
  );

  useEffect(() => {
    clearNotice();
    void loadList();
  }, [clearNotice, loadList, refreshKey]);

  const search = useCallback(() => {
    const nextFilters = normalizeFilters({
      ...draftFilters,
      page: 1,
      pageSize: queryFilters.pageSize,
    });
    setDraftFilters(nextFilters);
    if (isSameQuery(nextFilters, queryFilters)) {
      clearNotice();
      void loadList();
      return;
    }
    setQueryFilters(nextFilters);
  }, [clearNotice, draftFilters, loadList, queryFilters]);

  const resetFilters = useCallback(() => {
    const initialFilters = getInitialFilters();
    initialFilters.pageSize = queryFilters.pageSize;
    setDraftFilters(initialFilters);
    if (isSameQuery(initialFilters, queryFilters)) {
      clearNotice();
      void loadList();
      return;
    }
    setQueryFilters(initialFilters);
  }, [clearNotice, loadList, queryFilters]);

  const changePage = useCallback((page: number) => {
    const nextPage = Math.max(1, page);
    setDraftFilters((current) => ({ ...current, page: nextPage }));
    setQueryFilters((current) => ({ ...current, page: nextPage }));
  }, []);

  const changePageSize = useCallback((pageSize: number) => {
    setDraftFilters((current) => ({ ...current, page: 1, pageSize }));
    setQueryFilters((current) => ({ ...current, page: 1, pageSize }));
  }, []);

  const openCreate = useCallback(() => {
    detailRequestSequence.current += 1;
    clearNotice();
    setSelectedDetail(undefined);
    setDetailLoading(false);
    setEditorMode("create");
  }, [clearNotice]);

  const openReports = useCallback(
    (assessmentId?: string) => {
      const params = new URLSearchParams();
      if (assessmentId) {
        params.set("assessmentId", assessmentId);
      }
      const query = params.toString();
      router.push(`/assessment-reports${query ? `?${query}` : ""}`);
    },
    [router],
  );

  const openDetail = useCallback(
    async (
      assessmentId: string,
      mode: Exclude<AssessmentEditorMode, "create" | null> = "edit",
    ) => {
      const requestSequence = ++detailRequestSequence.current;
      clearNotice();
      setSelectedDetail(undefined);
      setEditorMode(mode);
      setDetailLoading(true);
      try {
        const loadedDetail = await fetchAssessmentDetail(assessmentId);
        if (requestSequence !== detailRequestSequence.current) {
          return;
        }
        const archivedInList = items.some(
          (item) => item.id === assessmentId && Boolean(item.archivedAt),
        );
        const detail = archivedInList
          ? {
              ...loadedDetail,
              lifecycleStatus: loadedDetail.draftVersion
                ? ("draft" as const)
                : ("archived" as const),
            }
          : loadedDetail;
        setSelectedDetail(detail);
        if (detail.lifecycleStatus === "archived" && mode === "edit") {
          setEditorMode("versions");
          showNotice(
            "error",
            "该量表已归档，仅可查看历史版本，不能继续编辑或恢复。",
          );
        }
      } catch (error) {
        if (requestSequence !== detailRequestSequence.current) {
          return;
        }
        setSelectedDetail(undefined);
        setEditorMode(null);
        showNotice(
          "error",
          error instanceof Error ? error.message : "量表详情加载失败",
        );
      } finally {
        if (requestSequence === detailRequestSequence.current) {
          setDetailLoading(false);
        }
      }
    },
    [clearNotice, items, showNotice],
  );

  const closeEditor = useCallback(() => {
    detailRequestSequence.current += 1;
    setSelectedDetail(undefined);
    setEditorMode(null);
    setDetailLoading(false);
  }, []);

  const runMutation = useCallback(
    async (
      action: () => Promise<AssessmentAdminDetail>,
      successMessage: string,
      errorMessage: string,
      nextMode?: Exclude<AssessmentEditorMode, "create" | null>,
    ) => {
      setActionLoading(true);
      clearNotice();
      try {
        const latestDetail = await action();
        setSelectedDetail(latestDetail);
        if (nextMode) {
          setEditorMode(nextMode);
        }
        const refreshed = await loadList(false);
        showNotice(
          "success",
          refreshed
            ? successMessage
            : `${successMessage}，但列表刷新失败，请稍后手动刷新。`,
        );
        return latestDetail;
      } catch (error) {
        if (isConflictError(error)) {
          showNotice(
            "error",
            "量表已被其他管理员更新，当前编辑内容已保留。请先复制或记录本地修改，再重新打开量表合并后保存。",
          );
        } else {
          showNotice(
            "error",
            error instanceof Error ? error.message : errorMessage,
          );
        }
        return undefined;
      } finally {
        setActionLoading(false);
      }
    },
    [clearNotice, loadList, showNotice],
  );

  const saveDefinition = useCallback(
    async (definition: AssessmentDefinition) => {
      if (editorMode === "create") {
        return runMutation(
          () => createAssessment(definition),
          "量表已创建并保存为草稿",
          "量表创建失败",
          "edit",
        );
      }

      if (!selectedDetail) {
        showNotice("error", "量表详情尚未加载完成，请稍后重试。");
        return undefined;
      }
      if (selectedDetail.lifecycleStatus === "archived") {
        showNotice("error", "归档量表禁止编辑。");
        return undefined;
      }

      return runMutation(
        () =>
          updateAssessmentDraft(
            selectedDetail.definition.id,
            selectedDetail.revision,
            definition,
          ),
        "量表草稿已保存",
        "量表草稿保存失败",
        "edit",
      );
    },
    [editorMode, runMutation, selectedDetail, showNotice],
  );

  const publish = useCallback(
    async (detail: AssessmentAdminDetail) => {
      if (detail.lifecycleStatus === "archived") {
        showNotice("error", "归档量表禁止发布。");
        return undefined;
      }
      return runMutation(
        () =>
          publishAssessment(detail.definition.id, detail.revision),
        "量表已发布",
        "量表发布失败",
        "edit",
      );
    },
    [runMutation, showNotice],
  );

  const archive = useCallback(
    async (detail: AssessmentAdminDetail) => {
      if (detail.lifecycleStatus === "archived") {
        showNotice("error", "该量表已经归档。");
        return undefined;
      }
      return runMutation(
        () => archiveAssessment(detail.definition.id),
        "量表已归档",
        "量表归档失败",
        "versions",
      );
    },
    [runMutation, showNotice],
  );

  const archiveItem = useCallback(
    async (assessmentId: string) => {
      await runMutation(
        () => archiveAssessment(assessmentId),
        "量表已归档",
        "量表归档失败",
      );
    },
    [runMutation],
  );

  const restoreVersion = useCallback(
    async (detail: AssessmentAdminDetail, version: number) => {
      return runMutation(
        () => restoreAssessmentVersion(detail.definition.id, version),
        `版本 v${version} 已恢复为新草稿`,
        "历史版本恢复失败",
        "versions",
      );
    },
    [runMutation],
  );

  return (
    <AssessmentsPanel
      items={items}
      total={total}
      page={queryFilters.page}
      pageSize={queryFilters.pageSize}
      listLoading={listLoading}
      detailLoading={detailLoading}
      actionLoading={actionLoading}
      draftFilters={draftFilters}
      setDraftFilters={setDraftFilters}
      selectedDetail={selectedDetail}
      editorMode={editorMode}
      onSearch={search}
      onReset={resetFilters}
      onPageChange={changePage}
      onPageSizeChange={changePageSize}
      onOpenCreate={openCreate}
      onOpenReports={openReports}
      onOpenDetail={openDetail}
      onCloseEditor={closeEditor}
      onSaveDefinition={saveDefinition}
      onPublish={publish}
      onArchive={archive}
      onArchiveItem={archiveItem}
      onRestoreVersion={restoreVersion}
    />
  );
}
