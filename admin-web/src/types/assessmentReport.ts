import type {
  AssessmentCategory,
  AssessmentDefinition,
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
  source?: AssessmentReportSource | "";
  startAt?: string;
  endAt?: string;
}

export interface PatientAssessmentReportListFilters {
  page: number;
  pageSize: number;
  source?: AssessmentReportSource | "";
}

export interface SumAssessmentScoreResult {
  type: "sum";
  totalScore: number;
  level: string;
  description: string;
  suggestions: string[];
}

export interface MatchAssessmentScoreResult {
  type: "match";
  resultId: string;
  title: string;
  description: string;
  image: string;
  shareText: string;
}

export interface DimensionAssessmentScoreItem {
  id: string;
  title: string;
  score: number;
  level: string;
  description: string;
  suggestions: string[];
}

export interface DimensionAssessmentScoreResult {
  type: "dimension";
  dimensions: DimensionAssessmentScoreItem[];
  summary?: string;
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
