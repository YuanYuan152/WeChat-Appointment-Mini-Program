export type AssessmentCategory = "professional" | "fun";
export type AssessmentVisibility = "public" | "private";

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

/** 正式题目输入类型；缺省视为 choice，兼容旧数据。 */
export type AssessmentQuestionInputType = "choice" | "text" | "number";

/**
 * 填空/数字题，或选择题选项追问的计分方式：
 * - filled：按是否填写计分（completedScore / emptyScore）
 * - value：按填写的数字本身计分（仅 number）
 */
export type AssessmentScoreMode = "filled" | "value";

export interface AssessmentQuestionValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
}

/** 选择题选中后的追问（填空或数字），可单独参与计分。 */
export interface AssessmentOptionFollowUp {
  inputType: "text" | "number";
  label?: string;
  required?: boolean;
  scoreMode: AssessmentScoreMode;
  completedScore?: number;
  emptyScore?: number;
  validation?: AssessmentQuestionValidation;
}

export interface AssessmentOption {
  id: string;
  text: string;
  value: number;
  matchTags?: Record<string, number>;
  followUp?: AssessmentOptionFollowUp;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  helpText?: string;
  required: boolean;
  /** 缺省为 choice。 */
  inputType?: AssessmentQuestionInputType;
  /** text/number 题计分方式，缺省 filled。 */
  scoreMode?: AssessmentScoreMode;
  /** scoreMode=filled 且已填写时的得分。 */
  completedScore?: number;
  /** 未填写时的得分（可选题留空），缺省 0。 */
  emptyScore?: number;
  validation?: AssessmentQuestionValidation;
  /** choice 题必填；text/number 题可为空数组。 */
  options: AssessmentOption[];
}

export interface AssessmentScoreRange {
  min: number;
  max: number;
  level: string;
  /** 面向来访结果说明；旧数据仅有 description 时由编辑器回填。 */
  visitorDescription: string;
  /** 面向分析方结果说明。 */
  analystDescription: string;
  suggestions: string[];
}

export interface AssessmentDimension {
  id: string;
  title: string;
  intro?: string;
  questionIds: string[];
  reverseQuestionIds?: string[];
  calculationMode?: "simple" | "formula";
  aggregate: "sum" | "product" | "average";
  formula?: string;
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
  visibility?: AssessmentVisibility;
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
  visibility: AssessmentVisibility;
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
