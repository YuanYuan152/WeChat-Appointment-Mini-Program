export type RiskChoice = "A" | "B" | "C" | "D" | "E" | "OTHER" | "";

export interface RiskItemValue {
  choice: RiskChoice;
  note?: string;
}

export interface RiskAssessmentData {
  items: Record<string, RiskItemValue>;
}

export interface RiskAssessmentItemConfig {
  id: string;
  index: number;
  label: string;
  description?: string;
  options: Partial<Record<"A" | "B" | "C" | "D" | "E", string>>;
  choices: RiskChoice[];
  noteChoices: RiskChoice[];
  otherChoice?: "C" | "E";
}

export const RISK_LEVEL_GUIDE = `一、一级风险/危机：转介/不适合咨询；向来访者说明其困扰已经超出了心理咨询可提供的专业范围，必须尽快就医或寻求其他专业帮助。

判定标准：满足任一条件即可归为一级（优先级最高）：
1、项目1（诊断/就医）：选 D（重度：一年内有复发史、住院史）且无医生「配合心理咨询」建议；未选选项，但初始访谈发现明显精神疾病症状（如幻觉、妄想）或严重躯体疾病且自评影响极大（项目8选 B 且说明为严重疾病，参考癌症、重型糖尿病、甲亢、严重的免疫系统疾病、带有耻辱感的性病、难以忍受的慢性疼痛等）。
2、项目3（自我伤害）：选 D（重度：反复自伤/自杀未遂）且处于发作期。
3、项目4（伤害他人）：选 D（重度：有详细计划并准备实施）。
4、项目6（重大/应激事件）：选 B 且说明正在经历性虐待、暴力关系。
5、咨询期间发现心理疾病复发（项目1选 D+近期复发）或严重躯体症状（项目8选 B+症状急性发作）。

二、二级风险/危机：不适合网络咨询；需要上报同心理咨询中心，且需要突破保密设置、以及做安全计划。

判定标准：不符合一级时，满足任一条件：
1、项目3（自我伤害）：选 C（中度：有念头+计划未实施/非自杀自伤）。
2、项目4（伤害他人）：选 C（中度：有念头+计划未实施）。
3、项目5（自我照顾）：选 C（中度：经常不能自我照顾）。
4、咨询师评估可能升级为一级风险（如项目1选 C+项目3选 B、项目2选 D+项目3选 C 等组合）。

三、三级风险/危机：咨询师无需上报，但要关注来访危机情况变化，每次咨询评估，在需要的情况下突破保密设置或做安全计划。

判断标准：不符合一、二级时，满足任一条件：
1、项目2（支持系统）：选 B（一般）。
2、项目3（自我伤害）：选 B（轻度：有念头无计划/行为）。
3、项目4（伤害他人）：选 B（轻度：有念头无计划/行为，可自控）。
4、项目5（自我照顾）：选 B（轻度：偶尔不能自我照顾）。
5、项目6（重大/应激事件）：选 B 近期经历负性生活事件且自评受影响较大，咨询师评估可能升级为二级风险（参考：①丧失性挫折：包括亲人去逝、失业、失恋、事业受挫、股票、赌博导致损失大量金钱；②人际关系冲突、夫妻关系冲突、婚外恋、离婚等）。

四、无危机：一般咨询

判断标准：未触发上述任一等级条件：
1、所有项目均选 A（如项目1-5全 A、项目6-9全 A）。
2、项目6-9选 B 但说明事件/病史不构成应激（如项目6选 B 说明「轻微考试压力」）。
3、无任何自我伤害/他人伤害念头、支持系统良好、自我照顾能力正常。`;

