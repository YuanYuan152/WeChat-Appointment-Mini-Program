"use client";

import { useCallback, useEffect, useState } from "react";
import type { SetStateAction } from "react";

import { fetchUserBoard, fetchUserBoardDetail } from "@/services/boards";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { UserBoardPanel } from "@/panels/UserBoardPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { UserBoardDetail } from "@/types/api";
import type { ScreenData, UserBoardFilters } from "@/types/app";

const INITIAL_USER_BOARD_FILTERS: UserBoardFilters = {
  keyword: "",
  mobile: "",
};

export function UserBoardScreen() {
  return (
    <AppRoute sectionId="userBoard">
      <UserBoardScreenContent />
    </AppRoute>
  );
}

function UserBoardScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [selectedUserBoard, setSelectedUserBoard] = useState<UserBoardDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState<UserBoardFilters>(INITIAL_USER_BOARD_FILTERS);
  const [draftFilters, setDraftFilters] = useState<UserBoardFilters>(INITIAL_USER_BOARD_FILTERS);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const userBoard = await fetchUserBoard(filters, {
        page,
        pageSize,
      });
      setData((prev) => ({ ...prev, userBoard }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "用户管理加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, filters, page, pageSize, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const updateFilters = useCallback((updater: SetStateAction<UserBoardFilters>) => {
    setDraftFilters(updater);
  }, []);

  const openUserDetail = useCallback(async (accountId: number) => {
    setSelectedUserBoard(undefined);
    setDetailLoading(true);
    try {
      const selectedUserBoard = await fetchUserBoardDetail(accountId);
      setSelectedUserBoard(selectedUserBoard);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "用户详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  }, [showNotice]);

  const search = useCallback(() => {
    setSelectedUserBoard(undefined);
    if (page === 1) {
      if (areUserBoardFiltersEqual(filters, draftFilters)) {
        void loadData();
      } else {
        setFilters(draftFilters);
      }
      return;
    }
    setPage(1);
    setFilters(draftFilters);
  }, [draftFilters, filters, loadData, page]);

  const resetFilters = useCallback(() => {
    setDraftFilters(INITIAL_USER_BOARD_FILTERS);
    setSelectedUserBoard(undefined);
    if (page === 1) {
      if (areUserBoardFiltersEqual(filters, INITIAL_USER_BOARD_FILTERS)) {
        void loadData();
      } else {
        setFilters(INITIAL_USER_BOARD_FILTERS);
      }
      return;
    }
    setPage(1);
    setFilters(INITIAL_USER_BOARD_FILTERS);
  }, [filters, loadData, page]);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailLoading(false);
    setSelectedUserBoard(undefined);
  }, []);

  return (
    <UserBoardPanel
      users={data.userBoard}
      listLoading={listLoading}
      selected={selectedUserBoard}
      detailLoading={detailLoading}
      filters={draftFilters}
      setFilters={updateFilters}
      onSearch={search}
      onReset={resetFilters}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
      onOpen={openUserDetail}
      onCloseDetail={closeDetail}
    />
  );
}

function areUserBoardFiltersEqual(left: UserBoardFilters, right: UserBoardFilters) {
  return left.keyword === right.keyword && left.mobile === right.mobile;
}
