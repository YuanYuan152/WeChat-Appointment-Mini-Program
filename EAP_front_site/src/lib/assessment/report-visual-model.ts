/**
 * 测评结果可视化模型：把各类量表的计分结果统一换算成「分数 + 范围 + 区间色阶」，
 * 页面只负责绘制。自有 EAP（EAP_front_site）与定制化 EAP（zhongjian_site）共用同一份逻辑，
 * 两处文件内容保持一致（不依赖任何项目内模块，输入用结构化类型描述）。
 *
 * 支持：求和（含 PSQI）、多维度（含子维度、总分、组合量表按母量表分组）、
 * PBI（父母教养方式象限）、CBCL（界值）、暗黑人格（三维度 + 总分）、匹配（含 AAS 依恋类型象限）。
 */

export type VisualTone = "good" | "mild" | "moderate" | "severe" | "neutral";

export interface VisualRangeInput {
  min: number | null;
  max: number | null;
  level: string;
}

export interface VisualAssessmentInput {
  scoringType?: string;
  scoringPreset?: string;
  questions?: ReadonlyArray<{ id: string }>;
  scoreRanges?: ReadonlyArray<VisualRangeInput>;
  dimensions?: ReadonlyArray<{
    id: string;
    title: string;
    intro?: string;
    scoreRanges?: ReadonlyArray<VisualRangeInput>;
  }>;
  totalScore?: {
    title?: string;
    intro?: string;
    scoreRanges?: ReadonlyArray<VisualRangeInput>;
  };
  matchResults?: ReadonlyArray<{
    id: string;
    title: string;
    suggestions?: ReadonlyArray<string>;
  }>;
  composedFrom?: ReadonlyArray<{ id: string }>;
  sourceReports?: ReadonlyArray<{
    sourceId: string;
    sourceTitle: string;
    dimensions?: ReadonlyArray<{ id: string }>;
  }>;
}

interface VisualScoreItemInput {
  id?: string;
  title?: string;
  score?: number;
  level?: string;
  description?: string;
  visitorDescription?: string;
  suggestions?: ReadonlyArray<string>;
}

export interface VisualResultInput {
  type?: string;
  totalScore?: number;
  level?: string;
  description?: string;
  visitorDescription?: string;
  suggestions?: ReadonlyArray<string>;
  summary?: string;
  dimensions?: ReadonlyArray<VisualScoreItemInput>;
  total?: VisualScoreItemInput;
  resultId?: string;
  title?: string;
  image?: string;
  shareText?: string;
}

export interface VisualBand {
  min: number;
  max: number;
  level: string;
  tone: VisualTone;
}

export interface VisualMarker {
  value: number;
  label: string;
}

export interface VisualScore {
  id: string;
  title: string;
  /** 总览（雷达 / 条形）里的名称：组合量表同名维度会带上母量表名 */
  label: string;
  intro: string;
  score: number;
  min: number;
  max: number;
  /** 分数在 min..max 中的位置，0..1 */
  ratio: number;
  level: string;
  tone: VisualTone;
  bands: VisualBand[];
  markers: VisualMarker[];
  description: string;
  suggestions: string[];
  children: VisualScore[];
}

export interface VisualGroup {
  title: string;
  items: VisualScore[];
}

export interface VisualQuadrantAxis {
  label: string;
  score: number;
  min: number;
  max: number;
  /** 低于 low 视为低分 */
  low: number;
  /** 高于 high 视为高分 */
  high: number;
}

export interface VisualQuadrant {
  id: string;
  title: string;
  result: string;
  x: VisualQuadrantAxis;
  y: VisualQuadrantAxis;
  /** 四角名称：x 低/高 × y 低/高 */
  cells: { lowLow: string; highLow: string; lowHigh: string; highHigh: string };
}

export interface VisualMatchMapCell {
  id: string;
  title: string;
  /** 0 = 左（x 低），1 = 右（x 高） */
  column: 0 | 1;
  /** 0 = 下（y 低），1 = 上（y 高） */
  row: 0 | 1;
  active: boolean;
}