export const RISK_ASSESSMENT_ITEMS: RiskAssessmentItemConfig[] = [
  {
    id: "diagnosis",
    index: 1,
    label: "是否诊断/就医",
    options: {
      A: "无",
      B: "轻度（**状态，不需要用药，或短期用药）",
      C: "中度（**症，用药）",
      D: "重度（有复发史、住院史）",
      E: "其他",
    },
    choices: ["A", "B", "C", "D", "E"],
    noteChoices: ["E"],
    otherChoice: "E",
  },
  {
    id: "support_system",
    index: 2,
    label: "支持系统",
    description: "包括父母、伴侣、老师、朋友等重要他人，宗教信仰等",
    options: {
      A: "良好",
      B: "一般",
      C: "偏弱",
      D: "没有",
      E: "其他",
    },
    choices: ["A", "B", "C", "D", "E"],
    noteChoices: ["E"],
    otherChoice: "E",
  },
  {
    id: "self_harm",
    index: 3,
    label: "自我伤害",
    options: {
      A: "无",
      B: "轻度（有念头无实施计划和行为）",
      C: "中度（有念头有计划但未实施过/有非自杀的自伤行为）",
      D: "重度（反复自伤/有过自杀行为未成功）",
      E: "其他",
    },
    choices: ["A", "B", "C", "D", "E"],
    noteChoices: ["E"],
    otherChoice: "E",
  },
  {
    id: "harm_others",
    index: 4,
    label: "伤害他人",
    options: {
      A: "无",
      B: "轻度（有念头无实施计划和行为，可自我控制）",
      C: "中度（有念头有计划但未实施过）",
      D: "重度（有详细计划并准备实施）",
      E: "其他",
    },
    choices: ["A", "B", "C", "D", "E"],
    noteChoices: ["E"],
    otherChoice: "E",
  },
  {
    id: "self_care",
    index: 5,
    label: "自我照顾",
    options: {
      A: "良好（完全可以自我照顾）",
      B: "轻度（偶尔不能自我照顾）",
      C: "中度（经常不能自我照顾）",
      D: "重度（完全无法自我照顾）",
      E: "其他",
    },
    choices: ["A", "B", "C", "D", "E"],
    noteChoices: ["E"],
    otherChoice: "E",
  },
  {
    id: "stress_event",
    index: 6,
    label: "重大/应激事件",
    options: { A: "无", B: "有（具体说明）", C: "其他" },
    choices: ["A", "B", "C"],
    noteChoices: ["B", "C"],
    otherChoice: "C",
  },
  {
    id: "family_history",
    index: 7,
    label: "家族史",
    options: { A: "无", B: "有（具体说明）", C: "其他" },
    choices: ["A", "B", "C"],
    noteChoices: ["B", "C"],
    otherChoice: "C",
  },
  {
    id: "medical_history",
    index: 8,
    label: "疾病史",
    options: { A: "无", B: "有（具体说明）", C: "其他" },
    choices: ["A", "B", "C"],
    noteChoices: ["B", "C"],
    otherChoice: "C",
  },
  {
    id: "trauma_history",
    index: 9,
    label: "创伤史",
    options: { A: "无", B: "有（具体说明）", C: "其他" },
    choices: ["A", "B", "C"],
    noteChoices: ["B", "C"],
    otherChoice: "C",
  },
  {
    id: "crisis_level",
    index: 10,
    label: "风险/危机等级",
    options: {
      A: "一级风险/危机：转介处理",
      B: "二级风险/危机：上报同心理咨询中心/督导/危机干预小组",
      C: "三级风险/危机：告知监护人/紧急联系人；告知预警相关部门/相关人员；与来访或监护人讨论安全计划",
      D: "无危机：一般咨询",
    },
    choices: ["A", "B", "C", "D"],
    noteChoices: [],
  },
];

export const RISK_SCALE_ITEMS = RISK_ASSESSMENT_ITEMS.filter((item) => item.id !== "crisis_level");
export const CRISIS_REPORT_CHOICES: RiskChoice[] = ["A", "B", "C"];

export const createEmptyRiskAssessment = (): RiskAssessmentData => ({
  items: Object.fromEntries(RISK_ASSESSMENT_ITEMS.map((item) => [item.id, { choice: "", note: "" }])),
});

export const normalizeRiskChoice = (choice: RiskChoice | string | undefined, itemId?: string): RiskChoice => {
  const value = String(choice || "").trim().toUpperCase() as RiskChoice;
  if (!value) return "";
  const item = itemId ? RISK_ASSESSMENT_ITEMS.find((entry) => entry.id === itemId) : undefined;
  if (item?.otherChoice === "C" && (value === "E" || value === "OTHER")) return "C";
  if (value === "OTHER") return "E";
  return value;
};

const noteHasAny = (note: string, keywords: string[]) => {
  const lower = note.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
};

const choiceOf = (data: RiskAssessmentData | null | undefined, itemId: string) =>
  normalizeRiskChoice(data?.items?.[itemId]?.choice || "", itemId);

