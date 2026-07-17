"""来访者签约状态与绑定咨询师。"""
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app_time import china_now
from models import (
    AppAccount,
    AppConsultation,
    AppCounselorProfile,
    AppOrder,
    AppRoleBinding,
    AppSchedule,
)


COUNSELOR_UNAVAILABLE_FOR_PAYMENT = (
    "咨询师账号已停用或不可预约，该订单已失效，请联系助理重新预约"
)


def acquire_patient_contract_lock(db: Session, patient_id: int) -> None:
    """串行化同一来访的换绑、代理下单与支付确认。"""
    bind = db.get_bind()
    if not bind or bind.dialect.name != "mssql":
        return
    result = db.execute(
        text(
            "SET NOCOUNT ON; DECLARE @result int; "
            "EXEC @result = sys.sp_getapplock "
            "@Resource=:resource, @LockMode='Exclusive', "
            "@LockOwner='Transaction', @LockTimeout=10000; "
            "SELECT @result"
        ),
        {"resource": f"patient-contract:{int(patient_id)}"},
    ).scalar()
    if result is None or int(result) < 0:
        raise ValueError("该来访的签约状态正在更新，请稍后重试")


def assert_counselor_active_for_booking(db: Session, counselor_id: int) -> None:
    """支付及预约落单前复核咨询师仍具有完整、可用的咨询师身份。"""
    counselor_id = int(counselor_id)
    account = (
        db.query(AppAccount.Id)
        .filter(
            AppAccount.Id == counselor_id,
            AppAccount.IsActive == True,
        )
        .first()
    )
    role = (
        db.query(AppRoleBinding.Id)
        .filter(
            AppRoleBinding.AccountId == counselor_id,
            AppRoleBinding.RoleType == "Counselor",
        )
        .first()
    )
    profile = (
        db.query(AppCounselorProfile.Id)
        .filter(
            AppCounselorProfile.AccountId == counselor_id,
            AppCounselorProfile.IsActive == True,
        )
        .first()
    )
    if not account or not role or not profile:
        raise ValueError(COUNSELOR_UNAVAILABLE_FOR_PAYMENT)


