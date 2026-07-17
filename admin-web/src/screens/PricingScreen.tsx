"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { PricingPanel } from "@/panels/PricingPanel";
import {
  fetchPricingCounselors,
  fetchPricingPatients,
  previewPricingBatchDefaultShare,
  updatePricingBatchDefaultShare,
  updatePricingCounselor,
  updatePricingPatient,
} from "@/services/pricing";
import type {
  PricingCounselorListResponse,
  PricingBatchDefaultSharePayload,
  PricingCounselorSummary,
  PricingCounselorUpdatePayload,
  PricingPatientListResponse,
  PricingPatientRow,
  PricingPatientUpdatePayload,
} from "@/types/api";

export function PricingScreen() {
  return (
    <AppRoute sectionId="pricing">
      <PricingScreenContent />
    </AppRoute>
  );
}

function PricingScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [counselors, setCounselors] = useState<PricingCounselorListResponse>();
  const [patients, setPatients] = useState<PricingPatientListResponse>();
  const [selectedCounselorId, setSelectedCounselorId] = useState<number | null>(null);
  const [counselorKeyword, setCounselorKeyword] = useState("");
  const [queryCounselorKeyword, setQueryCounselorKeyword] = useState("");
  const [patientKeyword, setPatientKeyword] = useState("");
  const [queryPatientKeyword, setQueryPatientKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [listLoading, setListLoading] = useState(false);
  const [patientLoading, setPatientLoading] = useState(false);
  const counselorRequestSeq = useRef(0);
  const patientRequestSeq = useRef(0);
  const counselorMutationSeq = useRef(0);
  const patientMutationSeq = useRef(0);
  const selectedCounselorIdRef = useRef<number | null>(null);

  const loadCounselors = useCallback(async (
    options: { clearExistingNotice?: boolean; notifyOnError?: boolean } = {},
  ) => {
    const { clearExistingNotice = true, notifyOnError = true } = options;
    const requestSeq = counselorRequestSeq.current + 1;
    counselorRequestSeq.current = requestSeq;
    setListLoading(true);
    if (clearExistingNotice) {
      clearNotice();
    }
    try {
      const result = await fetchPricingCounselors(queryCounselorKeyword);
      if (counselorRequestSeq.current !== requestSeq) {
        return false;
      }
      setCounselors(result);
      setSelectedCounselorId((current) => {
        const next = current && result.items.some((item) => item.counselorId === current) ? current : null;
        selectedCounselorIdRef.current = next;
        return next;
      });
      return true;
    } catch (error) {
      if (counselorRequestSeq.current === requestSeq && notifyOnError) {
        showNotice("error", error instanceof Error ? error.message : "调价管理加载失败");
      }
      return false;
    } finally {
      if (counselorRequestSeq.current === requestSeq) {
        setListLoading(false);
      }
    }
  }, [clearNotice, queryCounselorKeyword, showNotice]);

  const loadPatients = useCallback(async (
    options: { clearExistingNotice?: boolean; notifyOnError?: boolean } = {},
  ) => {
    const { clearExistingNotice = true, notifyOnError = true } = options;
    const requestSeq = patientRequestSeq.current + 1;
    patientRequestSeq.current = requestSeq;
    if (!selectedCounselorId) {
      setPatients(undefined);
      setPatientLoading(false);
      return true;
    }
    setPatientLoading(true);
    if (clearExistingNotice) {
      clearNotice();
    }
    try {
      const result = await fetchPricingPatients(selectedCounselorId, queryPatientKeyword, {
        page,
        pageSize,
      });
      if (
        patientRequestSeq.current !== requestSeq ||
        selectedCounselorIdRef.current !== selectedCounselorId ||
        result.counselor.counselorId !== selectedCounselorId
      ) {
        return false;
      }
      setPatients(result);
      return true;
    } catch (error) {
      if (patientRequestSeq.current === requestSeq && notifyOnError) {
        showNotice("error", error instanceof Error ? error.message : "来访调价列表加载失败");
      }
      return false;
    } finally {
      if (patientRequestSeq.current === requestSeq) {
        setPatientLoading(false);
      }
    }
  }, [clearNotice, page, pageSize, queryPatientKeyword, selectedCounselorId, showNotice]);

  useEffect(() => {
    void loadCounselors();
  }, [loadCounselors, refreshKey]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const searchCounselors = useCallback(() => {
    setPage(1);
    setPatients(undefined);
    if (queryCounselorKeyword === counselorKeyword.trim()) {
      void loadCounselors();
      return;
    }
    setQueryCounselorKeyword(counselorKeyword.trim());
  }, [counselorKeyword, loadCounselors, queryCounselorKeyword]);

  const resetCounselors = useCallback(() => {
    patientRequestSeq.current += 1;
    setCounselorKeyword("");
    setQueryCounselorKeyword("");
    setPatientKeyword("");
    setQueryPatientKeyword("");
    selectedCounselorIdRef.current = null;
    setSelectedCounselorId(null);
    setPage(1);
    setPatients(undefined);
    if (!queryCounselorKeyword) {
      void loadCounselors();
    }
  }, [loadCounselors, queryCounselorKeyword]);

  const closePatientPricing = useCallback(() => {
    patientRequestSeq.current += 1;
    setPatientLoading(false);
    selectedCounselorIdRef.current = null;
    setSelectedCounselorId(null);
    setPatientKeyword("");
    setQueryPatientKeyword("");
    setPage(1);
    setPatients(undefined);
  }, []);

  const selectCounselor = useCallback((counselorId: number) => {
    if (selectedCounselorId === counselorId) {
      closePatientPricing();
      return;
    }
    patientRequestSeq.current += 1;
    setPatientLoading(false);
    selectedCounselorIdRef.current = counselorId;
    setSelectedCounselorId(counselorId);
    setPatientKeyword("");
    setQueryPatientKeyword("");
    setPage(1);
    setPatients(undefined);
  }, [closePatientPricing, selectedCounselorId]);

  const searchPatients = useCallback(() => {
    setPage(1);
    if (queryPatientKeyword === patientKeyword.trim()) {
      void loadPatients();
      return;
    }
    setQueryPatientKeyword(patientKeyword.trim());
  }, [loadPatients, patientKeyword, queryPatientKeyword]);

  const resetPatients = useCallback(() => {
    setPatientKeyword("");
    setQueryPatientKeyword("");
    setPage(1);
    if (!queryPatientKeyword) {
      void loadPatients();
    }
  }, [loadPatients, queryPatientKeyword]);

  const saveCounselor = useCallback(
    async (counselor: PricingCounselorSummary, payload: PricingCounselorUpdatePayload) => {
      const mutationSeq = counselorMutationSeq.current + 1;
      counselorMutationSeq.current = mutationSeq;
      const result = await updatePricingCounselor(counselor.counselorId, payload);
      if (counselorMutationSeq.current !== mutationSeq || result.counselorId !== counselor.counselorId) {
        return;
      }
      setCounselors((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.counselorId === result.counselorId ? result : item)),
            }
          : current,
      );
      setPatients((current) =>
        current && current.counselor.counselorId === result.counselorId
          ? { ...current, counselor: result }
          : current,
      );
      if (selectedCounselorIdRef.current === result.counselorId) {
        const refreshed = await loadPatients({ clearExistingNotice: false, notifyOnError: false });
        showNotice(
          refreshed ? "success" : "info",
          refreshed ? "基础价和默认分成已保存" : "基础价和默认分成已保存，但来访调价列表刷新失败",
        );
        return;
      }
      showNotice("success", "基础价和默认分成已保存");
    },
    [loadPatients, showNotice],
  );

  const savePatient = useCallback(
    async (patient: PricingPatientRow, payload: PricingPatientUpdatePayload) => {
      const mutationSeq = patientMutationSeq.current + 1;
      patientMutationSeq.current = mutationSeq;
      const result = await updatePricingPatient(patient.counselorId, patient.patientId, payload);
      if (
        patientMutationSeq.current !== mutationSeq ||
        result.counselorId !== patient.counselorId ||
        result.patientId !== patient.patientId
      ) {
        return;
      }
      setPatients((current) =>
        current && current.counselor.counselorId === result.counselorId
          ? {
              ...current,
              items: current.items.map((item) =>
                item.counselorId === result.counselorId && item.patientId === result.patientId ? result : item,
              ),
            }
          : current,
      );
      const refreshed = await loadCounselors({
        clearExistingNotice: false,
        notifyOnError: false,
      });
      showNotice(
        refreshed ? "success" : "info",
        refreshed
          ? "来访个体调价已保存"
          : "来访个体调价已保存，但已个体调价数量刷新失败，请手动刷新后核对",
      );
    },
    [loadCounselors, showNotice],
  );

  const changePageSize = useCallback((nextPageSize: number) => {
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  return (
    <PricingPanel
      counselors={counselors}
      patients={patients}
      listLoading={listLoading}
      patientLoading={patientLoading}
      counselorKeyword={counselorKeyword}
      setCounselorKeyword={setCounselorKeyword}
      patientKeyword={patientKeyword}
      setPatientKeyword={setPatientKeyword}
      selectedCounselorId={selectedCounselorId}
      page={page}
      pageSize={pageSize}
      onSearchCounselors={searchCounselors}
      onResetCounselors={resetCounselors}
      onSelectCounselor={selectCounselor}
      onClosePatientPricing={closePatientPricing}
      onSearchPatients={searchPatients}
      onResetPatients={resetPatients}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
      onSaveCounselor={saveCounselor}
      onSavePatient={savePatient}
      onPreviewBatchShare={previewPricingBatchDefaultShare}
      onBatchError={(message) => showNotice("error", message)}
      onApplyBatchShare={async (payload: PricingBatchDefaultSharePayload) => {
        const result = await updatePricingBatchDefaultShare(payload);
        const [counselorsRefreshed, patientsRefreshed] = await Promise.all([
          loadCounselors({ clearExistingNotice: false, notifyOnError: false }),
          selectedCounselorId
            ? loadPatients({ clearExistingNotice: false, notifyOnError: false })
            : Promise.resolve(true),
        ]);
        const successText = `已调整 ${result.changedCount} 名咨询师的默认分成${
          result.clearedPatientShareOverrideCount
            ? `，清除 ${result.clearedPatientShareOverrideCount} 项个体分成`
            : ""
        }`;
        showNotice(
          counselorsRefreshed && patientsRefreshed ? "success" : "info",
          counselorsRefreshed && patientsRefreshed
            ? successText
            : `${successText}，但列表刷新失败，请手动刷新后核对`,
        );
        return result;
      }}
    />
  );
}