export interface VisualMatch {
  resultId: string;
  title: string;
  description: string;
  image: string;
  shareText: string;
  suggestions: string[];
  map?: { xLabel: string; yLabel: string; cells: VisualMatchMapCell[] };
}

export type VisualPreset = "generic" | "psqi" | "pbi" | "cbcl" | "dark-light" | "aas";

export interface ReportVisualModel {
  kind: "score" | "profile" | "match";
  preset: VisualPreset;
  /** 求和量表的得分 / 维度量表配置的总分 / 固定量表的总分维度 */
  hero: VisualScore | null;
  summary: string;
  /** 维度详情（子维度挂在父维度 children 里）；组合量表按母量表分组 */
  groups: VisualGroup[];
  /** 维度总览方式 */
  overview: "radar" | "bars" | "none";
  radar: VisualScore[];
  bars: VisualScore[];
  quadrants: VisualQuadrant[];
  match: VisualMatch | null;
}

export const TONE_COLORS: Record<VisualTone, string> = {
  good: "#3E8E68",
  mild: "#C99A1C",
  moderate: "#E07B39",
  severe: "#C8312A",
  neutral: "#6B7A90",
};

export const TONE_LABELS: Record<VisualTone, string> = {
  good: "良好",
  mild: "轻度关注",
  moderate: "需要关注",
  severe: "重点关注",
  neutral: "",
};

const EXACT_LEVEL_TONES: Record<string, VisualTone> = {
  低: "good",
  中: "mild",
  高: "moderate",
};

/** 按等级文案判断色调；先匹配否定/低风险说法，再从重到轻。 */
const TONE_KEYWORDS: ReadonlyArray<readonly [string, VisualTone]> = [
  ["无风险", "good"],
  ["低风险", "good"],
  ["无明显", "good"],
  ["未见", "good"],
  ["无异常", "good"],
  ["正常", "good"],
  ["极重", "severe"],
  ["重度", "severe"],
  ["严重", "severe"],
  ["高风险", "severe"],
  ["极高", "severe"],
  ["很差", "severe"],
  ["极差", "severe"],
  ["危机", "severe"],
  ["高危", "severe"],
  ["中重", "moderate"],
  ["中度", "moderate"],
  ["中风险", "moderate"],
  ["较差", "moderate"],
  ["偏重", "moderate"],
  ["需关注", "moderate"],
  ["需要关注", "moderate"],
  ["明显", "moderate"],
  ["轻度", "mild"],
  ["轻微", "mild"],
  ["偏高", "mild"],
  ["偏低", "mild"],
  ["一般", "mild"],
  ["临界", "mild"],
  ["可疑", "mild"],
  ["倾向", "mild"],
  ["关注", "mild"],
  ["中等", "mild"],
  ["良好", "good"],
  ["很好", "good"],
  ["较好", "good"],
  ["健康", "good"],
  ["安全", "good"],
  ["优秀", "good"],
  ["稳定", "good"],
  ["平稳", "good"],
  ["满意", "good"],
  ["尚可", "good"],
];

export function toneFromLevel(level: unknown): VisualTone | null {
  const text = String(level ?? "").replace(/\s+/g, "");
  if (!text || text === "未知") {
    return null;
  }
  if (EXACT_LEVEL_TONES[text]) {
    return EXACT_LEVEL_TONES[text];
  }
  for (const [keyword, tone] of TONE_KEYWORDS) {
    if (text.includes(keyword)) {
      return tone;
    }
  }
  return null;
}

function finite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function indexTone(index: number, total: number): VisualTone {
  if (total <= 1) {
    return "neutral";
  }
  if (total === 2) {
    return index === 0 ? "good" : "moderate";
  }
  const position = index / (total - 1);
  if (position <= 0.2) return "good";
  if (position <= 0.5) return "mild";
  if (position <= 0.8) return "moderate";
  return "severe";
}

