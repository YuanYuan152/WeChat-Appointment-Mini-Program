"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { PricingPanel } from "@/panels/PricingPanel";
import {
  fetchPricingCounselors,
  previewPricingBatchDefaultShare,
  updatePricingBatchDefaultShare,
  updatePricingCounselor,
} from "@/services/pricing";
import type {
  PricingCounselorListResponse,
  PricingBatchDefaultSharePayload,
  PricingCounselorSummary,
  PricingCounselorUpdatePayload,
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
  const [counselorKeyword, setCounselorKeyword] = useState("");
  const [queryCounselorKeyword, setQueryCounselorKeyword] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const counselorRequestSeq = useRef(0);
  const counselorMutationSeq = useRef(0);

  const loadCounselors = useCallback(
    async (options: { clearExistingNotice?: boolean; notifyOnError?: boolean } = {}) => {
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
    },
    [clearNotice, queryCounselorKeyword, showNotice],
  );

  useEffect(() => {
    void loadCounselors();
  }, [loadCounselors, refreshKey]);

  const searchCounselors = useCallback(() => {
    if (queryCounselorKeyword === counselorKeyword.trim()) {
      void loadCounselors();
      return;
    }
    setQueryCounselorKeyword(counselorKeyword.trim());
  }, [counselorKeyword, loadCounselors, queryCounselorKeyword]);

  const resetCounselors = useCallback(() => {
    setCounselorKeyword("");
    setQueryCounselorKeyword("");
    if (!queryCounselorKeyword) {
      void loadCounselors();
    }
  }, [loadCounselors, queryCounselorKeyword]);

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
      showNotice("success", "基础价和默认分成已保存");
    },
    [showNotice],
  );

  return (
    <PricingPanel
      counselors={counselors}
      listLoading={listLoading}
      counselorKeyword={counselorKeyword}
      setCounselorKeyword={setCounselorKeyword}
      onSearchCounselors={searchCounselors}
      onResetCounselors={resetCounselors}
      onSaveCounselor={saveCounselor}
      onPreviewBatchShare={previewPricingBatchDefaultShare}
      onBatchError={(message) => showNotice("error", message)}
      onApplyBatchShare={async (payload: PricingBatchDefaultSharePayload) => {
        const result = await updatePricingBatchDefaultShare(payload);
        const counselorsRefreshed = await loadCounselors({
          clearExistingNotice: false,
          notifyOnError: false,
        });
        const successText = `已调整 ${result.changedCount} 名咨询师的默认分成${
          result.clearedPatientShareOverrideCount
            ? `，清除 ${result.clearedPatientShareOverrideCount} 项个体分成`
            : ""
        }`;
        showNotice(
          counselorsRefreshed ? "success" : "info",
          counselorsRefreshed ? successText : `${successText}，但列表刷新失败，请手动刷新后核对`,
        );
        return result;
      }}
    />
  );
}
