"""EAP 量表域的内容无关审计记录。"""

from __future__ import annotations

import json
from typing import Any, Optional

from sqlalchemy.orm import Session

from models import AppAccount, AppAssessmentAuditLog
from role_active import get_account_role


def _metadata_json(metadata: Optional[dict[str, Any]]) -> Optional[str]:
    if not metadata:
        return None
    encoded = json.dumps(metadata, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    if len(encoded) > 2000:
        raise ValueError("量表审计元数据超过 2000 字符")
    return encoded


def begin_assessment_audit(
    db: Session,
    *,
    actor: Optional[AppAccount],
    action: str,
    target_type: str,
    request_id: Optional[str] = None,
    target_public_id: Optional[str] = None,
    assessment_id: Optional[str] = None,
    assessment_version: Optional[int] = None,
    metadata: Optional[dict[str, Any]] = None,
    outcome: str = "PENDING",
) -> AppAssessmentAuditLog:
    role = get_account_role(db, actor.Id) if actor else None
    row = AppAssessmentAuditLog(
        RequestId=(request_id or "")[:64] or None,
        ActorAccountId=actor.Id if actor else None,
        ActorRole=role,
        Action=action[:50],
        TargetType=target_type,
        TargetPublicId=(target_public_id or "")[:40] or None,
        AssessmentId=(assessment_id or "")[:80] or None,
        AssessmentVersion=assessment_version,
        Outcome=outcome,
        MetadataJson=_metadata_json(metadata),
    )
    db.add(row)
    db.flush()
    return row


def finish_assessment_audit(
    row: AppAssessmentAuditLog,
    *,
    outcome: str,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    row.Outcome = outcome
    if metadata is not None:
        row.MetadataJson = _metadata_json(metadata)