/** 区间按分数从低到高排列；色调优先看等级文案，其次按位置由绿到红。 */
export function bandsFromRanges(
  ranges: ReadonlyArray<VisualRangeInput> | null | undefined,
): VisualBand[] {
  const valid: Array<{ min: number; max: number; level: string }> = [];
  for (const range of ranges ?? []) {
    const min = finite(range?.min);
    const max = finite(range?.max);
    if (min === null || max === null) {
      continue;
    }
    valid.push({ min: Math.min(min, max), max: Math.max(min, max), level: String(range.level ?? "") });
  }
  valid.sort((left, right) => left.min - right.min || left.max - right.max);
  return valid.map((band, index) => ({
    ...band,
    tone: toneFromLevel(band.level) ?? indexTone(index, valid.length),
  }));
}

export function bandForScore(score: number, bands: ReadonlyArray<VisualBand>): VisualBand | null {
  if (!bands.length) {
    return null;
  }
  const exact = bands.find((band) => score >= band.min && score <= band.max);
  if (exact) {
    return exact;
  }
  let candidate = bands[0];
  for (const band of bands) {
    if (band.min <= score) {
      candidate = band;
    }
  }
  return candidate;
}

export function formatVisualScore(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Math.round(value * 100) / 100);
}

interface ScoreParams {
  id: string;
  title: string;
  intro?: string;
  score: number;
  level: string;
  description?: string;
  suggestions?: ReadonlyArray<string>;
  bands: VisualBand[];
  min?: number | null;
  max?: number | null;
  markers?: VisualMarker[];
  /** 固定量表的区间色调是确定的，不再按等级文案猜 */
  presetTone?: boolean;
}

function buildScore(params: ScoreParams): VisualScore {
  const { bands, score } = params;
  const low = params.min ?? (bands.length ? bands[0].min : 0);
  let high = params.max ?? (bands.length ? bands[bands.length - 1].max : Math.max(score, 1));
  if (!(high > low)) {
    high = low + 1;
  }
  const band = bandForScore(score, bands);
  const tone = params.presetTone
    ? band?.tone ?? "neutral"
    : toneFromLevel(params.level) ?? band?.tone ?? "neutral";
  return {
    id: params.id,
    title: params.title,
    label: params.title,
    intro: params.intro?.trim() ?? "",
    score,
    min: low,
    max: high,
    ratio: Math.min(1, Math.max(0, (score - low) / (high - low))),
    level: params.level && params.level !== "未知" ? params.level : band?.level ?? "",
    tone,
    bands,
    markers: params.markers ?? [],
    description: params.description?.trim() ?? "",
    suggestions: (params.suggestions ?? []).map((item) => String(item).trim()).filter(Boolean),
    children: [],
  };
}

function itemDescription(item: VisualScoreItemInput | VisualResultInput): string {
  return String(item.visitorDescription || item.description || "").trim();
}

// ---------------------------------------------------------------------------
// 固定计分量表的分数范围、界值与区间（与后端 assessment_scoring_service 一致）
// ---------------------------------------------------------------------------

interface PresetDimension {
  min: number;
  max: number;
  bands?: VisualBand[];
  markers?: VisualMarker[];
}

const CBCL_SCALES: ReadonlyArray<readonly [string, number, number]> = [
  ["withdrawn", 9, 6],
  ["somatic", 10, 6],
  ["anxious-depressed", 14, 7],
  ["social", 8, 5],
  ["thought", 7, 2],
  ["attention", 11, 10],
  ["rule-breaking", 13, 7],
  ["aggressive", 20, 14],
];

function cutoffDimension(max: number, cutoff: number): PresetDimension {
  return {
    min: 0,
    max,
    bands: [
      { min: 0, max: cutoff, level: "正常", tone: "good" },
      { min: cutoff + 1, max, level: "需关注", tone: "moderate" },
    ],
    markers: [{ value: cutoff, label: `参考界值 ${cutoff}` }],
  };
}

