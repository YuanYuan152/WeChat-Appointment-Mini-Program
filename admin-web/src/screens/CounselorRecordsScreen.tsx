"use client";

import { useCallback, useEffect, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import {
  CounselorRecordsPanel,
  type CounselorRecordFormErrors,
  type CounselorRecordFormState,
} from "@/panels/CounselorRecordsPanel";
import {
  createCounselorCaseRecord,
  fetchCounselorCaseRecord,
  fetchCounselorCaseRecordDefaults,
  fetchCounselorCaseRecordRevisions,
  fetchCounselorCaseRecords,
  fetchCounselorCompletedConsultations,
  requestCounselorCaseRecordAmendment,
} from "@/services/counselor";
import {
  createEmptyRiskAssessment,
  crisisLevelRequiresReport,
  normalizeRiskAssessment,
  riskAssessmentMissingLabel,
} from "@/constants/caseRecordRiskAssessment";
import type { CounselorCaseRecord, CounselorCaseRecordRevision, CounselorCompletedConsultation } from "@/types/api";
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
  const [formErrors, setFormErrors] = useState<CounselorRecordFormErrors>({});

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
        setFormErrors({});
        setSelectedForm({
          mode: "create",
          consultationId: consultation.Id,
          title: `填写咨询记录：${consultation.PatientName}`,
          subjective: "",
          objective: "",
          assessment: "",
          plan: "",
          riskAssessment: createEmptyRiskAssessment(),
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
        let revisions: CounselorCaseRecordRevision[] = [];
        try {
          revisions = await fetchCounselorCaseRecordRevisions(recordId);
        } catch {
          revisions = [];
        }
        let defaultHeaderInfo: Record<string, string> | undefined;
        try {
          const defaults = await fetchCounselorCaseRecordDefaults(record.ConsultationId);
          defaultHeaderInfo = defaults.HeaderInfo;
        } catch {
          defaultHeaderInfo = undefined;
        }
        setFormErrors({});
        setSelectedForm(buildFormFromRecord(record, mode, defaultHeaderInfo, revisions));
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
    setFormErrors({});
  }, []);

  const clearFormError = useCallback((field: string) => {
    setFormErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const submitForm = useCallback(async () => {
    if (!selectedForm) {
      return;
    }
    const validationErrors = validateForm(selectedForm);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }
    setFormErrors({});

    setFormLoading(true);
    clearNotice();
    try {
      const payload = {
        consultation_id: selectedForm.consultationId,
        subjective: selectedForm.subjective,
        objective: selectedForm.objective,
        assessment: selectedForm.assessment,
        plan: selectedForm.plan,
        risk_assessment: normalizeRiskAssessment(selectedForm.riskAssessment),
        header_info: selectedForm.headerInfo,
        photo_urls: selectedForm.photoUrls,
      };
      if (selectedForm.mode === "create") {
        await createCounselorCaseRecord(payload);
        showNotice(
          "success",
          crisisLevelRequiresReport(selectedForm.riskAssessment)
            ? "咨询记录已提交，已生成风险上报提醒"
            : "咨询记录已提交",
        );
      } else if (selectedForm.mode === "amend" && selectedForm.recordId) {
        await requestCounselorCaseRecordAmendment(selectedForm.recordId, {
          ...payload,
          reason: selectedForm.reason,
        });
        showNotice("success", "修改申请已提交，等待管理员审核");
      }
      setSelectedForm(undefined);
      setFormErrors({});
      await loadData();
    } catch (error) {
      setFormErrors({ form: error instanceof Error ? error.message : "提交失败" });
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
      formErrors={formErrors}
      setSelectedForm={setSelectedForm}
      onClearFormError={clearFormError}
      onOpenCreate={openCreate}
      onOpenView={(recordId) => openRecord(recordId, "view")}
      onOpenAmend={(recordId) => openRecord(recordId, "amend")}
      onCloseForm={closeForm}
      onSubmitForm={submitForm}
    />
  );
}

function buildFormFromRecord(
  record: CounselorCaseRecord,
  mode: "view" | "amend",
  defaultHeaderInfo?: Record<string, string>,
  revisions: CounselorCaseRecordRevision[] = [],
): CounselorRecordFormState {
  return {
    mode,
    consultationId: record.ConsultationId,
    recordId: record.Id,
    title: mode === "view" ? `查看咨询记录 #${record.Id}` : `申请修改咨询记录 #${record.Id}`,
    subjective: record.Subjective || "",
    objective: record.Objective || "",
    assessment: record.Assessment || "",
    plan: record.Plan || "",
    riskAssessment: normalizeRiskAssessment(record.RiskAssessment),
    reason: "",
    headerInfo: mergeHeaderInfo(defaultHeaderInfo, record.HeaderInfo),
    photoUrls: record.PhotoUrls || [],
    revisions,
    amendmentStatus: record.AmendmentStatus,
    amendmentRejectReason: record.AmendmentRejectReason,
  };
}

const HEADER_FIELD_KEYS = [
  "code",
  "gender",
  "consult_method",
  "session_number",
  "start_year",
  "start_month",
  "start_day",
  "start_hour",
  "start_minute",
  "end_hour",
  "end_minute",
  "counselor_signature",
] as const;

const HEADER_FIELD_LABELS: Record<(typeof HEADER_FIELD_KEYS)[number], string> = {
  code: "代码",
  gender: "性别",
  consult_method: "咨询方式",
  session_number: "咨询次数",
  start_year: "咨询开始年份",
  start_month: "咨询开始月份",
  start_day: "咨询开始日期",
  start_hour: "咨询开始小时",
  start_minute: "咨询开始分钟",
  end_hour: "咨询结束小时",
  end_minute: "咨询结束分钟",
  counselor_signature: "咨询师签名",
};

function validateForm(form: CounselorRecordFormState): CounselorRecordFormErrors {
  const errors: CounselorRecordFormErrors = {};
  const requiredTextFields: Array<[keyof CounselorRecordFormState, string]> = [
    ["subjective", "患者情况记录（主观陈述）"],
    ["objective", "客观观察"],
    ["assessment", "评估分析"],
    ["plan", "计划方向"],
  ];

  for (const [field, label] of requiredTextFields) {
    const value = form[field];
    if (typeof value === "string" && !value.trim()) {
      errors[String(field)] = `请填写${label}`;
    }
  }

  for (const key of HEADER_FIELD_KEYS) {
    if (!form.headerInfo[key]?.trim()) {
      errors[`header.${key}`] = `请填写${HEADER_FIELD_LABELS[key]}`;
    }
  }

  const riskMissing = riskAssessmentMissingLabel(form.riskAssessment);
  if (riskMissing) {
    errors.riskAssessment = `请完成：${riskMissing}`;
  }

  if (form.mode === "amend" && !form.reason.trim()) {
    errors.reason = "请填写修改原因";
  }

  return errors;
}

function mergeHeaderInfo(
  defaults?: Record<string, string> | null,
  recordHeader?: Record<string, string> | null,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const key of HEADER_FIELD_KEYS) {
    merged[key] = recordHeader?.[key] || defaults?.[key] || "";
  }
  return merged;
}
