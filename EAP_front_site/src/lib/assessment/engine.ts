import type {
  Assessment,
  AssessmentScoreResult,
  AssessmentOption,
  DimensionDefinition,
  ScoreRange,
} from "@/lib/api/types";

export function calculateScore(
  assessment: Assessment,
  answers: Record<string, string>
): AssessmentScoreResult {
  switch (assessment.scoringType) {
    case "match":
      return calculateMatchScore(assessment, answers);
    case "dimension":
      return calculateDimensionScore(assessment, answers);
    case "aas":
      return calculateAasScore(assessment, answers);
    case "psqi":
      return calculatePsqiScore(assessment, answers);
    case "pbi":
      return calculatePbiScore(assessment, answers);
    case "cbcl":
      return calculateCbclScore(assessment, answers);
    case "dark-light":
      return calculateDarkLightScore(assessment, answers);
    default:
      return calculateSumScore(assessment, answers);
  }
}

function getOptionValue(
  assessment: Assessment,
  answers: Record<string, string>,
  questionId: string,
  reverseQuestionIds: string[] = []
): number {
  const question = assessment.questions.find((q) => q.id === questionId);
  if (!question) return 0;
  const option = question.options.find((o) => o.id === answers[questionId]);
  if (!option) return 0;
  if (reverseQuestionIds.includes(questionId)) {
    const max = Math.max(...question.options.map((o) => o.value));
    const min = Math.min(...question.options.map((o) => o.value));
    return max + min - option.value;
  }
  return option.value;
}

function findRange(score: number, ranges?: ScoreRange[]) {
  return ranges?.find((r) => score >= r.min && score <= r.max);
}

function calculateSumScore(
  assessment: Assessment,
  answers: Record<string, string>
): AssessmentScoreResult {
  let totalScore = 0;

  for (const question of assessment.questions) {
    const selectedOptionId = answers[question.id];
    const option = question.options.find((o) => o.id === selectedOptionId);
    if (option) {
      totalScore += option.value;
    }
  }

  const range = findRange(totalScore, assessment.scoreRanges);

  return {
    type: "sum",
    totalScore,
    level: range?.level ?? "未知",
    description: range?.description ?? "暂无解读",
    suggestions: range?.suggestions ?? [],
  };
}

function scoreDimension(
  assessment: Assessment,
  answers: Record<string, string>,
  dimension: DimensionDefinition
) {
  const reverseIds = dimension.reverseQuestionIds ?? [];
  const values = dimension.questionIds.map((qid) =>
    getOptionValue(assessment, answers, qid, reverseIds)
  );
  const score =
    dimension.aggregate === "average"
      ? values.reduce((a, b) => a + b, 0) / values.length
      : values.reduce((a, b) => a + b, 0);
  const rounded = Math.round(score * 100) / 100;
  const range = findRange(rounded, dimension.scoreRanges);
  return {
    id: dimension.id,
    title: dimension.title,
    score: rounded,
    level: range?.level ?? "未知",
    description: range?.description ?? "暂无解读",
    suggestions: range?.suggestions ?? [],
  };
}

function calculateDimensionScore(
  assessment: Assessment,
  answers: Record<string, string>
): AssessmentScoreResult {
  const dimensions = (assessment.dimensions ?? []).map((dim) =>
    scoreDimension(assessment, answers, dim)
  );
  return { type: "dimension", dimensions };
}

function calculateMatchScore(
  assessment: Assessment,
  answers: Record<string, string>
): AssessmentScoreResult {
  const tagScores: Record<string, number> = {};

  for (const question of assessment.questions) {
    const selectedOptionId = answers[question.id];
    const option = question.options.find((o) => o.id === selectedOptionId);
    if (option?.matchTags) {
      for (const [tag, weight] of Object.entries(option.matchTags)) {
        tagScores[tag] = (tagScores[tag] ?? 0) + weight;
      }
    }
  }

  const topTag = Object.entries(tagScores).sort((a, b) => b[1] - a[1])[0];
  const resultId = topTag?.[0] ?? assessment.matchResults?.[0]?.id ?? "";
  const matchResult = assessment.matchResults?.find((r) => r.id === resultId);

  return {
    type: "match",
    resultId,
    title: matchResult?.title ?? "未知结果",
    description: matchResult?.description ?? "",
    image: matchResult?.image ?? "",
    shareText: matchResult?.shareText ?? "",
  };
}

