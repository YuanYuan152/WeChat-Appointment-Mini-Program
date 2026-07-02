"""心理量表（PHQ-9 / GAD-7）校验与解读。"""

import json
from typing import Any, Optional

SCALE_TYPES = {
    "PHQ9": {
        "label": "PHQ-9 抑郁量表",
        "questionCount": 9,
        "levels": [
            (0, 4, "无或极轻微", "您目前的抑郁症状很轻微或几乎没有，心理状态整体较为平稳。请继续保持规律作息与积极的生活方式。", ["保持规律运动与充足睡眠", "维持社交联系与兴趣爱好", "关注情绪变化，必要时可再次自评"]),
            (5, 9, "轻度", "您可能存在轻度的抑郁情绪或相关症状，对生活有一定影响但尚属可控范围。建议关注自我照顾与压力管理。", ["尝试正念、呼吸放松等自我调节方法", "与信任的家人或朋友倾诉", "若症状持续两周以上，建议预约心理咨询"]),
            (10, 14, "中度", "您目前抑郁症状达到中度水平，可能已影响日常功能与情绪体验。建议尽快寻求专业心理支持。", ["预约专业心理咨询师进行评估", "减少独处时间，寻求社会支持", "如有自伤念头，请立即联系危机热线或就医"]),
            (15, 19, "中重度", "您的抑郁症状较为明显，对生活、工作与人际可能产生较大困扰。强烈建议尽快接受专业评估与干预。", ["尽快联系心理咨询师或精神科医生", "告知家人或紧急联系人当前状况", "避免独处，确保身边有人可联络"]),
            (20, 27, "重度", "您目前的抑郁症状达到重度水平，需要高度重视。请尽快寻求专业医疗与心理帮助。", ["立即联系精神科医生或前往医疗机构", "告知家人，安排陪伴与支持", "如有自伤或自杀念头，请拨打心理危机热线或 120"]),
        ],
    },
    "GAD7": {
        "label": "GAD-7 焦虑量表",
        "questionCount": 7,
        "levels": [
            (0, 4, "无或极轻微", "您目前的焦虑症状很轻微或几乎没有，情绪调节能力良好。请继续保持健康的生活习惯。", ["保持规律作息与适度运动", "练习放松技巧以预防压力积累", "关注身心状态变化"]),
            (5, 9, "轻度", "您可能存在轻度的焦虑情绪，偶尔感到紧张或担忧。通过自我调节通常可以得到缓解。", ["尝试深呼吸、渐进式肌肉放松", "减少咖啡因摄入，保证睡眠", "若焦虑持续，可考虑心理咨询"]),
            (10, 14, "中度", "您目前焦虑症状达到中度水平，可能已影响注意力、睡眠或日常功能。建议寻求专业支持。", ["预约心理咨询师进行系统评估", "学习认知行为技巧管理担忧", "避免过度使用酒精或其他物质缓解焦虑"]),
            (15, 21, "重度", "您目前的焦虑症状较为严重，可能显著影响生活质量。请尽快寻求专业心理或医疗帮助。", ["尽快联系心理咨询师或精神科医生", "告知家人当前状况，获得支持", "减少高强度压力源，优先自我照顾"]),
        ],
    },
}


def normalize_scale_type(scale_type: str) -> str:
    key = (scale_type or "").strip().upper().replace("-", "")
    if key in ("PHQ9", "PHQ"):
        return "PHQ9"
    if key in ("GAD7", "GAD"):
        return "GAD7"
    raise ValueError("不支持的量表类型")


def validate_answers(scale_type: str, answers: list[int]) -> tuple[str, list[int], int]:
    key = normalize_scale_type(scale_type)
    meta = SCALE_TYPES[key]
    expected = meta["questionCount"]
    if len(answers) != expected:
        raise ValueError(f"请完成全部 {expected} 道题目")
    normalized: list[int] = []
    total = 0
    for i, val in enumerate(answers):
        if val is None or int(val) < 0 or int(val) > 3:
            raise ValueError(f"第 {i + 1} 题请选择 0-3 分")
        n = int(val)
        normalized.append(n)
        total += n
    return key, normalized, total


def level_label(scale_type: str, total: int) -> str:
    return interpret_scale(scale_type, total)["levelLabel"]


def interpret_scale(scale_type: str, total: int) -> dict[str, Any]:
    key = normalize_scale_type(scale_type)
    for low, high, label, description, suggestions in SCALE_TYPES[key]["levels"]:
        if low <= total <= high:
            meta = SCALE_TYPES[key]
            return {
                "levelLabel": label,
                "description": description,
                "suggestions": list(suggestions),
                "resultSummary": f"{meta['label']} · 总分 {total} · {label}",
            }
    return {
        "levelLabel": "—",
        "description": "",
        "suggestions": [],
        "resultSummary": f"{scale_label(key)} · 总分 {total}",
    }


def scale_label(scale_type: str) -> str:
    return SCALE_TYPES[normalize_scale_type(scale_type)]["label"]


def encode_answers(answers: list[int]) -> str:
    return json.dumps(answers, ensure_ascii=False)


def decode_answers(raw: Optional[str]) -> list[int]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return [int(x) for x in data]
    return []


def result_dict(
    row_id: int,
    scale_type: str,
    answers: list[int],
    total: int,
    created_at,
) -> dict[str, Any]:
    key = normalize_scale_type(scale_type)
    interp = interpret_scale(key, total)
    return {
        "id": row_id,
        "scaleType": key,
        "scaleLabel": scale_label(key),
        "total": total,
        "levelLabel": interp["levelLabel"],
        "description": interp["description"],
        "suggestions": interp["suggestions"],
        "resultSummary": interp["resultSummary"],
        "answers": answers,
        "createdAt": created_at,
    }
