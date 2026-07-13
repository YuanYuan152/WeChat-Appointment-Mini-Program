"""工作人员对咨询师/来访者的内部备注（咨询助理、咨询主任、管理员共享）。"""

from datetime import datetime
from typing import Dict, List

from sqlalchemy.orm import Session

from models import AppStaffAccountRemark

REMARK_MAX_LEN = 2000


def get_staff_remark(db: Session, account_id: int) -> str:
    row = (
        db.query(AppStaffAccountRemark)
        .filter(AppStaffAccountRemark.AccountId == account_id)
        .first()
    )
    return (row.Remark or "").strip() if row else ""


def get_staff_remarks_map(db: Session, account_ids: List[int]) -> Dict[int, str]:
    if not account_ids:
        return {}
    rows = (
        db.query(AppStaffAccountRemark)
        .filter(AppStaffAccountRemark.AccountId.in_(account_ids))
        .all()
    )
    return {row.AccountId: (row.Remark or "").strip() for row in rows}


def set_staff_remark(
    db: Session,
    account_id: int,
    remark: str,
    updated_by: int,
) -> str:
    normalized = (remark or "").strip()
    if len(normalized) > REMARK_MAX_LEN:
        raise ValueError(f"备注不能超过 {REMARK_MAX_LEN} 字")

    row = (
        db.query(AppStaffAccountRemark)
        .filter(AppStaffAccountRemark.AccountId == account_id)
        .first()
    )
    if not row:
        row = AppStaffAccountRemark(
            AccountId=account_id,
            Remark=normalized or None,
            UpdatedByAccountId=updated_by,
        )
        db.add(row)
    else:
        row.Remark = normalized or None
        row.UpdatedByAccountId = updated_by
        row.UpdatedAt = datetime.utcnow()
    db.flush()
    return normalized