function calculateAasScore(
  assessment: Assessment,
  answers: Record<string, string>
): AssessmentScoreResult {
  const reverse = assessment.reverseQuestionIds ?? [];
  const avg = (ids: string[]) => {
    const sum = ids.reduce(
      (acc, id) => acc + getOptionValue(assessment, answers, id, reverse),
      0
    );
    return sum / ids.length;
  };

  const proximity = avg(["q1", "q6", "q8", "q12", "q13", "q17"]);
  const dependency = avg(["q2", "q5", "q7", "q14", "q16", "q18"]);
  const anxiety = avg(["q3", "q4", "q9", "q10", "q11", "q15"]);
  const closeness = (proximity + dependency) / 2;

  let resultId = "fearful";
  if (closeness > 3 && anxiety < 3) resultId = "secure";
  else if (closeness > 3 && anxiety >= 3) resultId = "preoccupied";
  else if (closeness <= 3 && anxiety < 3) resultId = "dismissive";

  const matchResult = assessment.matchResults?.find((r) => r.id === resultId);

  return {
    type: "match",
    resultId,
    title: matchResult?.title ?? "未知结果",
    description: matchResult?.description ?? "",
    image: matchResult?.image ?? "",
    shareText: matchResult?.shareText ?? "",
  };
}

function calculatePsqiScore(
  assessment: Assessment,
  answers: Record<string, string>
): AssessmentScoreResult {
  const val = (id: string) => getOptionValue(assessment, answers, id);

  const component1 = val("q6");
  const latencySum = val("q2") + val("q5a");
  const component2 =
    latencySum === 0 ? 0 : latencySum <= 2 ? 1 : latencySum <= 4 ? 2 : 3;
  const component3 = val("q4");
  const disturbanceSum = ["q5b", "q5c", "q5d", "q5e", "q5f", "q5g", "q5h", "q5i", "q5j"].reduce(
    (acc, id) => acc + val(id),
    0
  );
  const component5 =
    disturbanceSum === 0 ? 0 : disturbanceSum <= 9 ? 1 : disturbanceSum <= 18 ? 2 : 3;
  const component6 = val("q7");
  const dysfunctionSum = val("q8") + val("q9");
  const component7 =
    dysfunctionSum === 0 ? 0 : dysfunctionSum <= 2 ? 1 : dysfunctionSum <= 4 ? 2 : 3;

  const totalScore = component1 + component2 + component3 + component5 + component6 + component7;
  const range = findRange(totalScore, assessment.scoreRanges);

  return {
    type: "sum",
    totalScore,
    level: range?.level ?? "未知",
    description: range?.description ?? "暂无解读",
    suggestions: range?.suggestions ?? [],
  };
}

function sumQuestions(
  assessment: Assessment,
  answers: Record<string, string>,
  ids: string[],
  reverseIds: string[] = []
) {
  return ids.reduce((acc, id) => acc + getOptionValue(assessment, answers, id, reverseIds), 0);
}

function pbiStyle(care: number, control: number, isMother: boolean) {
  const careHigh = isMother ? care > 29.62 : care > 27.17;
  const careLow = isMother ? care < 19.12 : care < 15.71;
  const controlHigh = isMother ? control > 8.64 : control > 7.62;
  const controlLow = isMother ? control < 1.98 : control < 1.38;

  if (careHigh && controlHigh) return "权威型";
  if (careLow && controlHigh) return "专制型";
  if (careHigh && controlLow) return "民主型";
  return "放任型";
}

