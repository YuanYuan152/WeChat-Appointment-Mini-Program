"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchCounselorBoard, fetchCounselorBoardDetail } from "@/services/boards";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { CounselorBoardPanel } from "@/panels/CounselorBoardPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { CounselorBoardDetail } from "@/types/api";
import type { ScreenData } from "@/types/app";

export function CounselorBoardScreen() {
  return (
    <AppRoute sectionId="counselorBoard">
      <CounselorBoardScreenContent />
    </AppRoute>
  );
}

function CounselorBoardScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [draftKeyword, setDraftKeyword] = useState("");
  const [selectedCounselorBoard, setSelectedCounselorBoard] = useState<CounselorBoardDetail>();
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const counselorBoard = await fetchCounselorBoard(keyword, {
        page,
        pageSize,
      });
      setData((prev) => ({ ...prev, counselorBoard }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询师看板加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, keyword, page, pageSize, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const updateKeyword = useCallback((value: string) => {
    setDraftKeyword(value);
  }, []);

  const openCounselorDetail = useCallback(async (accountId: number) => {
    setSelectedCounselorBoard(undefined);
    setDetailLoading(true);
    try {
      const selectedCounselorBoard = await fetchCounselorBoardDetail(accountId);
      setSelectedCounselorBoard(selectedCounselorBoard);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询师详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  }, [showNotice]);

  const search = useCallback(() => {
    setSelectedCounselorBoard(undefined);
    if (page === 1) {
      if (keyword === draftKeyword) {
        void loadData();
      } else {
        setKeyword(draftKeyword);
      }
      return;
    }
    setPage(1);
    setKeyword(draftKeyword);
  }, [draftKeyword, keyword, loadData, page]);

  const resetKeyword = useCallback(() => {
    setDraftKeyword("");
    setSelectedCounselorBoard(undefined);
    if (page === 1) {
      if (!keyword) {
        void loadData();
      } else {
        setKeyword("");
      }
      return;
    }
    setPage(1);
    setKeyword("");
  }, [keyword, loadData, page]);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailLoading(false);
    setSelectedCounselorBoard(undefined);
  }, []);

  return (
    <CounselorBoardPanel
      records={data.counselorBoard}
      listLoading={listLoading}
      selected={selectedCounselorBoard}
      detailLoading={detailLoading}
      keyword={draftKeyword}
      setKeyword={updateKeyword}
      onSearch={search}
      onReset={resetKeyword}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
      onOpen={openCounselorDetail}
      onCloseDetail={closeDetail}
    />
  );
}