function presetDimensions(
  preset: VisualPreset,
  assessment: VisualAssessmentInput,
): Record<string, PresetDimension> | null {
  if (preset === "cbcl") {
    const entries: Record<string, PresetDimension> = {};
    for (const [id, items, cutoff] of CBCL_SCALES) {
      entries[id] = cutoffDimension(items * 2, cutoff);
    }
    const questionCount = assessment.questions?.length || 119;
    entries["behavior-total"] = cutoffDimension(questionCount * 2, 37);
    return entries;
  }
  if (preset === "dark-light") {
    const trait: PresetDimension = {
      min: 4,
      max: 28,
      bands: [
        { min: 4, max: 12, level: "低", tone: "good" },
        { min: 13, max: 20, level: "中", tone: "mild" },
        { min: 21, max: 28, level: "高", tone: "moderate" },
      ],
    };
    return {
      machiavellianism: trait,
      psychopathy: trait,
      narcissism: trait,
      "dark-total": {
        min: 12,
        max: 84,
        bands: [
          { min: 12, max: 36, level: "低", tone: "good" },
          { min: 37, max: 60, level: "中", tone: "mild" },
          { min: 61, max: 84, level: "高", tone: "moderate" },
        ],
      },
    };
  }
  if (preset === "pbi") {
    const autonomy: PresetDimension = {
      min: 0,
      max: 18,
      bands: [
        { min: 0, max: 11, level: "一般", tone: "neutral" },
        { min: 12, max: 18, level: "较高", tone: "good" },
      ],
    };
    const control = (cutoffLow: number, cutoffHigh: number): PresetDimension => ({
      min: 0,
      max: 18,
      bands: [
        { min: 0, max: Math.floor(cutoffHigh), level: "一般", tone: "good" },
        { min: Math.floor(cutoffHigh) + 1, max: 18, level: "较高", tone: "mild" },
      ],
      markers: [
        { value: cutoffLow, label: `低控制界值 ${cutoffLow}` },
        { value: cutoffHigh, label: `高控制界值 ${cutoffHigh}` },
      ],
    });
    const care = (cutoffLow: number, cutoffHigh: number): PresetDimension => ({
      min: 0,
      max: 33,
      markers: [
        { value: cutoffLow, label: `低关爱界值 ${cutoffLow}` },
        { value: cutoffHigh, label: `高关爱界值 ${cutoffHigh}` },
      ],
    });
    return {
      "mother-care": care(19.12, 29.62),
      "mother-autonomy": autonomy,
      "mother-control": control(1.98, 8.64),
      "father-care": care(15.71, 27.17),
      "father-autonomy": autonomy,
      "father-control": control(1.38, 7.62),
    };
  }
  return null;
}

const PRESET_HERO_IDS: Partial<Record<VisualPreset, string>> = {
  cbcl: "behavior-total",
  "dark-light": "dark-total",
};

const PBI_CELLS = {
  lowLow: "放任型",
  highLow: "民主型",
  lowHigh: "专制型",
  highHigh: "权威型",
};

function detectPreset(assessment: VisualAssessmentInput): VisualPreset {
  const type = String(assessment.scoringType || "");
  if (type === "psqi" || type === "pbi" || type === "cbcl" || type === "dark-light" || type === "aas") {
    return type;
  }
  return "generic";
}

/** 组合量表：按母量表把维度分组（发布时维度按 sourceReports 顺序平铺，可按位置对应）。 */
function sourceGroupTitles(assessment: VisualAssessmentInput): Map<string, string> | null {
  const reports = assessment.sourceReports;
  const dimensions = assessment.dimensions;
  if (!assessment.composedFrom?.length || !reports?.length || !dimensions?.length) {
    return null;
  }
  const flattened = reports.flatMap((report) =>
    (report.dimensions ?? []).map(() => String(report.sourceTitle || "")),
  );
  if (flattened.length !== dimensions.length || new Set(flattened).size <= 1) {
    return null;
  }
  return new Map(dimensions.map((dimension, index) => [dimension.id, flattened[index]]));
}

function dimensionParentId(id: string): string | null {
  const parts = id.split(".");
  return parts.length === 2 && parts[0] && parts[1] ? parts[0] : null;
}