const PBI_STYLE_DESC: Record<string, string> = {
  权威型:
    "高关爱、高控制：您在有明确规则和期望的环境中成长，既感受到情感支持，也明白界限与责任。",
  专制型:
    "低关爱、高控制：您可能感受到较多限制和较少的情感交流，需求与感受未得到充分理解。",
  民主型:
    "高关爱、低控制：您在充满爱与自由的环境中成长，被鼓励表达想法并自主做决定。",
  放任型:
    "低关爱、低控制：您获得很多自由，但可能缺乏必要的指导与支持，有时感到迷茫或缺乏安全感。",
};

function calculatePbiScore(
  assessment: Assessment,
  answers: Record<string, string>
): AssessmentScoreResult {
  const motherCare = sumQuestions(
    assessment,
    answers,
    ["m1", "m2", "m4", "m5", "m6", "m11", "m12", "m14", "m15", "m16", "m22"],
    ["m2", "m4", "m14", "m16", "m22"]
  );
  const motherAutonomy = sumQuestions(
    assessment,
    answers,
    ["m3", "m7", "m13", "m19", "m20", "m23"]
  );
  const motherControl = sumQuestions(
    assessment,
    answers,
    ["m8", "m9", "m10", "m17", "m18", "m21"],
    ["m18"]
  );

  const fatherCare = sumQuestions(
    assessment,
    answers,
    ["f1", "f2", "f4", "f5", "f6", "f11", "f12", "f13", "f15", "f16", "f22"],
    ["f2", "f4", "f22"]
  );
  const fatherAutonomy = sumQuestions(
    assessment,
    answers,
    ["f3", "f7", "f14", "f19", "f20", "f23"]
  );
  const fatherControl = sumQuestions(
    assessment,
    answers,
    ["f8", "f9", "f10", "f17", "f18", "f21"],
    ["f18"]
  );

  const motherStyle = pbiStyle(motherCare, motherControl, true);
  const fatherStyle = pbiStyle(fatherCare, fatherControl, false);

  return {
    type: "dimension",
    summary: `母亲教养方式：${motherStyle}；父亲教养方式：${fatherStyle}`,
    dimensions: [
      {
        id: "mother-care",
        title: "母亲关爱",
        score: motherCare,
        level: motherStyle,
        description: PBI_STYLE_DESC[motherStyle],
        suggestions: ["理解过往经历对现在的影响", "必要时寻求心理咨询支持"],
      },
      {
        id: "mother-autonomy",
        title: "母亲鼓励自主",
        score: motherAutonomy,
        level: motherAutonomy >= 12 ? "较高" : "一般",
        description:
          motherAutonomy >= 12
            ? "母亲较支持您独立探索和做决定，有助于培养自主性。"
            : "母亲对您自主性的支持相对有限，可能影响独立决策能力的发展。",
        suggestions: ["练习独立做决定", "在安全范围内尝试新的自主体验"],
      },
      {
        id: "mother-control",
        title: "母亲控制",
        score: motherControl,
        level: motherControl > 8.64 ? "较高" : "一般",
        description:
          motherControl > 8.64
            ? "母亲可能对您的生活干涉较多，您可能感到缺乏自我决定的空间。"
            : "母亲给予您较多自由与选择权，有助于自我管理能力的发展。",
        suggestions: ["觉察控制模式对当前关系的影响", "学习设定健康边界"],
      },
      {
        id: "father-care",
        title: "父亲关爱",
        score: fatherCare,
        level: fatherStyle,
        description: PBI_STYLE_DESC[fatherStyle],
        suggestions: ["理解过往经历对现在的影响", "必要时寻求心理咨询支持"],
      },
      {
        id: "father-autonomy",
        title: "父亲鼓励自主",
        score: fatherAutonomy,
        level: fatherAutonomy >= 12 ? "较高" : "一般",
        description:
          fatherAutonomy >= 12
            ? "父亲较支持您独立探索和做决定。"
            : "父亲对您自主性的支持相对有限。",
        suggestions: ["练习独立做决定", "在安全范围内尝试新的自主体验"],
      },
      {
        id: "father-control",
        title: "父亲控制",
        score: fatherControl,
        level: fatherControl > 7.62 ? "较高" : "一般",
        description:
          fatherControl > 7.62
            ? "父亲可能对您的生活干涉较多。"
            : "父亲给予您较多自由与选择权。",
        suggestions: ["觉察控制模式对当前关系的影响", "学习设定健康边界"],
      },
    ],
  };
}

