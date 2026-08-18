"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchCounselorBoard, fetchCounselorBoardDetail, updateStaffRemark } from "@/services/boards";
import { fetchAdminCounselorIntro, updateAdminCounselorIntro } from "@/services/adminCounselors";
import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { CounselorBoardPanel } from "@/panels/CounselorBoardPanel";
import { canManageStaffOperationalSettings } from "@/config/userRoleMeta";
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
  const { clearNotice, currentUser, refreshKey, showNotice } = useAppRoute();
  const canEditIntro = canManageStaffOperationalSettings(currentUser.roles);
  const [data, setData] = useState<ScreenData>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [draftKeyword, setDraftKeyword] = useState("");
  const [selectedCounselorBoard, setSelectedCounselorBoard] = useState<CounselorBoardDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [remarkSavingAccountId, setRemarkSavingAccountId] = useState<number>();
  const [introProfile, setIntroProfile] = useState<AdminCounselorIntroProfile>();
  const [introLoading, setIntroLoading] = useState(false);
  const [introSaving, setIntroSaving] = useState(false);
  const [introError, setIntroError] = useState<string | null>(null);
  const listRequestSeq = useRef(0);
  const detailRequestSeq = useRef(0);
  const introRequestSeq = useRef(0);
  const introMutationSeq = useRef(0);
  const selectedAccountIdRef = useRef<number | undefined>(undefined);
  const openIntroAccountIdRef = useRef<number | undefined>(undefined);

  const loadData = useCallback(async () => {
    const requestSeq = listRequestSeq.current + 1;
    listRequestSeq.current = requestSeq;
    setListLoading(true);
    clearNotice();
    try {
      const counselorBoard = await fetchCounselorBoard(keyword, {
        page,
        pageSize,
      });
      if (listRequestSeq.current !== requestSeq) {
        return false;
      }
      setData((prev) => ({ ...prev, counselorBoard }));
      return true;
    } catch (error) {
      if (listRequestSeq.current === requestSeq) {
        showNotice("error", error instanceof Error ? error.message : "咨询师管理加载失败");
      }
      return false;
    } finally {
      if (listRequestSeq.current === requestSeq) {
        setListLoading(false);
      }
    }
  }, [clearNotice, keyword, page, pageSize, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const updateKeyword = useCallback((value: string) => {
    setDraftKeyword(value);
  }, []);

  const closeDetail = useCallback(() => {
    detailRequestSeq.current += 1;
    selectedAccountIdRef.current = undefined;
    setDetailLoading(false);
    setSelectedCounselorBoard(undefined);
  }, []);

  const openCounselorDetail = useCallback(async (accountId: number) => {
    const requestSeq = detailRequestSeq.current + 1;
    detailRequestSeq.current = requestSeq;
    selectedAccountIdRef.current = accountId;
    setSelectedCounselorBoard(undefined);
    setDetailLoading(true);
    try {
      const selectedCounselorBoard = await fetchCounselorBoardDetail(accountId);
      if (detailRequestSeq.current !== requestSeq || selectedAccountIdRef.current !== accountId) {
        return false;
      }
      setSelectedCounselorBoard(selectedCounselorBoard);
      return true;
    } catch (error) {
      if (detailRequestSeq.current === requestSeq && selectedAccountIdRef.current === accountId) {
        showNotice("error", error instanceof Error ? error.message : "咨询师详情加载失败");
      }
      return false;
    } finally {
      if (detailRequestSeq.current === requestSeq) {
        setDetailLoading(false);
      }
    }
  }, [showNotice]);

  useEffect(() => {
    const selectedAccountId = selectedAccountIdRef.current;
    if (selectedAccountId) {
      void openCounselorDetail(selectedAccountId);
    }
  }, [openCounselorDetail, refreshKey]);

  const search = useCallback(() => {
    closeDetail();
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
  }, [closeDetail, draftKeyword, keyword, loadData, page]);

  const resetKeyword = useCallback(() => {
    setDraftKeyword("");
    closeDetail();
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
  }, [closeDetail, keyword, loadData, page]);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  const openIntroEditor = useCallback(async (accountId: number) => {
    if (!canEditIntro) {
      showNotice("error", "当前角色无法编辑咨询师介绍页");
      return;
    }
    const requestSeq = introRequestSeq.current + 1;
    introRequestSeq.current = requestSeq;
    openIntroAccountIdRef.current = accountId;
    setIntroProfile(undefined);
    setIntroError(null);
    setIntroLoading(true);
    try {
      const profile = await fetchAdminCounselorIntro(accountId);
      if (introRequestSeq.current !== requestSeq || openIntroAccountIdRef.current !== accountId) {
        return;
      }
      setIntroProfile(profile);
    } catch (error) {
      if (introRequestSeq.current !== requestSeq || openIntroAccountIdRef.current !== accountId) {
        return;
      }
      const message = error instanceof Error ? error.message : "介绍页资料加载失败";
      setIntroError(message);
      showNotice("error", message);
    } finally {
      if (introRequestSeq.current === requestSeq) {
        setIntroLoading(false);
      }
    }
  }, [canEditIntro, showNotice]);

  const closeIntroEditor = useCallback(() => {
    introRequestSeq.current += 1;
    introMutationSeq.current += 1;
    openIntroAccountIdRef.current = undefined;
    setIntroLoading(false);
    setIntroSaving(false);
    setIntroProfile(undefined);
    setIntroError(null);
  }, []);

  const saveIntro = useCallback(async (payload: AdminCounselorIntroUpdatePayload) => {
    if (!introProfile) {
      return;
    }
    const counselorId = introProfile.counselorId;
    const mutationSeq = introMutationSeq.current + 1;
    introMutationSeq.current = mutationSeq;
    setIntroSaving(true);
    setIntroError(null);
    try {
      const savedProfile = await updateAdminCounselorIntro(counselorId, payload);
      if (
        introMutationSeq.current !== mutationSeq ||
        openIntroAccountIdRef.current !== counselorId ||
        savedProfile.counselorId !== counselorId
      ) {
        return;
      }
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
      if (introMutationSeq.current !== mutationSeq || openIntroAccountIdRef.current !== counselorId) {
        return;
      }
      const message = error instanceof Error ? error.message : "咨询师介绍页保存失败";
      setIntroError(message);
      showNotice("error", message);
      throw error;
    } finally {
      if (introMutationSeq.current === mutationSeq) {
        setIntroSaving(false);
      }
    }
  }, [introProfile, showNotice]);

  const saveStaffRemark = useCallback(async (accountId: number, remark: string) => {
    clearNotice();
    setRemarkSavingAccountId(accountId);
    try {
      const saved = await updateStaffRemark(accountId, remark);
      setData((current) => ({
        ...current,
        counselorBoard: current.counselorBoard
          ? {
              ...current.counselorBoard,
              items: current.counselorBoard.items.map((item) =>
                item.id === accountId ? { ...item, staffRemark: saved.staffRemark } : item,
              ),
            }
          : current.counselorBoard,
      }));
      setSelectedCounselorBoard((current) =>
        current && current.profile.id === accountId
          ? { ...current, profile: { ...current.profile, staffRemark: saved.staffRemark } }
          : current,
      );
      showNotice("success", saved.staffRemark ? "内部备注已保存" : "内部备注已清空");
      return saved.staffRemark;
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "内部备注保存失败");
      throw error;
    } finally {
      setRemarkSavingAccountId(undefined);
    }
  }, [clearNotice, showNotice]);

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
      canEditIntro={canEditIntro}
      introProfile={introProfile}
      introLoading={introLoading}
      introSaving={introSaving}
      introError={introError}
      onOpenIntroEditor={openIntroEditor}
      onCloseIntroEditor={closeIntroEditor}
      onSaveIntro={saveIntro}
      remarkSaving={remarkSavingAccountId === selectedCounselorBoard?.profile.id}
      onSaveRemark={saveStaffRemark}
    />
  );
}