function buildPbiQuadrants(byId: Map<string, VisualScore>): VisualQuadrant[] {
  const quadrants: VisualQuadrant[] = [];
  const specs = [
    { id: "mother", title: "母亲教养方式", careLow: 19.12, careHigh: 29.62, controlLow: 1.98, controlHigh: 8.64 },
    { id: "father", title: "父亲教养方式", careLow: 15.71, careHigh: 27.17, controlLow: 1.38, controlHigh: 7.62 },
  ];
  for (const spec of specs) {
    const care = byId.get(`${spec.id}-care`);
    const control = byId.get(`${spec.id}-control`);
    if (!care || !control) {
      continue;
    }
    quadrants.push({
      id: spec.id,
      title: spec.title,
      result: care.level,
      x: { label: "关爱", score: care.score, min: 0, max: 33, low: spec.careLow, high: spec.careHigh },
      y: { label: "控制", score: control.score, min: 0, max: 18, low: spec.controlLow, high: spec.controlHigh },
      cells: PBI_CELLS,
    });
  }
  return quadrants;
}

const AAS_LAYOUT: ReadonlyArray<{ id: string; fallback: string; column: 0 | 1; row: 0 | 1 }> = [
  { id: "fearful", fallback: "恐惧型", column: 0, row: 1 },
  { id: "preoccupied", fallback: "专注型", column: 1, row: 1 },
  { id: "dismissive", fallback: "冷漠型", column: 0, row: 0 },
  { id: "secure", fallback: "安全型", column: 1, row: 0 },
];

function buildMatch(
  preset: VisualPreset,
  assessment: VisualAssessmentInput,
  result: VisualResultInput,
): VisualMatch {
  const resultId = String(result.resultId || "");
  const definition = assessment.matchResults?.find((item) => item.id === resultId);
  const match: VisualMatch = {
    resultId,
    title: String(result.title || definition?.title || "测评结果"),
    description: String(result.description || "").trim(),
    image: String(result.image || ""),
    shareText: String(result.shareText || "").trim(),
    suggestions: (definition?.suggestions ?? []).map((item) => String(item).trim()).filter(Boolean),
  };
  if (preset === "aas") {
    match.map = {
      xLabel: "亲近与依赖",
      yLabel: "关系焦虑",
      cells: AAS_LAYOUT.map((cell) => ({
        id: cell.id,
        title: assessment.matchResults?.find((item) => item.id === cell.id)?.title || cell.fallback,
        column: cell.column,
        row: cell.row,
        active: cell.id === resultId,
      })),
    };
  }
  return match;
}