const CBCL_DIMS: { id: string; title: string; items: number[]; cutoff: number }[] = [
  { id: "withdrawn", title: "退缩", items: [42, 65, 69, 75, 80, 88, 102, 103, 111], cutoff: 6 },
  { id: "somatic", title: "躯体主诉", items: [51, 54, 56, 57, 58, 59, 60, 61, 62, 63], cutoff: 6 },
  {
    id: "anxious-depressed",
    title: "焦虑/抑郁",
    items: [12, 14, 31, 32, 33, 34, 35, 45, 50, 52, 71, 89, 103, 112],
    cutoff: 7,
  },
  { id: "social", title: "社交问题", items: [1, 11, 25, 38, 48, 55, 62, 64], cutoff: 5 },
  { id: "thought", title: "思维问题", items: [9, 40, 66, 70, 80, 84, 85], cutoff: 2 },
  { id: "attention", title: "注意问题", items: [1, 8, 10, 13, 17, 41, 45, 46, 61, 62, 80], cutoff: 10 },
  {
    id: "rule-breaking",
    title: "违纪问题",
    items: [26, 39, 43, 63, 67, 72, 81, 82, 90, 96, 101, 105, 106],
    cutoff: 7,
  },
  {
    id: "aggressive",
    title: "攻击性行为",
    items: [3, 7, 16, 19, 20, 21, 22, 23, 27, 37, 59, 68, 74, 86, 87, 93, 94, 95, 97, 104],
    cutoff: 14,
  },
];

const CBCL_ABOVE =
  "得分高于参考界值，儿童可能存在该方面的问题，建议关注并必要时寻求专业评估。";
const CBCL_BELOW = "得分处于参考范围内，该方面暂未发现明显问题。";

function calculateCbclScore(
  assessment: Assessment,
  answers: Record<string, string>
): AssessmentScoreResult {
  const itemScore = (num: number) => getOptionValue(assessment, answers, `q${num}`);

  const dimensions = CBCL_DIMS.map((dim) => {
    const score = dim.items.reduce((acc, n) => acc + itemScore(n), 0);
    const above = score > dim.cutoff;
    return {
      id: dim.id,
      title: dim.title,
      score,
      level: above ? "需关注" : "正常",
      description: above ? CBCL_ABOVE : CBCL_BELOW,
      suggestions: above
        ? ["加强与孩子沟通", "必要时咨询儿童心理专业人士", "与学校老师保持联系"]
        : ["继续保持良好的亲子互动"],
    };
  });

  const behaviorTotal = assessment.questions.reduce(
    (acc, q) => acc + getOptionValue(assessment, answers, q.id),
    0
  );
  const totalAbove = behaviorTotal > 37;

  return {
    type: "dimension",
    summary: `行为问题总分：${behaviorTotal}（参考界值 37）`,
    dimensions: [
      ...dimensions,
      {
        id: "behavior-total",
        title: "行为问题总分",
        score: behaviorTotal,
        level: totalAbove ? "需关注" : "正常",
        description: totalAbove ? CBCL_ABOVE : CBCL_BELOW,
        suggestions: totalAbove
          ? ["加强沟通交流", "必要时向专业人士寻求帮助"]
          : ["继续关注孩子的日常表现"],
      },
    ],
  };
}

function darkLightLevel(score: number, lowMax: number, midMax: number) {
  if (score <= lowMax) return "低";
  if (score <= midMax) return "中";
  return "高";
}

