"""账号注销：

- soft_delete_account：用户自主注销（微信合规）。清空可识别身份字段，但保留
  AppAccount 主键及咨询/订单/个案等业务行，供合规追溯。
- hard_delete_account：仅管理员物理删除；普通角色需无核心业务数据，
  Tester（purge_business=True）可级联删除全部关联业务数据后再删账号。
"""

from __future__ import annotations

from datetime import datetime
import re
from typing import Optional

from sqlalchemy import inspect as sa_inspect, or_
from sqlalchemy.orm import Session

from models import (
    AppAccount,
    AppAssessmentAuditLog,
    AppAssessmentReport,
    AppCaseRecord,
    AppCaseRecordAmendmentRequest,
    AppCaseRecordRevision,
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
    AppStaffAccountRemark,
    AppTask,
    AppUserPreferenceTag,
    AppUserSubscribeAuth,
)


def _orm_table_exists(db: Session, model) -> bool:
    """本地库尚未跑 ensure_schema 时，EAP 测评表可能不存在，删除用户须跳过。"""
    try:
        bind = db.get_bind()
        name = getattr(model, "__tablename__", None)
        if not name:
            return False
        return bool(sa_inspect(bind).has_table(name))
    except Exception:
        return False


def soft_delete_account(
    db: Session,
    account: AppAccount,
    *,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> dict:
    """
    软注销（用户侧）：

    保留（合规追溯，绝不删除）：
      - AppAccount 行本身（Id / CreatedAt 不变）
      - AppConsultation / AppOrder / AppCaseRecord / AppRefundExemption 等业务表
        （仍通过 PatientId / AccountId 关联到该 Id）

    清除 / 失效：
      - OpenId / UnionId / Mobile / 昵称头像姓名等可识别字段
      - 登录会话、角色绑定（无法再登录、无法再以原角色操作）
      - 站内消息、收藏、提醒任务等非追溯必需的附属数据
    """
    if getattr(account, "IsActive", True) is False or getattr(account, "DeletedAt", None):
        return {
            "message": "账号已处于注销状态",
            "accountId": account.Id,
            "alreadyDeleted": True,
        }

    account_id = account.Id
    now = datetime.utcnow()
    # 换掉 openid，避免同一微信再次登录命中已注销行；业务表仍挂原 Id
    new_openid = f"deleted_{account_id}_{int(now.timestamp())}"

    db.query(AppLoginSession).filter(AppLoginSession.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppRoleBinding).filter(AppRoleBinding.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppMessage).filter(AppMessage.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppRemindTask).filter(AppRemindTask.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppCounselorFavorite).filter(AppCounselorFavorite.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppUserPreferenceTag).filter(AppUserPreferenceTag.AccountId == account_id).delete(
        synchronize_session=False
    )

    db.add(
        AppRoleSwitchLog(
            AccountId=account_id,
            FromRole=getattr(account, "ActiveRole", None),
            ToRole="DELETED",
            Ip=(ip or None),
            UserAgent=(user_agent or "")[:200] if user_agent else None,
        )
    )

    update_fields = {
        AppAccount.OpenId: new_openid,
        AppAccount.UnionId: None,
        AppAccount.Mobile: None,
        AppAccount.Nickname: "已注销用户",
        AppAccount.AvatarUrl: None,
        AppAccount.RealName: None,
        AppAccount.Gender: None,
        AppAccount.Birthday: None,
        AppAccount.EmergencyContact: None,
        AppAccount.EmergencyRelation: None,
        AppAccount.EmergencyPhone: None,
        AppAccount.ActiveRole: None,
        AppAccount.PasswordHash: None,
        AppAccount.IntakeSignatureUrl: None,
        AppAccount.IsActive: False,
        AppAccount.DeletedAt: now,
        AppAccount.UpdatedAt: now,
    }
    if hasattr(AppAccount, "AccessRevokedAt"):
        update_fields[AppAccount.AccessRevokedAt] = now
    if hasattr(AppAccount, "ProfileCompletedAt"):
        update_fields[AppAccount.ProfileCompletedAt] = None
    if hasattr(AppAccount, "SubscribeOptInAt"):
        update_fields[AppAccount.SubscribeOptInAt] = None

    db.query(AppAccount).filter(AppAccount.Id == account_id).update(
        update_fields,
        synchronize_session=False,
    )
    db.commit()

    return {
        "message": "账号已注销。预约与订单等业务记录已保留供合规追溯，登录凭证已失效。",
        "accountId": account_id,
        "alreadyDeleted": False,
        "retained": {
            "consultations": True,
            "orders": True,
            "caseRecords": True,
        },
    }


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


def _purge_business_data_for_account(db: Session, account_id: int) -> None:
    """Tester 强制删除：清掉咨询/个案/订单等核心业务行（及依赖行）。"""
    consultations = (
        db.query(AppConsultation)
        .filter(
            or_(
                AppConsultation.PatientId == account_id,
                AppConsultation.CounselorId == account_id,
            )
        )
        .all()
    )
    cons_ids = [c.Id for c in consultations]
    order_ids = {c.OrderId for c in consultations if c.OrderId}

    if cons_ids:
        case_ids = [
            row.Id
            for row in db.query(AppCaseRecord.Id)
            .filter(AppCaseRecord.ConsultationId.in_(cons_ids))
            .all()
        ]
        if case_ids:
            db.query(AppCaseRecordRevision).filter(
                AppCaseRecordRevision.CaseRecordId.in_(case_ids)
            ).delete(synchronize_session=False)
            db.query(AppCaseRecordAmendmentRequest).filter(
                AppCaseRecordAmendmentRequest.CaseRecordId.in_(case_ids)
            ).delete(synchronize_session=False)
            db.query(AppCaseRecord).filter(AppCaseRecord.Id.in_(case_ids)).delete(
                synchronize_session=False
            )

        db.query(AppConsultationFeedback).filter(
            AppConsultationFeedback.ConsultationId.in_(cons_ids)
        ).delete(synchronize_session=False)
        db.query(AppRefundExemption).filter(
            AppRefundExemption.ConsultationId.in_(cons_ids)
        ).delete(synchronize_session=False)
        db.query(AppScheduleCancelLog).filter(
            AppScheduleCancelLog.ConsultationId.in_(cons_ids)
        ).delete(synchronize_session=False)
        db.query(AppRemindTask).filter(AppRemindTask.RelatedId.in_(cons_ids)).delete(
            synchronize_session=False
        )
        db.query(AppMessage).filter(AppMessage.RelatedId.in_(cons_ids)).delete(
            synchronize_session=False
        )
        db.query(AppTask).filter(AppTask.RelatedId.in_(cons_ids)).delete(
            synchronize_session=False
        )
        db.query(AppConsultation).filter(AppConsultation.Id.in_(cons_ids)).delete(
            synchronize_session=False
        )

    # 账号名下订单（含咨询未挂上的）
    for row in db.query(AppOrder.Id).filter(AppOrder.AccountId == account_id).all():
        order_ids.add(row.Id)
    if order_ids:
        db.query(AppMessage).filter(AppMessage.RelatedId.in_(list(order_ids))).delete(
            synchronize_session=False
        )
        db.query(AppOrder).filter(AppOrder.Id.in_(list(order_ids))).delete(
            synchronize_session=False
        )

    # 其它账号指向本测试账号的绑定
    db.query(AppAccount).filter(AppAccount.BoundCounselorId == account_id).update(
        {AppAccount.BoundCounselorId: None},
        synchronize_session=False,
    )


def hard_delete_account(
    db: Session,
    account_id: int,
    *,
    purge_business: bool = False,
    _assessment_table_presence: Optional[tuple[bool, bool]] = None,
) -> None:
    """物理删除账号及可安全移除的附属数据。

    purge_business=True（Tester）：先级联删除咨询/订单/个案等，再删账号。
    """
    if not purge_business:
        reason = hard_delete_blocking_reason(db, account_id)
        if reason:
            raise ValueError(reason)
    else:
        _purge_business_data_for_account(db, account_id)

    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not account:
        raise ValueError("用户不存在")

    # 表结构探测可能使用独立事务；必须在任何删除语句之前完成，避免部分驱动
    # 在探测时回滚当前事务中已经执行的批量删除。
    if _assessment_table_presence is None:
        assessment_report_exists = _orm_table_exists(db, AppAssessmentReport)
        assessment_audit_log_exists = _orm_table_exists(db, AppAssessmentAuditLog)
    else:
        assessment_report_exists, assessment_audit_log_exists = _assessment_table_presence

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
    db.query(AppUserSubscribeAuth).filter(AppUserSubscribeAuth.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppStaffAccountRemark).filter(AppStaffAccountRemark.AccountId == account_id).delete(
        synchronize_session=False
    )
    db.query(AppTask).filter(AppTask.AssistantId == account_id).delete(synchronize_session=False)
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
    # EAP 测评表由 ensure_schema 创建；未建表时跳过，避免 42S02 导致整次删除回滚
    if assessment_report_exists:
        db.query(AppAssessmentReport).filter(AppAssessmentReport.AccountId == account_id).delete(
            synchronize_session=False
        )
    if assessment_audit_log_exists:
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


def is_shell_account(account: AppAccount) -> bool:
    """识别登录/认领流程遗留的无手机号壳账号。

    “未留姓名用户”在部分列表中是空姓名账号的展示兜底，并不一定实际写入
    Nickname，因此这里同时识别空昵称且空真实姓名的账号。
    """
    if (getattr(account, "Mobile", None) or "").strip():
        return False
    nickname = (getattr(account, "Nickname", None) or "").strip()
    real_name = (getattr(account, "RealName", None) or "").strip()
    return (
        nickname == "未留姓名用户"
        or bool(re.fullmatch(r"用户\d+", nickname))
        or (not nickname and not real_name)
    )


def cleanup_shell_accounts(
    db: Session,
    *,
    exclude_account_ids: Optional[set[int]] = None,
) -> dict:
    """物理删除符合命名规则的无手机号壳账号。

    逐个走 hard_delete_account，若账号已有核心业务数据则跳过，避免批量清理
    误删咨询、订单或个案历史。
    """
    excluded = exclude_account_ids or set()
    candidates = (
        db.query(AppAccount)
        .filter(or_(AppAccount.Mobile.is_(None), AppAccount.Mobile == ""))
        .order_by(AppAccount.Id.asc())
        .all()
    )
    # 批量删除前只探测一次，避免每轮表探测影响上一轮尚未提交的删除事务。
    assessment_table_presence = (
        _orm_table_exists(db, AppAssessmentReport),
        _orm_table_exists(db, AppAssessmentAuditLog),
    )
    deleted_ids: list[int] = []
    skipped_ids: list[int] = []
    for account in candidates:
        account_id = int(account.Id)
        if account_id in excluded or not is_shell_account(account):
            continue
        try:
            hard_delete_account(
                db,
                account_id,
                _assessment_table_presence=assessment_table_presence,
            )
            deleted_ids.append(account_id)
        except ValueError:
            skipped_ids.append(account_id)
    return {
        "deletedCount": len(deleted_ids),
        "deletedUserIds": deleted_ids,
        "skippedCount": len(skipped_ids),
        "skippedUserIds": skipped_ids,
    }
