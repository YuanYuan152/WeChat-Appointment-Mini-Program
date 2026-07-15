import type { ProxyPersonOption, UserBoardSummary } from "@/types/api";

type PatientContractFields = Pick<
  UserBoardSummary,
  "isContractSigned" | "boundCounselorName" | "contractTag"
>;

export function patientContractTag(patient?: PatientContractFields | ProxyPersonOption | null) {
  if (patient?.contractTag?.trim()) {
    return patient.contractTag.trim();
  }
  if (!patient?.isContractSigned || !patient.boundCounselorName) {
    return "";
  }
  return `已签约-【${patient.boundCounselorName}】`;
}

export function formatPatientNameWithContractTag(
  name?: string | null,
  contractTag?: string | null,
) {
  const patientName = (name || "").trim();
  const tag = (contractTag || "").trim();
  if (!patientName) {
    return tag;
  }
  if (!tag || patientName.includes(tag)) {
    return patientName;
  }
  return `${patientName} ${tag}`;
}

export function formatPatientInline(
  patient?: (PatientContractFields & { name?: string }) | ProxyPersonOption | null,
) {
  if (!patient?.name) {
    return "";
  }
  return formatPatientNameWithContractTag(patient.name, patientContractTag(patient));
}

export function boundCounselorFromPatient(patient?: ProxyPersonOption | null): ProxyPersonOption | undefined {
  if (!patient?.boundCounselorId || !patient.boundCounselorName) {
    return undefined;
  }
  return {
    id: patient.boundCounselorId,
    name: patient.boundCounselorName,
    label: patient.boundCounselorName,
  };
}