function calculateDarkLightScore(
  assessment: Assessment,
  answers: Record<string, string>
): AssessmentScoreResult {
  const darkGroups = [
    { id: "machiavellianism", title: "马基雅维利主义（TA）", items: ["d1", "d2", "d3", "d4"] },
    { id: "psychopathy", title: "精神病态（TA）", items: ["d5", "d6", "d7", "d8"] },
    { id: "narcissism", title: "自恋（TA）", items: ["d9", "d10", "d11", "d12"] },
  ];

  const darkDims = darkGroups.map((g) => {
    const score = g.items.reduce(
      (acc, id) => acc + getOptionValue(assessment, answers, id),
      0
    );
    const level = darkLightLevel(score, 12, 20);
    const desc =
      level === "低"
        ? "TA 在该维度倾向较低，互动中通常较为真诚可靠。"
        : level === "中"
          ? "TA 在该维度有一定倾向，建议保持适度界限与明确沟通。"
          : "TA 在该维度倾向较高，需注意保护自身情绪与利益边界。";
    return {
      id: g.id,
      title: g.title,
      score,
      level,
      description: desc,
      suggestions: ["本结果仅供娱乐参考", "如有困扰请寻求专业帮助"],
    };
  });

  const darkTotal = darkDims.reduce((acc, d) => acc + d.score, 0);
  const kantScore = ["l1", "l2", "l3", "l4"].reduce(
    (acc, id) => acc + getOptionValue(assessment, answers, id),
    0
  );
  const humanScore = ["l5", "l6", "l7", "l8", "l9", "l10", "l11"].reduce(
    (acc, id) => acc + getOptionValue(assessment, answers, id),
    0
  );
  const lightTotal = kantScore + humanScore;

  const kantLevel = darkLightLevel(kantScore, 9, 19);
  const humanLevel = darkLightLevel(humanScore, 17, 34);
  const lightLevel = darkLightLevel(lightTotal, 29, 59);

  return {
    type: "dimension",
    summary: `TA 黑暗人格总分：${darkTotal}（3-84）；您的光明人格总分：${lightTotal}（11-77）`,
    dimensions: [
      ...darkDims,
      {
        id: "dark-total",
        title: "TA 黑暗人格总分",
        score: darkTotal,
        level: darkLightLevel(darkTotal, 36, 60),
        description:
          darkTotal <= 36
            ? "TA 在三个维度上的倾向均不显著，互动中通常表现出诚意与可靠性。"
            : darkTotal <= 60
              ? "TA 可能在部分情境中表现出策略性、低情感参与或自我聚焦的行为，需保持界限。"
              : "TA 在多个维度上得分较高，需尤其注意维护自身情绪与利益边界。",
        suggestions: ["结果仅供娱乐", "如有困扰请寻求他人帮助"],
      },
      {
        id: "kantianism",
        title: "康德主义（您）",
        score: kantScore,
        level: kantLevel,
        description:
          kantLevel === "高"
            ? "您待人真诚，倾向于将他人视作目的而非手段。"
            : kantLevel === "中"
              ? "您大多数时候能兼顾自身与他人，在真诚与务实间寻求平衡。"
              : "您面对事情时可能更优先考虑如何高效达成目的。",
        suggestions: [],
      },
      {
        id: "humanism",
        title: "人道主义（您）",
        score: humanScore,
        level: humanLevel,
        description:
          humanLevel === "高"
            ? "您常表现出对他人价值的认可与尊重，愿意倾听与欣赏他人。"
            : humanLevel === "中"
              ? "您的认可与尊重往往需要时间与互动来建立，本质上是基于信任的选择。"
              : "您对人有较高要求，不轻易用认可回应他人，体现对互动质量的重视。",
        suggestions: [],
      },
      {
        id: "light-total",
        title: "光明人格总分（您）",
        score: lightTotal,
        level: lightLevel,
        description:
          lightLevel === "高"
            ? "您的光明人格特质十分突出，在待人处事上真诚且尊重他人。"
            : lightLevel === "中"
              ? "您的光明人格呈现平衡且务实的特点，能在自我与他人间找平衡。"
              : "您的光明人格带有目标导向与质量追求的特质。",
        suggestions: [],
      },
    ],
  };
}

export function getOptionById(
  questions: Assessment["questions"],
  questionId: string,
  optionId: string
): AssessmentOption | undefined {
  const question = questions.find((q) => q.id === questionId);
  return question?.options.find((o) => o.id === optionId);
}
