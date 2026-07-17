"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { PricingPatientsPanel } from "@/panels/PricingPatientsPanel";
import {
  fetchPricingCounselors,
  fetchPricingPatients,
  updatePricingPatient,
} from "@/services/pricing";
import type {
  PricingPatientListResponse,
  PricingPatientRow,
  PricingPatientUpdatePayload,
} from "@/types/api";

export function PricingPatientsScreen() {
  return (
    <AppRoute sectionId="pricing">
      <PricingPatientsScreenContent />
    </AppRoute>
  );
}

function PricingPatientsScreenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const counselorId = Number(searchParams.get("counselorId") || 0);
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [patients, setPatients] = useState<PricingPatientListResponse>();
  const [patientKeyword, setPatientKeyword] = useState("");
  const [queryPatientKeyword, setQueryPatientKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [patientLoading, setPatientLoading] = useState(false);
  const patientRequestSeq = useRef(0);
  const patientMutationSeq = useRef(0);
  const counselorIdRef = useRef(counselorId);
  counselorIdRef.current = counselorId;

  const loadPatients = useCallback(
    async (options: { clearExistingNotice?: boolean; notifyOnError?: boolean } = {}) => {
      const { clearExistingNotice = true, notifyOnError = true } = options;
      const requestSeq = patientRequestSeq.current + 1;
      patientRequestSeq.current = requestSeq;
      if (!counselorId) {
        setPatients(undefined);
        setPatientLoading(false);
        return false;
      }
      setPatientLoading(true);
      if (clearExistingNotice) {
        clearNotice();
      }
      try {
        const result = await fetchPricingPatients(counselorId, queryPatientKeyword, {
          page,
          pageSize,
        });
        if (
          patientRequestSeq.current !== requestSeq ||
          counselorIdRef.current !== counselorId ||
          result.counselor.counselorId !== counselorId
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
    },
    [clearNotice, counselorId, page, pageSize, queryPatientKeyword, showNotice],
  );

  useEffect(() => {
    if (!counselorId) {
      router.replace("/pricing");
      return;
    }
    void loadPatients();
  }, [counselorId, loadPatients, refreshKey, router]);

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
                item.counselorId === result.counselorId && item.patientId === result.patientId
                  ? result
                  : item,
              ),
            }
          : current,
      );
      try {
        await fetchPricingCounselors("");
      } catch {
        // 列表数量刷新失败不影响本次保存结果提示。
      }
      showNotice("success", "来访个体调价已保存");
    },
    [showNotice],
  );

  return (
    <PricingPatientsPanel
      patients={patients}
      patientLoading={patientLoading}
      patientKeyword={patientKeyword}
      setPatientKeyword={setPatientKeyword}
      page={page}
      pageSize={pageSize}
      onSearchPatients={searchPatients}
      onResetPatients={resetPatients}
      onPageChange={setPage}
      onPageSizeChange={(nextPageSize) => {
        setPage(1);
        setPageSize(nextPageSize);
      }}
      onSavePatient={savePatient}
    />
  );
}
