"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchCounselorBoard, fetchCounselorBoardDetail } from "@/services/boards";
import { fetchAdminCounselorIntro, updateAdminCounselorIntro } from "@/services/adminCounselors";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { CounselorBoardPanel } from "@/panels/CounselorBoardPanel";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type {
  AdminCounselorIntroProfile,
  AdminCounselorIntroUpdatePayload,
  CounselorBoardDetail,
} from "@/types/api";
import type { ScreenData } from "@/types/app";

export function CounselorBoardScreen() {
  return (
    <AppRoute sectionId="counselorBoard">
      <CounselorBoardScreenContent />
    </AppRoute>
  );
}

function CounselorBoardScreenContent() {
  const { clearNotice, isAdmin, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [draftKeyword, setDraftKeyword] = useState("");
  const [selectedCounselorBoard, setSelectedCounselorBoard] = useState<CounselorBoardDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [introProfile, setIntroProfile] = useState<AdminCounselorIntroProfile>();
  const [introLoading, setIntroLoading] = useState(false);
  const [introSaving, setIntroSaving] = useState(false);
  const [introError, setIntroError] = useState<string | null>(null);

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

  const openIntroEditor = useCallback(async (accountId: number) => {
    if (!isAdmin) {
      showNotice("error", "只有管理员可以编辑咨询师介绍页");
      return;
    }
    setIntroProfile(undefined);
    setIntroError(null);
    setIntroLoading(true);
    try {
      const profile = await fetchAdminCounselorIntro(accountId);
      setIntroProfile(profile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "介绍页资料加载失败";
      setIntroError(message);
      showNotice("error", message);
    } finally {
      setIntroLoading(false);
    }
  }, [isAdmin, showNotice]);

  const closeIntroEditor = useCallback(() => {
    setIntroLoading(false);
    setIntroSaving(false);
    setIntroProfile(undefined);
    setIntroError(null);
  }, []);

  const saveIntro = useCallback(async (payload: AdminCounselorIntroUpdatePayload) => {
    if (!introProfile) {
      return;
    }
    setIntroSaving(true);
    setIntroError(null);
    try {
      const savedProfile = await updateAdminCounselorIntro(introProfile.counselorId, payload);
      setIntroProfile(savedProfile);
      setData((prev) => ({
        ...prev,
        counselorBoard: prev.counselorBoard
          ? {
              ...prev.counselorBoard,
              items: prev.counselorBoard.items.map((item) =>
                item.id === savedProfile.counselorId ? { ...item, name: savedProfile.name } : item,
              ),
            }
          : prev.counselorBoard,
      }));
      setSelectedCounselorBoard((prev) =>
        prev && prev.profile.id === savedProfile.counselorId
          ? { ...prev, profile: { ...prev.profile, name: savedProfile.name } }
          : prev,
      );
      showNotice("success", "咨询师介绍页已保存");
    } catch (error) {
      const message = error instanceof Error ? error.message : "咨询师介绍页保存失败";
      setIntroError(message);
      showNotice("error", message);
      throw error;
    } finally {
      setIntroSaving(false);
    }
  }, [introProfile, showNotice]);

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
      canEditIntro={isAdmin}
      introProfile={introProfile}
      introLoading={introLoading}
      introSaving={introSaving}
      introError={introError}
      onOpenIntroEditor={openIntroEditor}
      onCloseIntroEditor={closeIntroEditor}
      onSaveIntro={saveIntro}
    />
  );
}