const noteOf = (data: RiskAssessmentData | null | undefined, itemId: string) =>
  String(data?.items?.[itemId]?.note || "").trim();

export const calculateCrisisLevelChoice = (data?: RiskAssessmentData | null): "A" | "B" | "C" | "D" => {
  const diagnosis = choiceOf(data, "diagnosis");
  const support = choiceOf(data, "support_system");
  const selfHarm = choiceOf(data, "self_harm");
  const harmOthers = choiceOf(data, "harm_others");
  const selfCare = choiceOf(data, "self_care");
  const stressEvent = choiceOf(data, "stress_event");
  const medicalHistory = choiceOf(data, "medical_history");
  const severeStress = noteHasAny(noteOf(data, "stress_event"), ["性虐待", "性侵", "强奸", "暴力关系", "家暴", "暴力"]);
  const severeMedical = noteHasAny(noteOf(data, "medical_history"), [
    "癌",
    "重型糖尿病",
    "甲亢",
    "免疫系统",
    "性病",
    "慢性疼痛",
    "急性发作",
    "严重",
  ]);

  if (
    diagnosis === "D" ||
    selfHarm === "D" ||
    harmOthers === "D" ||
    selfCare === "D" ||
    (stressEvent === "B" && severeStress) ||
    (medicalHistory === "B" && severeMedical)
  ) {
    return "A";
  }

  if (
    selfHarm === "C" ||
    harmOthers === "C" ||
    selfCare === "C" ||
    (diagnosis === "C" && selfHarm === "B") ||
    (support === "D" && selfHarm === "B")
  ) {
    return "B";
  }

  if (
    support === "B" ||
    support === "C" ||
    support === "D" ||
    selfHarm === "B" ||
    harmOthers === "B" ||
    selfCare === "B" ||
    stressEvent === "B" ||
    stressEvent === "C"
  ) {
    return "C";
  }

  return "D";
};

export const normalizeRiskAssessment = (raw?: Record<string, unknown> | RiskAssessmentData | null): RiskAssessmentData => {
  const base = createEmptyRiskAssessment();
  const rawItems = raw && typeof raw === "object" && "items" in raw ? (raw.items as Record<string, unknown>) : {};
  for (const item of RISK_SCALE_ITEMS) {
    const val = rawItems?.[item.id];
    if (val && typeof val === "object") {
      const typed = val as { choice?: RiskChoice | string; note?: string };
      base.items[item.id] = {
        choice: normalizeRiskChoice(typed.choice || "", item.id),
        note: typed.note || "",
      };
    }
  }
  base.items.crisis_level = { choice: calculateCrisisLevelChoice(base), note: "" };
  return base;
};

export const riskAssessmentMissingLabel = (data?: RiskAssessmentData | null): string | null => {
  if (!data?.items) return RISK_SCALE_ITEMS[0]?.label ?? "个案风险评估";
  for (const item of RISK_SCALE_ITEMS) {
    const val = data.items[item.id];
    const choice = normalizeRiskChoice(val?.choice || "", item.id);
    if (!choice || !item.choices.includes(choice)) return `${item.index}. ${item.label}`;
    if (item.noteChoices.includes(choice) && !String(val?.note || "").trim()) {
      return `${item.index}. ${item.label}（请填写说明）`;
    }
  }
  return null;
};

export const getCrisisLevelChoice = (data?: RiskAssessmentData | null): "A" | "B" | "C" | "D" =>
  calculateCrisisLevelChoice(data);

export const crisisLevelRequiresReport = (data?: RiskAssessmentData | null): boolean =>
  CRISIS_REPORT_CHOICES.includes(getCrisisLevelChoice(data));

export const formatRiskChoiceDisplay = (itemId: string, choice: RiskChoice, note?: string): string => {
  const normalized = normalizeRiskChoice(choice, itemId);
  if (!normalized) return "-";
  const item = RISK_ASSESSMENT_ITEMS.find((entry) => entry.id === itemId);
  const text = item?.options[normalized as "A" | "B" | "C" | "D" | "E"] || normalized;
  if (item?.noteChoices.includes(normalized) && note?.trim()) {
    return `${normalized}. ${text}（${note.trim()}）`;
  }
  return `${normalized}. ${text}`;
};