def retire_counselor_booking_relationships(
    db: Session,
    counselor_id: int,
) -> Dict[str, int]:
    """咨询师停用、改角色或删除前，事务内清理仍可支付的业务关系。

    调用方负责在同一个事务内完成咨询师状态变更并提交。通过来访级应用锁，
    该清理与代理下单、换绑和支付完成使用同一套串行化边界。
    """
    counselor_id = int(counselor_id)
    schedule_ids = [
        int(row[0])
        for row in (
            db.query(AppSchedule.Id)
            .filter(AppSchedule.CounselorId == counselor_id)
            .all()
        )
    ]
    bound_patient_ids = {
        int(row[0])
        for row in (
            db.query(AppAccount.Id)
            .filter(AppAccount.BoundCounselorId == counselor_id)
            .all()
        )
    }
    pending_patient_ids: set[int] = set()
    if schedule_ids:
        pending_patient_ids = {
            int(row[0])
            for row in (
                db.query(AppOrder.AccountId)
                .filter(
                    AppOrder.SlotId.in_(schedule_ids),
                    AppOrder.Status == "PENDING",
                )
                .distinct()
                .all()
            )
        }

    for patient_id in sorted(bound_patient_ids | pending_patient_ids):
        acquire_patient_contract_lock(db, patient_id)

    # 获取锁后重新查询，避免使用等待锁期间已经变化的绑定或订单状态。
    business_now = china_now()
    future_booked_schedule = (
        db.query(AppSchedule.Id)
        .filter(
            AppSchedule.CounselorId == counselor_id,
            AppSchedule.Status == "BOOKED",
            AppSchedule.EndTime >= business_now,
        )
        .first()
    )
    future_paid_order = (
        db.query(AppOrder.Id)
        .join(AppSchedule, AppSchedule.Id == AppOrder.SlotId)
        .filter(
            AppSchedule.CounselorId == counselor_id,
            AppSchedule.EndTime >= business_now,
            AppOrder.Status == "PAID",
        )
        .first()
    )
    future_consultation = (
        db.query(AppConsultation.Id)
        .filter(
            AppConsultation.CounselorId == counselor_id,
            or_(
                AppConsultation.EndTime >= business_now,
                AppConsultation.StartTime >= business_now,
            ),
            AppConsultation.Status.in_(("PENDING", "CONFIRMED", "ONGOING")),
        )
        .first()
    )
    if future_booked_schedule or future_paid_order or future_consultation:
        raise ValueError(
            "该咨询师仍有未完成的预约，请先完成改约、取消及退款处理后再停用或更换角色"
        )

    patients = (
        db.query(AppAccount)
        .filter(AppAccount.BoundCounselorId == counselor_id)
        .order_by(AppAccount.Id.asc())
        .all()
    )
    pending_orders = []
    if schedule_ids:
        pending_orders = (
            db.query(AppOrder)
            .filter(
                AppOrder.SlotId.in_(schedule_ids),
                AppOrder.Status == "PENDING",
            )
            .order_by(AppOrder.Id.asc())
            .all()
        )

    from proxy_booking_service import _cancel_pending_proxy_order

    now = datetime.utcnow()
    cancelled_orders = 0
    for order in pending_orders:
        if (order.Description or "").startswith("proxy:"):
            _cancel_pending_proxy_order(db, order)
        else:
            order.Status = "CANCELLED"
            order.UpdatedAt = now
        cancelled_orders += 1

    for patient in patients:
        patient.BoundCounselorId = None
        patient.IsContractSigned = False
        patient.BoundCounselorChangedAt = now

    future_available_schedules = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.CounselorId == counselor_id,
            AppSchedule.Status == "AVAILABLE",
            AppSchedule.StartTime >= business_now,
        )
        .all()
    )
    for schedule in future_available_schedules:
        schedule.Status = "CANCELLED"
        schedule.UpdatedAt = business_now

    if patients or pending_orders or future_available_schedules:
        db.flush()
    return {
        "unboundPatients": len(patients),
        "cancelledPendingOrders": cancelled_orders,
        "cancelledFutureSchedules": len(future_available_schedules),
    }


def _base_patient_name(account: Optional[AppAccount]) -> str:
    if not account:
        return "来访者"
    return (account.RealName or account.Nickname or account.Mobile or "来访者").strip()


def _counselor_name(db: Session, counselor_id: Optional[int]) -> Optional[str]:
    if not counselor_id:
        return None
    prof = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == counselor_id)
        .first()
    )
    if prof and prof.Name:
        return prof.Name
    acc = db.query(AppAccount).filter(AppAccount.Id == counselor_id).first()
    if not acc:
        return f"咨询师#{counselor_id}"
    return acc.RealName or acc.Nickname or acc.Mobile or f"咨询师#{counselor_id}"


def patient_contract_tag(
    *,
    is_contract_signed: bool,
    bound_counselor_name: Optional[str],
) -> Optional[str]:
    if is_contract_signed and bound_counselor_name:
        return f"已签约-【{bound_counselor_name}】"
    return None


def effective_contract_signed(
    db: Session,
    account: Optional[AppAccount],
) -> bool:
    """是否签约：须已绑定咨询师且库内 IsContractSigned 为真。"""
    if not account:
        return False
    if not getattr(account, "BoundCounselorId", None):
        return False
    return bool(getattr(account, "IsContractSigned", False))


def patient_contract_extras(db: Session, account: Optional[AppAccount]) -> Dict[str, Any]:
    if not account:
        return {
            "isContractSigned": False,
            "boundCounselorId": None,
            "boundCounselorName": None,
            "contractTag": None,
        }
    bound_id = getattr(account, "BoundCounselorId", None)
    is_signed = effective_contract_signed(db, account)
    bound_name = _counselor_name(db, bound_id)
    tag = patient_contract_tag(is_contract_signed=is_signed, bound_counselor_name=bound_name)
    return {
        "isContractSigned": is_signed,
        "boundCounselorId": bound_id,
        "boundCounselorName": bound_name,
        "contractTag": tag,
    }


