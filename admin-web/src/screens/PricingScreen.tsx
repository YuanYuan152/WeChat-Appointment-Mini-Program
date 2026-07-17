"use client";

import { useCallback, useEffect, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { PricingPanel } from "@/panels/PricingPanel";
import {
  fetchPricingCounselors,
  fetchPricingPatients,
  updatePricingCounselor,
  updatePricingPatient,
} from "@/services/pricing";
import type {
  PricingCounselorListResponse,
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

  const loadCounselors = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const result = await fetchPricingCounselors(queryCounselorKeyword);
      setCounselors(result);
      setSelectedCounselorId((current) => {
        if (current && result.items.some((item) => item.counselorId === current)) {
          return current;
        }
        return result.items[0]?.counselorId ?? null;
      });
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "调价管理加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, queryCounselorKeyword, showNotice]);

  const loadPatients = useCallback(async () => {
    if (!selectedCounselorId) {
      setPatients(undefined);
      return;
    }
    setPatientLoading(true);
    clearNotice();
    try {
      const result = await fetchPricingPatients(selectedCounselorId, queryPatientKeyword, {
        page,
        pageSize,
      });
      setPatients(result);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "来访调价列表加载失败");
    } finally {
      setPatientLoading(false);
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
    setCounselorKeyword("");
    setQueryCounselorKeyword("");
    setPatientKeyword("");
    setQueryPatientKeyword("");
    setPage(1);
    setPatients(undefined);
    if (!queryCounselorKeyword) {
      void loadCounselors();
    }
  }, [loadCounselors, queryCounselorKeyword]);

  const selectCounselor = useCallback((counselorId: number) => {
    setSelectedCounselorId(counselorId);
    setPatientKeyword("");
    setQueryPatientKeyword("");
    setPage(1);
  }, []);

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
      const result = await updatePricingCounselor(counselor.counselorId, payload);
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
      if (selectedCounselorId === result.counselorId) {
        const refreshedPatients = await fetchPricingPatients(result.counselorId, queryPatientKeyword, {
          page,
          pageSize,
        });
        setPatients(refreshedPatients);
      }
      showNotice("success", "基础价和默认分成已保存");
    },
    [page, pageSize, queryPatientKeyword, selectedCounselorId, showNotice],
  );

  const savePatient = useCallback(
    async (patient: PricingPatientRow, payload: PricingPatientUpdatePayload) => {
      const result = await updatePricingPatient(patient.counselorId, patient.patientId, payload);
      const alreadyConfigured = Boolean(
        patient.shareMode ||
          patient.revenueShareAmountCents != null ||
          patient.revenueSharePercent != null ||
          patient.manualAdjustmentYuan !== 0,
      );
      setPatients((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.patientId === result.patientId ? result : item)),
            }
          : current,
      );
      setCounselors((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.counselorId === patient.counselorId
                  ? {
                      ...item,
                      configuredPatientCount: alreadyConfigured
                        ? item.configuredPatientCount
                        : item.configuredPatientCount + 1,
                    }
                  : item,
              ),
            }
          : current,
      );
      showNotice("success", "来访个体调价已保存");
    },
    [showNotice],
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
      onSearchPatients={searchPatients}
      onResetPatients={resetPatients}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
      onSaveCounselor={saveCounselor}
      onSavePatient={savePatient}
    />
  );
}
