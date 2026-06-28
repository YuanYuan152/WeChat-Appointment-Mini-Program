"use client";

import { useCallback, useEffect, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import {
  CounselorRecordsPanel,
  type CounselorRecordFormState,
} from "@/panels/CounselorRecordsPanel";
import {
  createCounselorCaseRecord,
  fetchCounselorCaseRecord,
  fetchCounselorCaseRecordDefaults,
  fetchCounselorCaseRecords,
  fetchCounselorCompletedConsultations,
  requestCounselorCaseRecordAmendment,
} from "@/services/counselor";
import type { CounselorCaseRecord, CounselorCompletedConsultation } from "@/types/api";
import type { ScreenData } from "@/types/app";

export function CounselorRecordsScreen() {
  return (
    <AppRoute sectionId="counselorRecords">
      <CounselorRecordsScreenContent />
    </AppRoute>
  );
}

function CounselorRecordsScreenContent() {
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [data, setData] = useState<ScreenData>({});
  const [listLoading, setListLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedForm, setSelectedForm] = useState<CounselorRecordFormState>();

  const loadData = useCallback(async () => {
    setListLoading(true);
    clearNotice();
    try {
      const [counselorCompletedConsultations, counselorCaseRecords] = await Promise.all([
        fetchCounselorCompletedConsultations(),
        fetchCounselorCaseRecords(),
      ]);
      setData((prev) => ({ ...prev, counselorCompletedConsultations, counselorCaseRecords }));
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "咨询记录加载失败");
    } finally {
      setListLoading(false);
    }
  }, [clearNotice, showNotice]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const openCreate = useCallback(
    async (consultation: CounselorCompletedConsultation) => {
      setFormLoading(true);
      clearNotice();
      try {
        const defaults = await fetchCounselorCaseRecordDefaults(consultation.Id);
        setSelectedForm({
          mode: "create",
          consultationId: consultation.Id,
          title: `填写咨询记录：${consultation.PatientName}`,
          subjective: "",
          objective: "",
          assessment: "",
          plan: "",
          riskLevel: "D",
          reason: "",
          headerInfo: defaults.HeaderInfo,
          photoUrls: [],
        });
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "表头信息加载失败");
      } finally {
        setFormLoading(false);
      }
    },
    [clearNotice, showNotice],
  );

  const openRecord = useCallback(
    async (recordId: number, mode: "view" | "amend") => {
      setFormLoading(true);
      clearNotice();
      try {
        const record = await fetchCounselorCaseRecord(recordId);
        setSelectedForm(buildFormFromRecord(record, mode));
      } catch (error) {
        showNotice("error", error instanceof Error ? error.message : "记录详情加载失败");
      } finally {
        setFormLoading(false);
      }
    },
    [clearNotice, showNotice],
  );

  const closeForm = useCallback(() => {
    setSelectedForm(undefined);
  }, []);

  const submitForm = useCallback(async () => {
    if (!selectedForm) {
      return;
    }
    if (!selectedForm.subjective.trim() || !selectedForm.objective.trim() || !selectedForm.assessment.trim() || !selectedForm.plan.trim()) {
      showNotice("error", "请完整填写主观资料、客观资料、评估和计划");
      return;
    }
    if (selectedForm.mode === "amend" && !selectedForm.reason.trim()) {
      showNotice("error", "请填写修改原因");
      return;
    }

    setFormLoading(true);
    clearNotice();
    try {
      const payload = {
        consultation_id: selectedForm.consultationId,
        subjective: selectedForm.subjective,
        objective: selectedForm.objective,
        assessment: selectedForm.assessment,
        plan: selectedForm.plan,
        risk_assessment: buildRiskAssessment(selectedForm.riskLevel),
        header_info: selectedForm.headerInfo,
        photo_urls: selectedForm.photoUrls,
      };
      if (selectedForm.mode === "create") {
        await createCounselorCaseRecord(payload);
        showNotice("success", "咨询记录已提交");
      } else if (selectedForm.mode === "amend" && selectedForm.recordId) {
        await requestCounselorCaseRecordAmendment(selectedForm.recordId, {
          ...payload,
          reason: selectedForm.reason,
        });
        showNotice("success", "修改申请已提交，等待管理员审核");
      }
      setSelectedForm(undefined);
      await loadData();
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "提交失败");
    } finally {
      setFormLoading(false);
    }
  }, [clearNotice, loadData, selectedForm, showNotice]);

  return (
    <CounselorRecordsPanel
      consultations={data.counselorCompletedConsultations}
      records={data.counselorCaseRecords}
      selectedForm={selectedForm}
      listLoading={listLoading}
      formLoading={formLoading}
      setSelectedForm={setSelectedForm}
      onOpenCreate={openCreate}
      onOpenView={(recordId) => openRecord(recordId, "view")}
      onOpenAmend={(recordId) => openRecord(recordId, "amend")}
      onCloseForm={closeForm}
      onSubmitForm={submitForm}
    />
  );
}

function buildFormFromRecord(record: CounselorCaseRecord, mode: "view" | "amend"): CounselorRecordFormState {
  return {
    mode,
    consultationId: record.ConsultationId,
    recordId: record.Id,
    title: mode === "view" ? `查看咨询记录 #${record.Id}` : `申请修改咨询记录 #${record.Id}`,
    subjective: record.Subjective || "",
    objective: record.Objective || "",
    assessment: record.Assessment || "",
    plan: record.Plan || "",
    riskLevel: extractRiskLevel(record.RiskAssessment),
    reason: "",
    headerInfo: record.HeaderInfo || {},
    photoUrls: record.PhotoUrls || [],
    amendmentStatus: record.AmendmentStatus,
    amendmentRejectReason: record.AmendmentRejectReason,
  };
}

function extractRiskLevel(riskAssessment?: Record<string, unknown> | null): "A" | "B" | "C" | "D" {
  const items = riskAssessment?.items;
  if (!items || typeof items !== "object") {
    return "D";
  }
  const crisis = (items as Record<string, unknown>).crisis_level;
  if (!crisis || typeof crisis !== "object") {
    return "D";
  }
  const choice = (crisis as { choice?: unknown }).choice;
  return choice === "A" || choice === "B" || choice === "C" || choice === "D" ? choice : "D";
}

function buildRiskAssessment(riskLevel: "A" | "B" | "C" | "D") {
  const items: Record<string, { choice: string; note: string }> = {
    diagnosis: { choice: "A", note: "" },
    support_system: { choice: "A", note: "" },
    self_harm: { choice: "A", note: "" },
    harm_others: { choice: "A", note: "" },
    self_care: { choice: "A", note: "" },
    stress_event: { choice: "A", note: "" },
    family_history: { choice: "A", note: "" },
    medical_history: { choice: "A", note: "" },
    trauma_history: { choice: "A", note: "" },
    crisis_level: { choice: riskLevel, note: "" },
  };
  return { items };
}
