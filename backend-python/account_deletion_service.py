"""管理员物理删除用户账号及其附属数据。"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import (
    AppAccount,
    AppAssessmentAuditLog,
    AppAssessmentReport,
    AppCaseRecord,
    AppCaseRecordAmendmentRequest,
    AppConsultation,
    AppConsultationFeedback,
    AppContactRecord,
    AppCounselorFavorite,
    AppCounselorPatientPricing,
    AppCounselorProfile,
    AppFeedback,
    AppLeaveRequest,
    AppLoginSession,
    AppMessage,
    AppMessageLog,
    AppOrder,
    AppPsychScaleResult,
    AppRefundExemption,
    AppRegistrationForm,
    AppRemindTask,
    AppRiskAlert,
    AppRoleBinding,
    AppRoleSwitchLog,
    AppSchedule,
    AppScheduleCancelLog,
    AppSmsVerification,
    AppUserPreferenceTag,
)


def hard_delete_blocking_reason(db: Session, account_id: int) -> Optional[str]:
    """存在不可删除的业务数据时返回原因，否则返回 None。"""
    if (
        db.query(AppConsultation.Id)
        .filter(
            or_(
                AppConsultation.PatientId == account_id,
                AppConsultation.CounselorId == account_id,
            )
        )
        .first()
    ):
        return "该用户存在咨询记录，无法删除。如需停用请解绑其角色。"

    if (
        db.query(AppCaseRecord.Id)
        .filter(AppCaseRecord.CounselorId == account_id)
        .first()
    ):
        return "该用户存在咨询个案记录，无法删除。如需停用请解绑其角色。"

    if (
        db.query(AppOrder.Id)
        .filter(
            AppOrder.AccountId == account_id,
            AppOrder.Status.in_(("PAID", "REFUNDED")),
        )
        .first()
    ):
        return "该用户存在已支付订单，无法删除。"

    if (
        db.query(AppOrder.Id)
        .join(AppSchedule, AppSchedule.Id == AppOrder.SlotId)
        .filter(
            AppSchedule.CounselorId == account_id,
            AppOrder.Status.in_(("PAID", "REFUNDED")),
        )
        .first()
    ):
        return "该咨询师的排期存在已支付订单，无法删除。"

    return None


def hard_delete_account(db: Session, account_id: int) -> None:
    """物理删除账号及可安全移除的附属数据（无咨询/已支付订单等核心记录）。"""
    reason = hard_delete_blocking_reason(db, account_id)
    if reason:
        raise ValueError(reason)

    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not account:
        raise ValueError("用户不存在")

    from patient_contract_service import retire_counselor_booking_relationships

    # 即使角色数据已被部分清理，也要按账号 ID 清除残留绑定和待支付订单。
    retire_counselor_booking_relationships(db, account_id)

    mobile = (account.Mobile or "").strip()

    schedule_ids = [
        row.Id
        for row in db.query(AppSchedule.Id)
        .filter(AppSchedule.CounselorId == account_id)
        .all()
    ]

    db.query(AppLeaveRequest).filter(AppLeaveRequest.CounselorId == account_id).delete(
        synchronize_session=False
    )
    if schedule_ids:
        db.query(AppLeaveRequest).filter(AppLeaveRequest.ScheduleId.in_(schedule_ids)).delete(
            synchronize_session=False
        )

    db.query(AppScheduleCancelLog).filter(AppScheduleCancelLog.CounselorId == account_id).delete(
        synchronize_session=False
    )
    if schedule_ids:
        # 未支付订单保留审计记录，但排期即将物理删除，必须解除引用避免孤儿 SlotId。
        linked_unpaid_orders = (
            db.query(AppOrder)
            .filter(
                AppOrder.SlotId.in_(schedule_ids),
                ~AppOrder.Status.in_(("PAID", "REFUNDED")),
            )
            .all()
        )
        for order in linked_unpaid_orders:
            order.SlotId = None
        if linked_unpaid_orders:
            db.flush()
    db.query(AppSchedule).filter(AppSchedule.CounselorId == account_id).delete(
        synchronize_session=False
    )

    db.query(AppLoginSession).filter(AppLoginSession.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppRoleBinding).filter(AppRoleBinding.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppMessage).filter(AppMessage.AccountId == account_id).delete(synchronize_session=False)
    db.query(AppMessageLog).filter(AppMessageLog.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppRemindTask).filter(AppRemindTask.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppUserPreferenceTag).filter(AppUserPreferenceTag.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppCounselorFavorite).filter(
        or_(
            AppCounselorFavorite.AccountId == account_id,
            AppCounselorFavorite.CounselorId == account_id,
        )
    ).delete(synchronize_session=False)
    db.query(AppCounselorPatientPricing).filter(
        or_(
            AppCounselorPatientPricing.CounselorAccountId == account_id,
            AppCounselorPatientPricing.PatientAccountId == account_id,
        )
    ).delete(synchronize_session=False)
    db.query(AppCounselorProfile).filter(AppCounselorProfile.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppRegistrationForm).filter(AppRegistrationForm.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppConsultationFeedback).filter(AppConsultationFeedback.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppPsychScaleResult).filter(AppPsychScaleResult.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppAssessmentReport).filter(AppAssessmentReport.AccountId == account_id).delete(
        synchronize_session=False
    )
    # 审计事实需要保留，但账号被物理删除后不能继续保留操作者标识。
    db.query(AppAssessmentAuditLog).filter(
        AppAssessmentAuditLog.ActorAccountId == account_id
    ).update(
        {
            AppAssessmentAuditLog.ActorAccountId: None,
            AppAssessmentAuditLog.ActorRole: None,
        },
        synchronize_session=False,
    )
    db.query(AppFeedback).filter(AppFeedback.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppRefundExemption).filter(AppRefundExemption.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppContactRecord).filter(
        or_(
            AppContactRecord.PatientId == account_id,
            AppContactRecord.AssistantId == account_id,
        )
    ).delete(synchronize_session=False)
    db.query(AppRiskAlert).filter(
        or_(
            AppRiskAlert.PatientId == account_id,
            AppRiskAlert.AssistantId == account_id,
        )
    ).delete(synchronize_session=False)
    db.query(AppCaseRecordAmendmentRequest).filter(
        AppCaseRecordAmendmentRequest.CounselorId == account_id
    ).delete(synchronize_session=False)
    db.query(AppOrder).filter(AppOrder.AccountId == account_id).delete(synchronize_session=False)
    db.query(AppRoleSwitchLog).filter(AppRoleSwitchLog.AccountId == account_id).delete(
        synchronize_session=False
    )

    if mobile:
        db.query(AppSmsVerification).filter(AppSmsVerification.Mobile == mobile).delete(
            synchronize_session=False
        )

    db.delete(account)
    db.flush()
