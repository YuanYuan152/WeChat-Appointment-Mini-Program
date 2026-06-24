"""个案风险评估表配置（与前端 constants/caseRecordRiskAssessment.ts 保持一致）。"""
from typing import Any, Dict, List, Optional, Set, Tuple

VALID_CHOICES: Tuple[str, ...] = ("A", "B", "C", "D", "E", "OTHER")

OTHER_OPTION_LABEL = "其他"

RISK_LEVEL_GUIDE = """一、一级风险/危机：转介/不适合咨询；向来访者说明其困扰已经超出了心理咨询可提供的专业范围，必须尽快就医或寻求其他专业帮助。

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
3、无任何自我伤害/他人伤害念头、支持系统良好、自我照顾能力正常。"""

RISK_ASSESSMENT_ITEMS: List[Dict[str, Any]] = [
    {
        "id": "diagnosis",
        "index": 1,
        "label": "是否诊断/就医",
        "description": "",
        "options": {
            "A": "无",
            "B": "轻度（**状态，不需要用药，或短期用药）",
            "C": "中度（**症，用药）",
            "D": "重度（有复发史、住院史）",
            "E": OTHER_OPTION_LABEL,
        },
        "choices": ["A", "B", "C", "D", "E"],
        "note_choices": {"E"},
        "other_choice": "E",
    },
    {
        "id": "support_system",
        "index": 2,
        "label": "支持系统",
        "description": "包括父母、伴侣、老师、朋友等重要他人，宗教信仰等",
        "options": {
            "A": "良好",
            "B": "一般",
            "C": "偏弱",
            "D": "没有",
            "E": OTHER_OPTION_LABEL,
        },
        "choices": ["A", "B", "C", "D", "E"],
        "note_choices": {"E"},
        "other_choice": "E",
    },
    {
        "id": "self_harm",
        "index": 3,
        "label": "自我伤害",
        "description": "",
        "options": {
            "A": "无",
            "B": "轻度（有念头无实施计划和行为）",
            "C": "中度（有念头有计划但未实施过/有非自杀的自伤行为）",
            "D": "重度（反复自伤/有过自杀行为未成功）",
            "E": OTHER_OPTION_LABEL,
        },
        "choices": ["A", "B", "C", "D", "E"],
        "note_choices": {"E"},
        "other_choice": "E",
    },
    {
        "id": "harm_others",
        "index": 4,
        "label": "伤害他人",
        "description": "",
        "options": {
            "A": "无",
            "B": "轻度（有念头无实施计划和行为，可自我控制）",
            "C": "中度（有念头有计划但未实施过）",
            "D": "重度（有详细计划并准备实施）",
            "E": OTHER_OPTION_LABEL,
        },
        "choices": ["A", "B", "C", "D", "E"],
        "note_choices": {"E"},
        "other_choice": "E",
    },
    {
        "id": "self_care",
        "index": 5,
        "label": "自我照顾",
        "description": "",
        "options": {
            "A": "良好（完全可以自我照顾）",
            "B": "轻度（偶尔不能自我照顾）",
            "C": "中度（经常不能自我照顾）",
            "D": "重度（完全无法自我照顾）",
            "E": OTHER_OPTION_LABEL,
        },
        "choices": ["A", "B", "C", "D", "E"],
        "note_choices": {"E"},
        "other_choice": "E",
    },
    {
        "id": "stress_event",
        "index": 6,
        "label": "重大/应激事件",
        "description": "",
        "options": {
            "A": "无",
            "B": "有（具体说明）",
            "C": OTHER_OPTION_LABEL,
        },
        "choices": ["A", "B", "C"],
        "note_choices": {"B", "C"},
        "other_choice": "C",
    },
    {
        "id": "family_history",
        "index": 7,
        "label": "家族史",
        "description": "",
        "options": {
            "A": "无",
            "B": "有（具体说明）",
            "C": OTHER_OPTION_LABEL,
        },
        "choices": ["A", "B", "C"],
        "note_choices": {"B", "C"},
        "other_choice": "C",
    },
    {
        "id": "medical_history",
        "index": 8,
        "label": "疾病史",
        "description": "",
        "options": {
            "A": "无",
            "B": "有（具体说明）",
            "C": OTHER_OPTION_LABEL,
        },
        "choices": ["A", "B", "C"],
        "note_choices": {"B", "C"},
        "other_choice": "C",
    },
    {
        "id": "trauma_history",
        "index": 9,
        "label": "创伤史",
        "description": "",
        "options": {
            "A": "无",
            "B": "有（具体说明）",
            "C": OTHER_OPTION_LABEL,
        },
        "choices": ["A", "B", "C"],
        "note_choices": {"B", "C"},
        "other_choice": "C",
    },
    {
        "id": "crisis_level",
        "index": 10,
        "label": "风险/危机等级",
        "description": "",
        "options": {
            "A": "一级风险/危机：转介处理",
            "B": "二级风险/危机：上报同心理咨询中心/督导/危机干预小组",
            "C": "三级风险/危机：告知监护人/紧急联系人；告知预警相关部门/相关人员；与来访或监护人讨论安全计划",
            "D": "无危机：一般咨询",
        },
        "choices": ["A", "B", "C", "D"],
        "note_choices": set(),
    },
]

RISK_ITEM_IDS: List[str] = [item["id"] for item in RISK_ASSESSMENT_ITEMS]

RISK_ITEM_BY_ID: Dict[str, Dict[str, Any]] = {item["id"]: item for item in RISK_ASSESSMENT_ITEMS}


def normalize_risk_choice(choice: str, item_id: Optional[str] = None) -> str:
    choice = (choice or "").strip().upper()
    cfg = RISK_ITEM_BY_ID.get(item_id) if item_id else None
    other = (cfg or {}).get("other_choice")
    if other == "C" and choice in {"E", "OTHER"}:
        return "C"
    if choice == "OTHER":
        return "E"
    return choice


def risk_item_allowed_choices(item_id: str) -> Set[str]:
    cfg = RISK_ITEM_BY_ID.get(item_id)
    if not cfg:
        return set(VALID_CHOICES)
    return set(cfg.get("choices") or VALID_CHOICES)


def risk_item_note_required(item_id: str, choice: str) -> bool:
    cfg = RISK_ITEM_BY_ID.get(item_id)
    if not cfg:
        return False
    note_choices: Set[str] = cfg.get("note_choices") or set()
    return choice in note_choices


def risk_choice_label(item_id: str, choice: str) -> str:
    cfg = RISK_ITEM_BY_ID.get(item_id)
    if not cfg:
        return choice
    choice = normalize_risk_choice(choice, item_id)
    text = cfg.get("options", {}).get(choice, choice)
    return f"{choice}. {text}"
