/** 企业定制数据管理：与 backend-python/enterprise_data_service.py 的返回结构一致。 */

export type Severity = "ok" | "watch" | "mid" | "high";
export type FollowUpStatus = "pending" | "engaged" | "following" | "resolved" | "dismissed";
export type EnterpriseResultType = "sum" | "dimension" | "match";
export type RespondentStatus = "done" | "doing" | "todo";

export interface EnterpriseDataSummary {
  id: string;
  companyName: string;
  siteName: string;
  slug: string;
  url: string;
  logoUrl: string;
  assessmentCount: number;
  personnelEmployeeCount: number;
  respondentCount: number;
  reportCount: number;
  riskRespondentCount: number;
  highRiskRespondentCount: number;
  pendingAlertCount: number;
  latestAt: string | null;
}

export interface EnterpriseDataMeta {
  id: string;
  companyName: string;
  siteName: string;
  slug: string;
  url: string;
  logoUrl: string;
  assessmentIds: string[];
  loginRequired: boolean;
  personnelEmployeeCount: number;
  personnelAdminCount: number;
  hideLibrary: boolean;
}

export interface EnterpriseDataField {
  id: string;
  label: string;
  group: string;
  enabled: boolean;
}

export interface EnterpriseAssessmentDimension {
  id: string;
  title: string;
  levels: string[];
}

export interface EnterpriseDataAssessment {
  id: string;
  title: string;
  authorized: boolean;
  resultType: EnterpriseResultType | null;
  levels: string[];
  dimensions: EnterpriseAssessmentDimension[];
}

export interface EnterpriseDataPersonnel {
  id: number;
  username: string;
  empNo: string;
  realName: string;
}

export interface EnterpriseLearningStats {
  views: number;
  completes: number;
  minutes: number;
  lastAt: string | null;
}

export interface EnterpriseRespondent {
  key: string;
  accountIds: number[];
  personnel: EnterpriseDataPersonnel | null;
  name: string;
  empNo: string;
  displayName: string;
  info: Record<string, string>;
  firstAt: string | null;
  lastAt: string | null;
  reportCount: number;
  completedAssessmentIds: string[];
  completedCount: number;
  status: "done" | "doing";
  severity: Severity | null;
  tags: string[];
  annotationCount: number;
  lastAnnotatedAt: string | null;
  lastNote: string;
  lastNoteBy: string;
  lastNoteAt: string | null;
  learning: EnterpriseLearningStats | null;
}

export interface EnterpriseReportDimension {
  id: string;
  title: string;
  score: number | null;
  level: string;
  severity: Severity | null;
}

export interface EnterpriseReportTrigger {
  title: string;
  level: string;
  score: number | null;
  severity: Severity;
}

export interface EnterpriseFollowUpHistoryItem {
  at: string | null;
  by: string;
  status: FollowUpStatus;
  severityOverride: Severity | null;
  owner: string;
  note: string;
}

export interface EnterpriseFollowUp {
  status: FollowUpStatus;
  severityOverride: Severity | null;
  owner: string;
  note: string;
  updatedAt: string | null;
  updatedBy: string;
  history: EnterpriseFollowUpHistoryItem[];
}

export interface EnterpriseReportItem {
  publicId: string;
  respondentKey: string;
  accountId: number;
  assessmentId: string;
  assessmentVersion: number;
  assessmentTitle: string;
  scoringType: string;
  completedAt: string | null;
  summary: string;
  resultType: EnterpriseResultType | null;
  score: number | null;
  level: string;
  dimensions: EnterpriseReportDimension[];
  autoSeverity: Severity | null;
  severity: Severity | null;
  triggers: EnterpriseReportTrigger[];
  isLatest: boolean;
  followUp: EnterpriseFollowUp | null;
}

export interface EnterpriseRosterItem {
  personnelId: number;
  username: string;
  empNo: string;
  realName: string;
  respondentKey: string | null;
}

export interface EnterpriseLearningContent {
  contentType: "article" | "audio";
  contentId: string;
  title: string;
  views: number;
  completes: number;
  learners: number;
  minutes: number;
}

export interface EnterpriseLearningSummary {
  totalViews: number;
  learnerCount: number;
  linkedLearnerCount: number;
  totalMinutes: number;
  articleViews: number;
  audioPlays: number;
  topContents: EnterpriseLearningContent[];
}

export interface EnterpriseTagGroup {
  name: string;
  color: string;
  tags: string[];
}

export interface EnterpriseAnnotation {
  id: number;
  respondentKey: string;
  respondentName: string;
  tags: string[];
  note: string;
  source: string;
  operatorName: string;
  operatorAccountId: number | null;
  createdAt: string | null;
}

export interface EnterpriseDataset {
  enterprise: EnterpriseDataMeta;
  generatedAt: string;
  fields: EnterpriseDataField[];
  assessments: EnterpriseDataAssessment[];
  respondents: EnterpriseRespondent[];
  reports: EnterpriseReportItem[];
  roster: EnterpriseRosterItem[];
  learning: EnterpriseLearningSummary;
  tagLibrary: EnterpriseTagGroup[];
  recentAnnotations: EnterpriseAnnotation[];
  followUpStatuses: Array<{ value: FollowUpStatus; label: string }>;
}

export interface EnterpriseLearningEventItem {
  contentType: "article" | "audio";
  contentId: string;
  title: string;
  action: "view" | "read" | "play" | "complete";
  durationSec: number | null;
  at: string | null;
}

export interface EnterpriseRespondentDetail {
  key: string;
  annotations: EnterpriseAnnotation[];
  learningEvents: EnterpriseLearningEventItem[];
}

export interface EnterpriseFollowUpInput {
  status: FollowUpStatus;
  severityOverride: Severity | null;
  owner: string;
  note: string;
}

export interface EnterpriseAnnotationInput {
  respondentName: string;
  tags: string[];
  note: string;
  source: string;
}
