import type {
  AssessmentCategory,
  AssessmentDefinition,
  AssessmentRiskSeverity,
  AssessmentScoringType,
} from "@/types/assessment";

export type AssessmentReportSource = "eap" | "mini-legacy";

interface AssessmentReportListItemBase {
  reportId: string;
  accountId: number;
  patientName: string;
  patientMobile: string | null;
  assessmentId: string;
  assessmentTitle: string;
  resultSummary: string;
  completedAt: string;
  /** 企业定制 EAP：网站名.公司名 */
  sourceDetail?: string | null;
  /** 展示文案：自有EAP网页 / EAP量表 / EAP量表.网站名.公司名 */
  sourceLabel?: string | null;
  /** 筛选用：mini-legacy | eap | eap:网站名.公司名 */
  sourceKey?: string | null;
  entryChannel?: string | null;
  /** 量表配置了风险维度时的判定摘要（仅 EAP 报告，未配置为 null） */
  risk?: AssessmentRiskSummary | null;
}

export interface AssessmentReportSourceOption {
  key: string;
  label: string;
}

export interface EapAssessmentReportListItem
  extends AssessmentReportListItemBase {
  source: "eap";
  assessmentVersion: number;
  category: AssessmentCategory;
}

export interface LegacyAssessmentReportListItem
  extends AssessmentReportListItemBase {
  source: "mini-legacy";
  assessmentVersion: null;
  category: "professional";
}

export type AssessmentReportListItem =
  | EapAssessmentReportListItem
  | LegacyAssessmentReportListItem;

export interface AssessmentReportPage {
  items: AssessmentReportListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AssessmentReportListFilters {
  page: number;
  pageSize: number;
  keyword?: string;
  assessmentId?: string;
  category?: AssessmentCategory | "";
  /** @deprecated 请使用 sourceKey */
  source?: AssessmentReportSource | "";
  /** mini-legacy | eap | eap:网站名.公司名 */
  sourceKey?: string;
  /** 完成时间（日期，按中国时区当天筛选） */
  completedAt?: string;
  /** @deprecated 由 completedAt 推导，保留兼容 */
  startAt?: string;
  /** @deprecated 由 completedAt 推导，保留兼容 */
  endAt?: string;
}

export interface PatientAssessmentReportListFilters {
  page: number;
  pageSize: number;
  source?: AssessmentReportSource | "";
  sourceKey?: string;
}

export interface AssessmentRiskTriggerHit {
  id: string;
  level: string;
  severity: AssessmentRiskSeverity;
  /** 本次作答命中的选项 */
  optionIds: string[];
  description: string;
}

/** 风险维度计分结果：仅管理端接口返回。 */
export interface AssessmentRiskResult {
  title: string;
  level: string;
  /** 计分判定没有命中区间时为 null */
  severity: AssessmentRiskSeverity | null;
  source: "score" | "trigger" | "none";
  description: string;
  suggestions: string[];
  triggers: AssessmentRiskTriggerHit[];
  /** 配置了计分判定时才有 */
  score?: number;
  scoreLevel?: string;
  scoreSeverity?: AssessmentRiskSeverity | null;
}

export interface AssessmentRiskSummary {
  level: string;
  severity: AssessmentRiskSeverity | null;
  source: AssessmentRiskResult["source"];
}

export interface SumAssessmentScoreResult {
  type: "sum";
  totalScore: number;
  level: string;
  description: string;
  visitorDescription?: string;
  analystDescription?: string;
  suggestions: string[];
  risk?: AssessmentRiskResult;
}

export interface MatchAssessmentScoreResult {
  type: "match";
  resultId: string;
  title: string;
  description: string;
  image: string;
  shareText: string;
  risk?: AssessmentRiskResult;
}

export interface DimensionAssessmentScoreItem {
  id: string;
  title: string;
  score: number;
  level: string;
  description: string;
  visitorDescription?: string;
  analystDescription?: string;
  suggestions: string[];
}

export interface DimensionAssessmentTotalResult {
  title: string;
  score: number;
  level: string;
  description: string;
  visitorDescription?: string;
  analystDescription?: string;
  suggestions: string[];
}

export interface DimensionAssessmentScoreResult {
  type: "dimension";
  dimensions: DimensionAssessmentScoreItem[];
  summary?: string;
  /** 配置了总分的维度量表才有 */
  total?: DimensionAssessmentTotalResult;
  risk?: AssessmentRiskResult;
}

export type AssessmentScoreResult =
  | SumAssessmentScoreResult
  | MatchAssessmentScoreResult
  | DimensionAssessmentScoreResult;

export interface AssessmentReportSnapshot {
  schemaVersion: 1;
  assessment: AssessmentDefinition;
  result: AssessmentScoreResult;
  reportContent: {
    title: string;
    subtitle: string;
    cover: string;
    disclaimer: string;
    reportIntro: string;
    features: string;
  };
  completedAt: string;
}

export interface EapAssessmentReportDetail
  extends EapAssessmentReportListItem {
  publicId: string;
  assessmentSubtitle: string;
  cover: string;
  scoringType: AssessmentScoringType;
  result: AssessmentScoreResult;
  reportSnapshot: AssessmentReportSnapshot;
  demographicAnswers?: Record<string, unknown>;
  answers?: Record<string, string>;
}

export interface LegacyAssessmentResult {
  id: number;
  scaleType: string;
  scaleLabel: string;
  total: number;
  levelLabel: string;
  description: string;
  suggestions: string[];
  resultSummary: string;
  answers?: number[];
  createdAt: string;
}

export interface LegacyAssessmentReportDetail
  extends LegacyAssessmentReportListItem {
  result: LegacyAssessmentResult;
}

export type AssessmentReportDetail =
  | EapAssessmentReportDetail
  | LegacyAssessmentReportDetail;
