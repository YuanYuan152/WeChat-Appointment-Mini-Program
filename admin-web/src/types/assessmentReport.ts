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
  /** 量表配置了风险规则时的判定摘要（仅 EAP 报告，未配置为 null） */
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

/** 旧版风险结果里命中的选项触发规则。 */
export interface AssessmentRiskTriggerHit {
  id: string;
  level: string;
  severity: AssessmentRiskSeverity;
  /** 本次作答命中的选项 */
  optionIds: string[];
  description: string;
}

interface AssessmentRiskRuleHitBase {
  id: string;
  /** 规则所在的风险等级 */
  severity: AssessmentRiskSeverity;
}

export interface AssessmentRiskDimensionRuleHit extends AssessmentRiskRuleHitBase {
  type: "dimension";
  dimensionId: string;
  title: string;
  score: number | null;
  /** 本次作答落入的区间等级 */
  level: string;
}

export interface AssessmentRiskScoreRuleHit extends AssessmentRiskRuleHitBase {
  type: "score";
  title: string;
  score: number;
  min: number | null;
  max: number | null;
}

export interface AssessmentRiskOptionRuleHit extends AssessmentRiskRuleHitBase {
  type: "options";
  match: "any" | "multiple";
  /** 本次作答命中的选项 */
  optionIds: string[];
  requiredCount: number;
}

export type AssessmentRiskRuleHit =
  | AssessmentRiskDimensionRuleHit
  | AssessmentRiskScoreRuleHit
  | AssessmentRiskOptionRuleHit;

/**
 * 风险判定结果：仅管理端接口返回。
 * source：rule 命中规则；fallback 未命中任何规则、按「无风险」兜底；none 未命中且不判定。
 * score / trigger 以及 triggers、score 等字段来自升级前保存的旧版结果。
 */
export interface AssessmentRiskResult {
  title: string;
  level: string;
  /** 没有命中任何规则且未设置兜底时为 null */
  severity: AssessmentRiskSeverity | null;
  source: "rule" | "fallback" | "none" | "score" | "trigger";
  description: string;
  suggestions: string[];
  /** 本次命中的全部规则（按风险从高到低） */
  matchedRules?: AssessmentRiskRuleHit[];
  triggers?: AssessmentRiskTriggerHit[];
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
