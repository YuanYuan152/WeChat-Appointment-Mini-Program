export type AssessmentCategory = "professional" | "fun";

export type AssessmentDefinitionStatus = "draft" | "published" | "archived";

export type AssessmentLifecycleStatus = AssessmentDefinitionStatus;

export type AssessmentScoringType =
  | "sum"
  | "dimension"
  | "match"
  | "aas"
  | "psqi"
  | "pbi"
  | "cbcl"
  | "dark-light";

export type AssessmentScoringPreset =
  | "generic-sum-v1"
  | "generic-sum-v2"
  | "generic-dimension-v1"
  | "generic-match-v1"
  | "aas-v1"
  | "psqi-v1"
  | "pbi-v1"
  | "cbcl-v1"
  | "dark-light-v1";

export type AssessmentDemographicInputType =
  | "single"
  | "multiple"
  | "text"
  | "number"
  | "date";

export type AssessmentDemographicValue = string | number | boolean;

export interface AssessmentDemographicOption {
  id: string;
  text: string;
  value: AssessmentDemographicValue;
}

export interface AssessmentDemographicValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface AssessmentDemographicQuestion {
  id: string;
  text: string;
  helpText?: string;
  inputType: AssessmentDemographicInputType;
  required: boolean;
  options?: AssessmentDemographicOption[];
  validation?: AssessmentDemographicValidation;
}

export interface AssessmentOption {
  id: string;
  text: string;
  value: number;
  matchTags?: Record<string, number>;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  helpText?: string;
  required: boolean;
  options: AssessmentOption[];
}

export interface AssessmentScoreRange {
  min: number;
  max: number;
  level: string;
  description: string;
  suggestions: string[];
}

export interface AssessmentDimension {
  id: string;
  title: string;
  intro?: string;
  questionIds: string[];
  reverseQuestionIds?: string[];
  aggregate: "sum" | "average";
  scoreRanges: AssessmentScoreRange[];
}

export interface AssessmentMatchResult {
  id: string;
  title: string;
  description: string;
  suggestions?: string[];
  image: string;
  shareText: string;
}

export interface AssessmentReportProfile {
  id: string;
  title: string;
  description: string;
  suggestions: string[];
  image?: string;
  shareText?: string;
}

/**
 * EAP 量表 JSON 协议 v1。
 *
 * 管理端编辑时始终保留完整对象，避免结构化表单覆盖固定计分量表中的字段。
 */
export interface AssessmentDefinition {
  schemaVersion: 1;
  id: string;
  version: number;
  status: AssessmentDefinitionStatus;
  category: AssessmentCategory;
  title: string;
  subtitle: string;
  description: string;
  instructions?: string;
  features?: string;
  cover: string;
  duration: number;
  sortOrder?: number;
  demographicQuestions?: AssessmentDemographicQuestion[];
  scoringType: AssessmentScoringType;
  scoringPreset: AssessmentScoringPreset;
  questions: AssessmentQuestion[];
  scoreRanges?: AssessmentScoreRange[];
  dimensions?: AssessmentDimension[];
  reverseQuestionIds?: string[];
  matchResults?: AssessmentMatchResult[];
  reportIntro?: string;
  reportProfiles?: AssessmentReportProfile[];
  disclaimer: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
}

export interface AssessmentVersionSummary {
  version: number;
  status: AssessmentDefinitionStatus;
  publishedAt: string | null;
  revision: string;
}

export interface AssessmentListItem {
  id: string;
  category: AssessmentCategory;
  title: string;
  status: AssessmentLifecycleStatus;
  sortOrder: number;
  publishedVersion: number | null;
  draftVersion: number | null;
  draftRevision: string | null;
  updatedAt: string;
  archivedAt: string | null;
  version: number;
  subtitle: string;
  description: string;
  cover: string;
  questionCount: number;
  duration: number;
  scoringType: AssessmentScoringType;
  completedCount: number;
  scanCount: number;
}

export interface AssessmentListResponse {
  items: AssessmentListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AssessmentAdminDetail {
  definition: AssessmentDefinition;
  revision: string;
  lifecycleStatus: AssessmentLifecycleStatus;
  publishedVersion: number | null;
  draftVersion: number | null;
  versions: AssessmentVersionSummary[];
}

export interface AssessmentListFilters {
  page: number;
  pageSize: number;
  category?: AssessmentCategory | "";
  status?: AssessmentLifecycleStatus | "";
  keyword?: string;
}

export interface AssessmentValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}