def batch_patient_contract_extras(
    db: Session,
    accounts: list[AppAccount],
) -> Dict[int, Dict[str, Any]]:
    if not accounts:
        return {}
    counselor_ids = {
        int(getattr(a, "BoundCounselorId"))
        for a in accounts
        if getattr(a, "BoundCounselorId", None)
    }
    counselor_names: Dict[int, str] = {}
    if counselor_ids:
        profiles = (
            db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId.in_(counselor_ids))
            .all()
        )
        for prof in profiles:
            counselor_names[int(prof.AccountId)] = prof.Name or f"咨询师#{prof.AccountId}"
        missing = counselor_ids - set(counselor_names)
        if missing:
            for acc in db.query(AppAccount).filter(AppAccount.Id.in_(missing)).all():
                counselor_names[int(acc.Id)] = (
                    acc.RealName or acc.Nickname or acc.Mobile or f"咨询师#{acc.Id}"
                )

    out: Dict[int, Dict[str, Any]] = {}
    for account in accounts:
        bound_id = getattr(account, "BoundCounselorId", None)
        is_signed = effective_contract_signed(db, account)
        bound_name = counselor_names.get(int(bound_id)) if bound_id else None
        out[int(account.Id)] = {
            "isContractSigned": is_signed,
            "boundCounselorId": bound_id,
            "boundCounselorName": bound_name,
            "contractTag": patient_contract_tag(
                is_contract_signed=is_signed,
                bound_counselor_name=bound_name,
            ),
        }
    return out


def patient_display_name(
    db: Session,
    account: Optional[AppAccount],
    *,
    with_contract_tag: bool = True,
) -> str:
    name = _base_patient_name(account)
    if not with_contract_tag or not account:
        return name
    extras = patient_contract_extras(db, account)
    tag = extras.get("contractTag")
    if tag:
        return f"{name} {tag}"
    return name


def bind_patient_counselor(
    db: Session,
    patient_id: int,
    counselor_id: Optional[int],
) -> AppAccount:
    """绑定/更换/解除咨询师；绑定关系变化后必须重新签约。"""
    acquire_patient_contract_lock(db, patient_id)
    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if not patient:
        raise ValueError("来访者不存在")

    new_id = int(counselor_id) if counselor_id else None
    if new_id:
        counselor_account = (
            db.query(AppAccount)
            .filter(AppAccount.Id == new_id, AppAccount.IsActive == True)
            .first()
        )
        if not counselor_account:
            raise ValueError("咨询师不存在或已停用")
        binding = (
            db.query(AppRoleBinding)
            .filter(
                AppRoleBinding.AccountId == new_id,
                AppRoleBinding.RoleType == "Counselor",
            )
            .first()
        )
        if not binding:
            raise ValueError("咨询师不存在")
        profile = (
            db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == new_id, AppCounselorProfile.IsActive == True)
            .first()
        )
        if not profile:
            raise ValueError("咨询师档案不存在或已停用")

    old_value = getattr(patient, "BoundCounselorId", None)
    old_id = int(old_value) if old_value else None
    if old_id != new_id:
        from proxy_booking_service import cancel_pending_proxy_orders_for_patient

        cancel_pending_proxy_orders_for_patient(
            db,
            patient_id,
            keep_counselor_id=new_id,
        )

        patient.BoundCounselorId = new_id
        patient.IsContractSigned = False
        patient.BoundCounselorChangedAt = datetime.utcnow()
    db.flush()
    return patient


def _paid_order_counselor_id(db: Session, order: AppOrder) -> Optional[int]:
    if not order.SlotId:
        return None
    schedule = db.query(AppSchedule).filter(AppSchedule.Id == order.SlotId).first()
    return int(schedule.CounselorId) if schedule and schedule.CounselorId else None


