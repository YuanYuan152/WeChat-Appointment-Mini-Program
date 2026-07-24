"""账号注销：

- soft_delete_account：用户自主注销（微信合规）。清空可识别身份字段，但保留
  AppAccount 主键及咨询/订单/个案等业务行，供合规追溯。
- hard_delete_account：仅管理员在无核心业务数据时物理删除。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import (
    AppAccount,
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

    return None


def hard_delete_account(db: Session, account_id: int) -> None:
    """物理删除账号及可安全移除的附属数据（无咨询/已支付订单等核心记录）。"""
    reason = hard_delete_blocking_reason(db, account_id)
    if reason:
        raise ValueError(reason)

    account = db.query(AppAccount).filter(AppAccount.Id == account_id).first()
    if not account:
        raise ValueError("用户不存在")

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
