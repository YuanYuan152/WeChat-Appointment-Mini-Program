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

/** 选择题的一个作答：选项 ID，或带追问时的 { optionId, followUp }。 */
export type AssessmentChoiceAnswer = string | { optionId: string; followUp?: string | number };

/** 正式题目的作答：单选 / 多选（数组）/ 填空 / 数字。 */
export type AssessmentAnswerValue =
  | AssessmentChoiceAnswer
  | AssessmentChoiceAnswer[]
  | { text: string }
  | { number: number };

/** 题内计分方式：所选选项分值相加，或按公式计算。 */
export type AssessmentInnerScoringMode = "sum" | "formula";

/**
 * 多选题的题内计分，本题得分即计算结果（参与总分、维度等）。
 * 公式只能引用本题选项 ID：选中取该选项分值（含追问得分），未选中按 0 计算。
 */
export interface AssessmentInnerScoring {
  mode: AssessmentInnerScoringMode;
  formula?: string;
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
  /** 仅 choice：为 true 时多选，作答为所选选项列表；缺省单选。 */
  multiple?: boolean;
  /** 仅多选题：开启题内计分；未开启时多选题不计分（0 分）。 */
  innerScoring?: AssessmentInnerScoring;
  /** 组合量表记录题目来自哪份母量表，供批量删除时提示。 */
  sourceAssessmentId?: string;
  sourceAssessmentTitle?: string;
  sourceQuestionId?: string;
}

export interface AssessmentCompositionSource {
  id: string;
  title: string;
}

export interface AssessmentSourceReport {
  sourceId: string;
  sourceTitle: string;
  scoringType: AssessmentScoringType;
  scoringPreset: AssessmentScoringPreset;
  questionIds: string[];
  dimensions?: AssessmentDimension[];
  scoreRanges?: AssessmentScoreRange[];
  reverseQuestionIds?: string[];
  matchResults?: AssessmentMatchResult[];
  reportProfiles?: AssessmentReportProfile[];
}

export interface AssessmentScoreRange {
  /** 删题后可暂为空，发布前必须补回数字。 */
  min: number | null;
  /** 删题后可暂为空，发布前必须补回数字。 */
  max: number | null;
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
  aggregate: AssessmentAggregate;
  formula?: string;
  scoreRanges: AssessmentScoreRange[];
}

export type AssessmentAggregate = "sum" | "product" | "average";

/** 「选题 + 计算方式」：维度、总分、风险计分共用的计算块。 */
export interface AssessmentScoreCalculation {
  questionIds: string[];
  reverseQuestionIds?: string[];
  calculationMode?: "simple" | "formula";
  aggregate: AssessmentAggregate;
  formula?: string;
}

/** 多维度量表的总分：来访端结果页会展示。 */
export interface AssessmentTotalScore extends AssessmentScoreCalculation {
  title: string;
  intro?: string;
  scoreRanges: AssessmentScoreRange[];
}

/** 风险分级，与企业定制数据管理的风险等级一致。 */
export type AssessmentRiskSeverity = "high" | "mid" | "watch" | "ok";

/**
 * A. 维度区间：已编辑的维度（或总分，ID 为 `__total__`）结果落在所选区间时命中。
 * 区间按等级名称引用，调整区间分数边界不影响规则。
 */
export interface AssessmentRiskDimensionRule {
  id: string;
  type: "dimension";
  dimensionId: string;
  levels: string[];
}

/** B. 新增计分：单独设置一套「选题 + 计算方式」，得分落在 [min, max] 时命中；null 表示该端不限。 */
export interface AssessmentRiskScoreRule extends AssessmentScoreCalculation {
  id: string;
  type: "score";
  title: string;
  min: number | null;
  max: number | null;
}

/** 选项触发方式：任意一项被选即触发，或多项同时被选才触发。 */
export type AssessmentRiskOptionMatch = "any" | "multiple";

/** C. 选项触发。multiple 时至少同时选中 minCount 项；不设置 minCount 表示所选选项必须全部被选。 */
export interface AssessmentRiskOptionRule {
  id: string;
  type: "options";
  match: AssessmentRiskOptionMatch;
  optionIds: string[];
  minCount?: number;
}

export type AssessmentRiskRule =
  | AssessmentRiskDimensionRule
  | AssessmentRiskScoreRule
  | AssessmentRiskOptionRule;

export type AssessmentRiskRuleType = AssessmentRiskRule["type"];

export interface AssessmentRiskLevel {
  /** 任意一条规则命中即命中该等级 */
  rules: AssessmentRiskRule[];
  analystDescription?: string;
  suggestions?: string[];
  /** 兼容旧定义的「其余判为无风险」开关。 */
  fallback?: boolean;
}

/**
 * 风险编辑：只在管理端显示和使用，来访端接口会剥离，来访者看不到。
 * 高风险 / 中风险 / 一般关注 / 无风险各自配置规则，都可以不配置；
 * 多个等级同时命中时取风险最高的一级。
 */
export interface AssessmentRiskDimension {
  title: string;
  intro?: string;
  levels: Partial<Record<AssessmentRiskSeverity, AssessmentRiskLevel>>;
}

/** 旧版风险维度（一套计分区间 + 选项触发），载入时会升级为按等级配置的规则。 */
export interface LegacyAssessmentRiskDimension {
  title?: string;
  intro?: string;
  scoring?: AssessmentScoreCalculation & {
    scoreRanges?: Array<{
      min: number | null;
      max: number | null;
      level?: string;
      severity?: string;
      analystDescription?: string;
      suggestions?: string[];
    }>;
  };
  triggers?: Array<{
    id?: string;
    level?: string;
    severity?: string;
    optionIds?: string[];
    analystDescription?: string;
    suggestions?: string[];
  }>;
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
  /** 非空表示这份量表由母量表复制组合而来。 */
  composedFrom?: AssessmentCompositionSource[];
  /** 组合量表按母量表拼接的报告结构，供报告结果页编辑。 */
  sourceReports?: AssessmentSourceReport[];
  /** 维度计分量表的总分（可选），来访端结果页展示。 */
  totalScore?: AssessmentTotalScore;
  /** 风险编辑（可选），仅管理端可见。 */
  riskDimension?: AssessmentRiskDimension;
  /** 按人口学信息切换的计分 / 风险方案（可选），仅管理端可见。 */
  scoringVariants?: AssessmentScoringVariant[];
}

/** 方案适用条件：所填人口学题的答案包含其中任一选项即满足。 */
export interface AssessmentScoringVariantCondition {
  /** 单选或多选人口学题 ID */
  questionId: string;
  /** 人口学题选项 ID */
  optionIds: string[];
}

/** 方案“计分”部分：设置后整体替换默认方案的这些报告结果字段。 */
export type AssessmentScoringVariantScoring = Partial<
  Pick<
    AssessmentDefinition,
    | "scoreRanges"
    | "reverseQuestionIds"
    | "dimensions"
    | "totalScore"
    | "matchResults"
    | "sourceReports"
  >
>;

/**
 * 人口学计分方案：条件全部满足时使用。未设置 scoring / riskDimension 的部分沿用默认方案；
 * 多个方案都满足时按列表顺序使用第一个，都不满足时使用默认方案。
 */
export interface AssessmentScoringVariant {
  id: string;
  title: string;
  conditions: AssessmentScoringVariantCondition[];
  scoring?: AssessmentScoringVariantScoring;
  riskDimension?: AssessmentRiskDimension;
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
  composedFrom?: AssessmentCompositionSource[];
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
  origin?: "parent" | "composed";
}

export interface AssessmentValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}