export function buildReportVisualModel(
  assessment: VisualAssessmentInput,
  result: VisualResultInput,
): ReportVisualModel {
  const preset = detectPreset(assessment);
  const empty: ReportVisualModel = {
    kind: "profile",
    preset,
    hero: null,
    summary: String(result.summary || "").trim(),
    groups: [],
    overview: "none",
    radar: [],
    bars: [],
    quadrants: [],
    match: null,
  };

  if (result.type === "match") {
    return { ...empty, kind: "match", match: buildMatch(preset, assessment, result) };
  }

  if (result.type === "sum") {
    const score = finite(result.totalScore) ?? 0;
    const bands = bandsFromRanges(assessment.scoreRanges);
    return {
      ...empty,
      kind: "score",
      hero: buildScore({
        id: "total",
        title: "测评得分",
        score,
        level: String(result.level || ""),
        description: itemDescription(result),
        suggestions: result.suggestions,
        bands,
        max: bands.length ? null : preset === "psqi" ? 18 : null,
      }),
    };
  }

  if (result.type !== "dimension" || !Array.isArray(result.dimensions)) {
    return empty;
  }

  const presetMeta = presetDimensions(preset, assessment);
  const definitions = new Map((assessment.dimensions ?? []).map((item) => [item.id, item]));
  const scores: VisualScore[] = [];
  for (const [index, raw] of result.dimensions.entries()) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const id = String(raw.id || `dimension-${index + 1}`);
    const definition = definitions.get(id);
    const meta = presetMeta?.[id];
    const bands = meta ? meta.bands ?? [] : bandsFromRanges(definition?.scoreRanges);
    scores.push(
      buildScore({
        id,
        title: String(raw.title || definition?.title || `维度 ${index + 1}`),
        intro: definition?.intro,
        score: finite(raw.score) ?? 0,
        level: String(raw.level || ""),
        description: itemDescription(raw),
        suggestions: raw.suggestions,
        bands,
        min: meta?.min ?? null,
        max: meta?.max ?? null,
        markers: meta?.markers,
        presetTone: Boolean(meta),
      }),
    );
  }

  let hero: VisualScore | null = null;
  if (result.total && typeof result.total === "object") {
    hero = buildScore({
      id: "total",
      title: String(result.total.title || assessment.totalScore?.title || "总分"),
      intro: assessment.totalScore?.intro,
      score: finite(result.total.score) ?? 0,
      level: String(result.total.level || ""),
      description: itemDescription(result.total),
      suggestions: result.total.suggestions,
      bands: bandsFromRanges(assessment.totalScore?.scoreRanges),
    });
  }
  const presetHeroId = PRESET_HERO_IDS[preset];
  let remaining = scores;
  if (!hero && presetHeroId) {
    const found = scores.find((item) => item.id === presetHeroId);
    if (found) {
      hero = found;
      remaining = scores.filter((item) => item !== found);
    }
  }

  // 子维度（父维度ID.子维度ID）挂到父维度下面
  const byId = new Map(remaining.map((item) => [item.id, item]));
  const topLevel: VisualScore[] = [];
  for (const item of remaining) {
    const parentId = dimensionParentId(item.id);
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent && parent !== item) {
      parent.children.push(item);
    } else {
      topLevel.push(item);
    }
  }

  const groupTitles = sourceGroupTitles(assessment);
  const groups: VisualGroup[] = [];
  if (groupTitles) {
    // 组合量表里常见多个母量表都叫「总分」：总览里带上母量表名以免混淆
    const titleCounts = new Map<string, number>();
    for (const item of topLevel) {
      titleCounts.set(item.title, (titleCounts.get(item.title) ?? 0) + 1);
    }
    for (const item of topLevel) {
      const groupTitle = groupTitles.get(item.id);
      if (groupTitle && (titleCounts.get(item.title) ?? 0) > 1) {
        item.label = `${groupTitle} · ${item.title}`;
      }
    }
    for (const item of topLevel) {
      const title = groupTitles.get(item.id) ?? "";
      const last = groups[groups.length - 1];
      if (last && last.title === title) {
        last.items.push(item);
      } else {
        groups.push({ title, items: [item] });
      }
    }
  } else if (topLevel.length) {
    groups.push({ title: "", items: topLevel });
  }

  const radarCandidates = topLevel.filter((item) => !item.id.endsWith("-total"));
  let overview: ReportVisualModel["overview"] = "none";
  if (preset === "cbcl") {
    overview = "bars";
  } else if (preset === "pbi") {
    overview = "none";
  } else if (radarCandidates.length >= 3 && radarCandidates.length <= 12) {
    overview = "radar";
  } else if (topLevel.length >= 2) {
    overview = "bars";
  }

  return {
    ...empty,
    kind: "profile",
    hero,
    groups,
    overview,
    radar: overview === "radar" ? radarCandidates : [],
    bars: overview === "bars" ? topLevel : [],
    quadrants: preset === "pbi" ? buildPbiQuadrants(new Map(scores.map((item) => [item.id, item]))) : [],
  };
}

/** 汇总全部维度的建议（去重），供「建议」板块使用。 */
export function collectVisualSuggestions(model: ReportVisualModel, limit = 6): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  const push = (items: ReadonlyArray<string>) => {
    for (const item of items) {
      const text = item.trim();
      if (text && !seen.has(text) && output.length < limit) {
        seen.add(text);
        output.push(text);
      }
    }
  };
  if (model.hero) {
    push(model.hero.suggestions);
  }
  if (model.match) {
    push(model.match.suggestions);
  }
  const visit = (items: ReadonlyArray<VisualScore>) => {
    for (const item of items) {
      push(item.suggestions);
      visit(item.children);
    }
  };
  for (const group of model.groups) {
    visit(group.items);
  }
  return output;
}