def sync_patient_contract_signed_from_orders(db: Session, patient_id: int) -> bool:
    """修复当前绑定建立后的支付签约状态，不采纳绑定前历史订单。

    正常支付通过 :func:`maybe_mark_patient_contract_signed` 实时签约。这个
    函数只用于显式修复，且必须有可证明晚于当前绑定变更时间的 ``PaidAt``。
    """
    account = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if not account:
        raise ValueError("来访者不存在")

    bound_id = getattr(account, "BoundCounselorId", None)
    if not bound_id:
        account.IsContractSigned = False
        db.flush()
        return False

    binding_changed_at = getattr(account, "BoundCounselorChangedAt", None)
    if not binding_changed_at:
        # 存量数据无法证明订单发生在当前绑定之后，保留现状而不从历史订单
        # 推导新的签约状态。
        return bool(account.IsContractSigned)

    has_paid_order = (
        db.query(AppOrder.Id)
        .join(AppSchedule, AppSchedule.Id == AppOrder.SlotId)
        .filter(
            AppOrder.AccountId == patient_id,
            AppOrder.PaidAt.isnot(None),
            AppOrder.PaidAt >= binding_changed_at,
            AppSchedule.CounselorId == int(bound_id),
        )
        .first()
        is not None
    )
    if has_paid_order:
        account.IsContractSigned = True
        db.flush()
    return bool(account.IsContractSigned)


def backfill_patient_contract_signed_from_orders(db: Session) -> int:
    """显式修复绑定变更后已有真实支付、但尚未签约的异常数据。

    不再在服务启动时调用；绑定前的历史订单和缺少 ``PaidAt`` 的旧订单均
    不参与，避免换绑后状态被重新提升。
    """
    accounts = (
        db.query(AppAccount)
        .join(AppOrder, AppOrder.AccountId == AppAccount.Id)
        .join(AppSchedule, AppSchedule.Id == AppOrder.SlotId)
        .filter(
            AppAccount.BoundCounselorId.isnot(None),
            AppAccount.BoundCounselorChangedAt.isnot(None),
            # SQL Server 的 BIT 列不能使用 ``IS 0``；布尔等值比较会正确
            # 编译为 ``= 0``，同时兼容 SQLite 单元测试。
            AppAccount.IsContractSigned == False,
            AppOrder.PaidAt.isnot(None),
            AppOrder.PaidAt >= AppAccount.BoundCounselorChangedAt,
            AppSchedule.CounselorId == AppAccount.BoundCounselorId,
        )
        .distinct()
        .all()
    )
    for account in accounts:
        account.IsContractSigned = True
    if accounts:
        db.flush()
    return len(accounts)


def maybe_mark_patient_contract_signed(
    db: Session,
    order: AppOrder,
    *,
    paid_at: datetime,
) -> None:
    """真实支付由 ``PENDING`` 转为 ``PAID`` 时标记当前绑定为已签约。"""
    if order.Status != "PENDING":
        return
    account = db.query(AppAccount).filter(AppAccount.Id == order.AccountId).first()
    if not account or not getattr(account, "BoundCounselorId", None):
        return

    counselor_id = _paid_order_counselor_id(db, order)
    bound_id = int(account.BoundCounselorId)
    if not counselor_id or counselor_id != bound_id:
        return

    binding_changed_at = getattr(account, "BoundCounselorChangedAt", None)
    if binding_changed_at and paid_at < binding_changed_at:
        return

    account.IsContractSigned = True
    db.flush()


def patient_can_self_book_counselor(
    db: Session,
    account: Optional[AppAccount],
    counselor_id: int,
) -> bool:
    """来访已签约且当前咨询师为绑定咨询师时，方可自助预约。"""
    if not account:
        return False
    bound_id = getattr(account, "BoundCounselorId", None)
    if not bound_id or int(bound_id) != int(counselor_id):
        return False
    return effective_contract_signed(db, account)


def assert_patient_can_self_book(
    db: Session,
    patient_id: int,
    counselor_id: int,
) -> None:
    account = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if patient_can_self_book_counselor(db, account, counselor_id):
        return
    raise ValueError("您尚未完成签约绑定，请联系咨询助理完成首次预约")
