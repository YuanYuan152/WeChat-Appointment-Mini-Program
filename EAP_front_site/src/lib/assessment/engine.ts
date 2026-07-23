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

function renderReportTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  return template.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (placeholder, key) =>
    Object.prototype.hasOwnProperty.call(variables, key)
      ? String(variables[key])
      : placeholder
  );
}

function reportProfile(
  assessment: Assessment,
  profileId: string,
  variables: Record<string, string | number> = {}
) {
  const profile = assessment.reportProfiles?.find((item) => item.id === profileId);
  if (!profile) return null;
  return {
    ...profile,
    title: renderReportTemplate(profile.title, variables),
    description: renderReportTemplate(profile.description, variables),
    suggestions: profile.suggestions.map((item) => renderReportTemplate(item, variables)),
  };
}

function calculateSumScore(
  assessment: Assessment,
  answers: Record<string, string>
): AssessmentScoreResult {
  const isV2 = assessment.scoringPreset === "generic-sum-v2";
  const reverseQuestionIds = isV2
    ? assessment.reverseQuestionIds ?? []
    : [];
  const rawTotalScore = assessment.questions.reduce(
    (total, question) =>
      total +
      getOptionValue(
        assessment,
        answers,
        question.id,
        reverseQuestionIds
    ),
    0
  );
  const totalScore = isV2
    ? Math.round(rawTotalScore * 100) / 100
    : rawTotalScore;

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

const PBI_STYLE_PROFILE: Record<string, string> = {
  权威型: "pbi-style-authoritative",
  专制型: "pbi-style-authoritarian",
  民主型: "pbi-style-democratic",
  放任型: "pbi-style-permissive",
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
  const motherStyleProfile = reportProfile(
    assessment,
    PBI_STYLE_PROFILE[motherStyle]
  );
  const fatherStyleProfile = reportProfile(
    assessment,
    PBI_STYLE_PROFILE[fatherStyle]
  );
  const motherAutonomyProfile = reportProfile(
    assessment,
    motherAutonomy >= 12 ? "pbi-autonomy-high" : "pbi-autonomy-normal",
    { parent: "母亲" }
  );
  const motherControlProfile = reportProfile(
    assessment,
    motherControl > 8.64 ? "pbi-control-high" : "pbi-control-normal",
    { parent: "母亲" }
  );
  const fatherAutonomyProfile = reportProfile(
    assessment,
    fatherAutonomy >= 12 ? "pbi-autonomy-high" : "pbi-autonomy-normal",
    { parent: "父亲" }
  );
  const fatherControlProfile = reportProfile(
    assessment,
    fatherControl > 7.62 ? "pbi-control-high" : "pbi-control-normal",
    { parent: "父亲" }
  );
  const summaryProfile = reportProfile(assessment, "pbi-summary", {
    motherStyle,
    fatherStyle,
  });

  return {
    type: "dimension",
    summary:
      summaryProfile?.description ??
      `母亲教养方式：${motherStyle}；父亲教养方式：${fatherStyle}`,
    dimensions: [
      {
        id: "mother-care",
        title: "母亲关爱",
        score: motherCare,
        level: motherStyle,
        description: motherStyleProfile?.description ?? PBI_STYLE_DESC[motherStyle],
        suggestions: motherStyleProfile?.suggestions ?? ["理解过往经历对现在的影响", "必要时寻求心理咨询支持"],
      },
      {
        id: "mother-autonomy",
        title: "母亲鼓励自主",
        score: motherAutonomy,
        level: motherAutonomy >= 12 ? "较高" : "一般",
        description:
          motherAutonomyProfile?.description ??
          (motherAutonomy >= 12
            ? "母亲较支持您独立探索和做决定，有助于培养自主性。"
            : "母亲对您自主性的支持相对有限，可能影响独立决策能力的发展。"),
        suggestions: motherAutonomyProfile?.suggestions ?? ["练习独立做决定", "在安全范围内尝试新的自主体验"],
      },
      {
        id: "mother-control",
        title: "母亲控制",
        score: motherControl,
        level: motherControl > 8.64 ? "较高" : "一般",
        description:
          motherControlProfile?.description ??
          (motherControl > 8.64
            ? "母亲可能对您的生活干涉较多，您可能感到缺乏自我决定的空间。"
            : "母亲给予您较多自由与选择权，有助于自我管理能力的发展。"),
        suggestions: motherControlProfile?.suggestions ?? ["觉察控制模式对当前关系的影响", "学习设定健康边界"],
      },
      {
        id: "father-care",
        title: "父亲关爱",
        score: fatherCare,
        level: fatherStyle,
        description: fatherStyleProfile?.description ?? PBI_STYLE_DESC[fatherStyle],
        suggestions: fatherStyleProfile?.suggestions ?? ["理解过往经历对现在的影响", "必要时寻求心理咨询支持"],
      },
      {
        id: "father-autonomy",
        title: "父亲鼓励自主",
        score: fatherAutonomy,
        level: fatherAutonomy >= 12 ? "较高" : "一般",
        description:
          fatherAutonomyProfile?.description ??
          (fatherAutonomy >= 12
            ? "父亲较支持您独立探索和做决定。"
            : "父亲对您自主性的支持相对有限。"),
        suggestions: fatherAutonomyProfile?.suggestions ?? ["练习独立做决定", "在安全范围内尝试新的自主体验"],
      },
      {
        id: "father-control",
        title: "父亲控制",
        score: fatherControl,
        level: fatherControl > 7.62 ? "较高" : "一般",
        description:
          fatherControlProfile?.description ??
          (fatherControl > 7.62
            ? "父亲可能对您的生活干涉较多。"
            : "父亲给予您较多自由与选择权。"),
        suggestions: fatherControlProfile?.suggestions ?? ["觉察控制模式对当前关系的影响", "学习设定健康边界"],
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
    const profile = reportProfile(assessment, above ? "cbcl-concern" : "cbcl-normal");
    return {
      id: dim.id,
      title: dim.title,
      score,
      level: above ? "需关注" : "正常",
      description: profile?.description ?? (above ? CBCL_ABOVE : CBCL_BELOW),
      suggestions:
        profile?.suggestions ??
        (above
          ? ["加强与孩子沟通", "必要时咨询儿童心理专业人士", "与学校老师保持联系"]
          : ["继续保持良好的亲子互动"]),
    };
  });

  const behaviorTotal = assessment.questions.reduce(
    (acc, q) => acc + getOptionValue(assessment, answers, q.id),
    0
  );
  const totalAbove = behaviorTotal > 37;
  const totalProfile = reportProfile(
    assessment,
    totalAbove ? "cbcl-total-concern" : "cbcl-total-normal"
  );
  const summaryProfile = reportProfile(assessment, "cbcl-summary", {
    total: behaviorTotal,
  });

  return {
    type: "dimension",
    summary:
      summaryProfile?.description ??
      `行为问题总分：${behaviorTotal}（参考界值 37）`,
    dimensions: [
      ...dimensions,
      {
        id: "behavior-total",
        title: "行为问题总分",
        score: behaviorTotal,
        level: totalAbove ? "需关注" : "正常",
        description: totalProfile?.description ?? (totalAbove ? CBCL_ABOVE : CBCL_BELOW),
        suggestions:
          totalProfile?.suggestions ??
          (totalAbove
            ? ["加强沟通交流", "必要时向专业人士寻求帮助"]
            : ["继续关注孩子的日常表现"]),
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
    {
      id: "machiavellianism",
      title: "维度一：马基雅维利主义倾向",
      items: ["d1", "d2", "d3", "d4"],
      intro:
        "这个维度评估您在处事中是否倾向于运用策略性思维，是否倾向于为达成目标而采取灵活方法，甚至操纵、控制他人，在某些情况下可能超越常规的道德界限。",
      descriptions: {
        low:
          "您在处事中倾向于遵循既定规则与节奏，不常使用策略性或操纵性手段。承诺他人的事项会尽力完成，如遇困难会提前说明，不倾向于敷衍或推诿。在合作中通常尽责完成本分工作，不刻意回避责任。追求自己的目标会靠一步一步的努力去争取，不太倾向于操纵、利用他人。与您相处会比较有安全感，不管是聊日常琐事，还是一起处理事情，都不用费心防备。",
        middle:
          "您在追求目标时，会运用一定的策略为自己争取优势，可能利用或操纵别人，但仍保留一定的底线。例如在争取机会时，可能通过了解竞争者情况，然后突出自身方案的独特性。若未按约定完成任务，可能倾向于解释原因而非主动补救。在共同承担费用等事务中，可能表现出很愿意与人分担费用，但又延迟或回避支付。与您互动时，对方可能会有被利用感，需要明确各自权责，保持适度界限。",
        high:
          "您可能是高度策略导向型的人。在目标达成过程中高度灵活，能够根据情境调整言行，有时可能超出一般合作规范，具有高度操纵性。例如可能在有求于人时表现出高度热情，而在目的达成后态度转淡。在竞争情境中，可能采取有争议的策略以争取自身优势。在承诺中，如承诺事项对您不再有利，可能毁约，甚至将责任推到其他人身上。与您互动时，对方可能会感到高度危险，需要注意沟通明确，保护双方权益。",
      },
    },
    {
      id: "psychopathy",
      title: "维度二：精神病态倾向",
      items: ["d5", "d6", "d7", "d8"],
      intro:
        "这个维度关注您在情感回应与共情表现方面的特点，是否对他人的情绪与处境反应较弱，或在行为中表现出较高的冲动性。",
      descriptions: {
        low:
          "您在人际互动中常能感知他人情绪，并作出相应回应。愿意倾听他人的困难，并在力所能及时提供协助，如陪伴、提供小礼物或实际帮助。在日常生活中也表现出基本的善意与关注。",
        middle:
          "您在情感表达上较为节制，对不熟悉的人往往保持距离。即使在提供帮助时，也倾向于仅完成基本动作，不深入参与他人情绪。例如在陪同就医时可能较少主动关心病情，或在解答问题时仅作简要说明。您通常明确区分自身与他人事务，不易因未提供协助而感到不安。",
        high:
          "您很可能是冷酷麻木派。您在他人表达情绪时回应很少，时常会表现出不理解或不耐烦。在冲突中可能直言不讳，且不常反思自身言行的情感影响，不会为自己让他人伤心而感到内疚或懊悔。甚至当他人指出这种态度令人不适时，您会视为过度反应。与您互动时，对方在情感支持方面的期待可能需要有所调整。",
      },
    },
    {
      id: "narcissism",
      title: "维度三：自恋倾向",
      items: ["d9", "d10", "d11", "d12"],
      intro:
        "这个维度评估个体在自我认知与人际互动中是否表现出较高的自我关注，是否倾向于将自身置于对话或活动的中心位置，甚至表现出贬低他人的倾向。",
      descriptions: {
        low:
          "您在互动中不常主导话题或突出自身成就，能够倾听他人并给予肯定。在决策或讨论中愿意采纳多方意见，不坚持自身观点唯一正确。相处氛围较为轻松。",
        middle:
          "您有点“小傲娇”的属性。您有时会希望获得他人关注与认可，例如会夸耀自己的成就，希望得到赞美和关注。在意见交流中可能对自身看法保有信心，不愿接受他人的反驳。但您有时也能接受他人的意见，当他人指出您过于自我中心时，您可能愿意进行调整。",
        high:
          "您很可能高度自我关注。在对话中您常将话题引向自身经历或观点，有时会打断他人或转移焦点。在评价他人意见时，可能倾向于维护自身立场。在成果或责任归属中，可能强调自身贡献或指出他人不足。与您互动时，对方可能经常觉得被忽略、被碾压、被审视，感到内耗甚至愤怒；建议您关注互动中双方的感受与价值。",
      },
    },
  ];

  const darkDims = darkGroups.map((g) => {
    const score = g.items.reduce(
      (acc, id) => acc + getOptionValue(assessment, answers, id),
      0
    );
    const level = darkLightLevel(score, 12, 20);
    const conclusion =
      level === "低"
        ? g.descriptions.low
        : level === "中"
          ? g.descriptions.middle
          : g.descriptions.high;
    const profileLevel = level === "低" ? "low" : level === "中" ? "middle" : "high";
    const profile = reportProfile(
      assessment,
      `dark-${g.id}-${profileLevel}`,
      { score }
    );
    return {
      id: g.id,
      title: g.title,
      score,
      level,
      description:
        profile?.description ??
        `${g.intro}\n\n您的得分是 ${score} 分。\n\n${conclusion}`,
      suggestions: profile?.suggestions ?? [],
    };
  });

  const darkTotal = darkDims.reduce((acc, d) => acc + d.score, 0);
  const totalLevel = darkLightLevel(darkTotal, 36, 60);
  const totalProfile = reportProfile(
    assessment,
    `dark-total-${totalLevel === "低" ? "low" : totalLevel === "中" ? "middle" : "high"}`,
    { total: darkTotal }
  );
  const summaryProfile = reportProfile(assessment, "dark-summary", {
    total: darkTotal,
  });

  return {
    type: "dimension",
    summary:
      summaryProfile?.description ??
      `三个维度的总分是 ${darkTotal} 分。将三个维度得分相加（总分范围 3–84 分），可对个体的黑暗人格倾向有整体了解。`,
    dimensions: [
      ...darkDims,
      {
        id: "dark-total",
        title: "综合暗黑等级判断",
        score: darkTotal,
        level: totalLevel,
        description:
          totalProfile?.description ??
          (darkTotal <= 36
            ? `您的总分是 ${darkTotal} 分。\n\n您在三个维度上的倾向均不显著，行为模式较为符合常规社交期待，互动中通常表现出诚意与可靠性。`
            : darkTotal <= 60
              ? `您的总分是 ${darkTotal} 分。\n\n您在某一个或若干维度上表现出一定倾向，可能在部分情境中采取策略性、低情感参与或自我聚焦的行为方式。与他人交往时需要保持好彼此的界限。`
              : `您的总分是 ${darkTotal} 分。\n\n您在多个维度上均有较高得分，行为中可能综合表现出高度策略性、情感疏离与自我中心倾向。在互动中尤其需要注意维护双方的情绪与利益边界。`),
        suggestions: totalProfile?.suggestions ?? [],
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
