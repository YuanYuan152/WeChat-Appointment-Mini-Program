"""来访咨询反馈问卷编解码。"""

import json
from typing import Any, Optional

GOAL_SCORE_HINTS = {
    1: "未达成",
    3: "达成了一部分",
    5: "已完全达成",
}

RHYTHM_SCORE_HINTS = {
    1: "完全不契合",
    3: "基本契合",
    5: "高度契合",
}

STAR_COUNT = 5


def format_star_rating(score: int) -> str:
    n = max(0, min(STAR_COUNT, int(score or 0)))
    return "★" * n + "☆" * (STAR_COUNT - n)


def score_hint(labels: dict[int, str], score: int) -> str:
    return labels.get(score, "")


ALLOWED_IMPROVEMENTS = [
    "咨询室的隔音与私密性",
    "空间布置（如灯光、座椅、温度等）",
    "预约流程的便捷程度（如改约、提醒）",
    "咨询频率、时长的弹性安排",
    "费用支付或接待指引",
    "暂无需要改进的地方",
]


def encode_feedback(
    goal_score: Optional[int],
    rhythm_score: Optional[int],
    improvements: list[str],
) -> str:
    return json.dumps(
        {
            "goalScore": goal_score or 0,
            "rhythmScore": rhythm_score or 0,
            "improvements": improvements,
        },
        ensure_ascii=False,
    )


def parse_feedback_content(content: Optional[str]) -> Optional[dict[str, Any]]:
    if not content:
        return None
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return None
    if isinstance(data, dict) and "goalScore" in data and "rhythmScore" in data:
        return data
    return None


def feedback_summary(content: Optional[str]) -> Optional[str]:
    if not content:
        return None
    data = parse_feedback_content(content)
    if not data:
        return content.strip()
    goal = int(data.get("goalScore") or 0)
    rhythm = int(data.get("rhythmScore") or 0)
    improvements = data.get("improvements") or []
    parts: list[str] = []
    if goal > 0:
        goal_hint = score_hint(GOAL_SCORE_HINTS, goal)
        goal_text = format_star_rating(goal) + (f"（{goal_hint}）" if goal_hint else "")
        parts.append(f"目标达成：{goal_text}")
    if rhythm > 0:
        rhythm_hint = score_hint(RHYTHM_SCORE_HINTS, rhythm)
        rhythm_text = format_star_rating(rhythm) + (f"（{rhythm_hint}）" if rhythm_hint else "")
        parts.append(f"议题节奏：{rhythm_text}")
    if improvements:
        parts.append(f"改进方面：{'、'.join(improvements)}")
    if not parts:
        return "已提交反馈"
    return "\n".join(parts)


def feedback_detail(content: Optional[str]) -> Optional[dict[str, Any]]:
    data = parse_feedback_content(content)
    if not data:
        return None
    goal = int(data.get("goalScore") or 0)
    rhythm = int(data.get("rhythmScore") or 0)
    improvements = [str(x) for x in (data.get("improvements") or [])]
    goal_hint = score_hint(GOAL_SCORE_HINTS, goal) if goal > 0 else ""
    rhythm_hint = score_hint(RHYTHM_SCORE_HINTS, rhythm) if rhythm > 0 else ""
    return {
        "goalScore": goal if goal > 0 else None,
        "goalScoreLabel": (
            format_star_rating(goal) + (f" {goal_hint}" if goal_hint else "")
            if goal > 0
            else None
        ),
        "rhythmScore": rhythm if rhythm > 0 else None,
        "rhythmScoreLabel": (
            format_star_rating(rhythm) + (f" {rhythm_hint}" if rhythm_hint else "")
            if rhythm > 0
            else None
        ),
        "improvements": improvements,
    }
