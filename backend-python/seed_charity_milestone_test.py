"""
第 30 次咨询里程碑 — 一键测试数据准备（公益 + 正价配对）。

用法:
  cd backend-python
  python seed_charity_milestone_test.py

写入内容（幂等，可重复执行）:
  【公益】周公益 + 陈启明：29 条 DONE + 明天 11:00 可约（测公益第30次）
  【正价】周正价 + 李心怡：29 条 DONE + 明天 14:00 可约（测正价配对第30次）
  完全重置真实支付产生的第30次、议价状态、里程碑消息、待支付订单

测试步骤见脚本运行结束时的控制台输出。
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from app_time import china_now
from charity_milestone_service import (
    RELATED_TYPE_30TH_BOOKING as CHARITY_BOOKING,
    RELATED_TYPE_30TH_DONE as CHARITY_DONE,
    RELATED_TYPE_PATIENT_NEGOTIATION_TIP,
    charity_negotiation_price_active,
    charity_milestone_reached,
    count_charity_bookings,
    count_charity_completed,
    has_charity_pair_pricing_negotiated,
)
from database import SessionLocal
from models import AppAccount, AppConsultation, AppCounselorPatientPricing, AppCounselorProfile, AppMessage, AppOrder, AppSchedule
from professional_pair_milestone_service import (
    RELATED_TYPE_30TH_BOOKING as PROFESSIONAL_PAIR_BOOKING,
    count_professional_pair_bookings,
    pair_milestone_related_id,
)
from seed_demo_common import (
    DEMO_COUNSELORS,
    ensure_counselor_profile,
    ensure_role,
    get_or_create_counselor_account,
    demo_schedule_note,
)
from sqlalchemy import or_
from staff_remark_service import set_staff_remark
from user_role_meta import is_charity_patient_source

HISTORY_DONE_COUNT = 29
CHARITY_MARKER = "CHARITY_MILESTONE_TEST"
PROFESSIONAL_MARKER = "PROFESSIONAL_MILESTONE_TEST"
PROFESSIONAL_COUNSELOR_STAFF_REMARK = "【里程碑测试】正价第30次预约前请关注抽成比例是否需要调整"

CHARITY_PATIENT_DATA = {
    "mobile": "13800000020",
    "open_id": "demo-openid-patient-charity-test",
    "nickname": "来访·公益测试",
    "real_name": "周公益",
    "gender": "女",
    "patient_source": "CHARITY_VISITOR",
}

PROFESSIONAL_PATIENT_DATA = {
    "mobile": "13800000021",
    "open_id": "demo-openid-patient-professional-milestone-test",
    "nickname": "来访·正价测试",
    "real_name": "周正价",
    "gender": "男",
    "patient_source": "MINI_PROGRAM",
}

CHARITY_COUNSELOR_MOBILE = "13800000013"
CHARITY_COUNSELOR_OPEN_ID = "demo-counselor-chenqiming"
CHARITY_COUNSELOR_NAME = "陈启明"

PROFESSIONAL_COUNSELOR_MOBILE = "13800000001"
PROFESSIONAL_COUNSELOR_OPEN_ID = "demo-counselor-lixinyi"
PROFESSIONAL_COUNSELOR_NAME = "李心怡"


def _find_counselor_data(*, charity: bool) -> dict:
    if charity:
        for item in DEMO_COUNSELORS:
            if item.get("counselor_type") == "CHARITY" or item.get("name") == CHARITY_COUNSELOR_NAME:
                return item
        raise RuntimeError("seed_demo_common 中未找到公益咨询师配置")
    for item in DEMO_COUNSELORS:
        if item.get("name") == PROFESSIONAL_COUNSELOR_NAME:
            return item
        if item.get("counselor_type", "PROFESSIONAL") == "PROFESSIONAL" and item.get("name") != CHARITY_COUNSELOR_NAME:
            return item
    raise RuntimeError("seed_demo_common 中未找到专业咨询师配置")


def get_or_create_test_patient(db, data: dict[str, Any]) -> AppAccount:
    account = db.query(AppAccount).filter(AppAccount.Mobile == data["mobile"]).first()
    if not account:
        account = db.query(AppAccount).filter(AppAccount.OpenId == data["open_id"]).first()
    if account:
        account.OpenId = data["open_id"]
        account.Mobile = data["mobile"]
        account.Nickname = data["nickname"]
        account.RealName = data["real_name"]
        account.Gender = data["gender"]
        account.ActiveRole = "Patient"
        account.PatientSource = data["patient_source"]
        account.IsActive = True
    else:
        account = AppAccount(
            OpenId=data["open_id"],
            Mobile=data["mobile"],
            Nickname=data["nickname"],
            RealName=data["real_name"],
            Gender=data["gender"],
            ActiveRole="Patient",
            PatientSource=data["patient_source"],
            IsActive=True,
        )
        db.add(account)
        db.flush()
    ensure_role(db, account.Id, "Patient")
    return account


def ensure_counselor(
    db,
    *,
    charity: bool,
) -> tuple[AppAccount, AppCounselorProfile]:
    cfg = _find_counselor_data(charity=charity)
    if charity:
        mobile, open_id = CHARITY_COUNSELOR_MOBILE, CHARITY_COUNSELOR_OPEN_ID
        expected_type = "CHARITY"
    else:
        mobile, open_id = PROFESSIONAL_COUNSELOR_MOBILE, PROFESSIONAL_COUNSELOR_OPEN_ID
        expected_type = "PROFESSIONAL"
    account = get_or_create_counselor_account(
        db,
        mobile,
        open_id,
        f"咨询师·{cfg['name']}",
    )
    ensure_role(db, account.Id, "Counselor")
    ensure_counselor_profile(db, account.Id, cfg)
    profile = (
        db.query(AppCounselorProfile)
        .filter(AppCounselorProfile.AccountId == account.Id)
        .first()
    )
    if not profile or (profile.CounselorType or "PROFESSIONAL") != expected_type:
        raise RuntimeError(f"{'公益' if charity else '专业'}咨询师档案未正确创建")
    return account, profile


def _reset_consultations_and_orders(
    db,
    patient_id: int,
    counselor_id: int,
) -> dict[str, int]:
    stats = {"consultations": 0, "orders": 0, "schedules": 0}

    consults = (
        db.query(AppConsultation)
        .filter(
            AppConsultation.PatientId == patient_id,
            AppConsultation.CounselorId == counselor_id,
        )
        .all()
    )
    schedule_ids = {c.ScheduleId for c in consults if c.ScheduleId}
    for row in consults:
        db.delete(row)
        stats["consultations"] += 1

    pending_orders = (
        db.query(AppOrder)
        .filter(
            AppOrder.AccountId == patient_id,
            AppOrder.Status == "PENDING",
        )
        .all()
    )
    for row in pending_orders:
        db.delete(row)
        stats["orders"] += 1

    for schedule_id in schedule_ids:
        schedule = db.query(AppSchedule).filter(AppSchedule.Id == schedule_id).first()
        if schedule and schedule.CounselorId == counselor_id:
            schedule.Status = "AVAILABLE"
            stats["schedules"] += 1

    return stats


def reset_charity_milestone_state(
    db,
    patient_id: int,
    counselor_id: int,
) -> dict[str, int]:
    """完全重置公益来访里程碑测试状态。"""
    stats = _reset_consultations_and_orders(db, patient_id, counselor_id)
    stats["messages"] = 0

    patient = db.query(AppAccount).filter(AppAccount.Id == patient_id).first()
    if patient:
        patient.CharityPricingNegotiatedAt = None

    pricing_rows = (
        db.query(AppCounselorPatientPricing)
        .filter(AppCounselorPatientPricing.PatientAccountId == patient_id)
        .all()
    )
    for row in pricing_rows:
        db.delete(row)
        stats["pricing_rows"] = stats.get("pricing_rows", 0) + 1

    milestone_types = [CHARITY_BOOKING, CHARITY_DONE, RELATED_TYPE_PATIENT_NEGOTIATION_TIP]
    message_rows = (
        db.query(AppMessage)
        .filter(
            or_(
                AppMessage.RelatedType.in_(milestone_types),
                AppMessage.RelatedType == RELATED_TYPE_PATIENT_NEGOTIATION_TIP,
            ),
            or_(
                AppMessage.RelatedId == patient_id,
                AppMessage.AccountId == patient_id,
            ),
        )
        .all()
    )
    for row in message_rows:
        db.delete(row)
        stats["messages"] += 1

    return stats


def reset_professional_pair_state(
    db,
    patient_id: int,
    counselor_id: int,
) -> dict[str, int]:
    """完全重置正价配对里程碑测试状态。"""
    stats = _reset_consultations_and_orders(db, patient_id, counselor_id)
    stats["messages"] = 0

    pair_related_id = pair_milestone_related_id(patient_id, counselor_id)
    message_rows = (
        db.query(AppMessage)
        .filter(
            AppMessage.RelatedType == PROFESSIONAL_PAIR_BOOKING,
            AppMessage.RelatedId == pair_related_id,
        )
        .all()
    )
    for row in message_rows:
        db.delete(row)
        stats["messages"] += 1

    return stats


def seed_done_history(
    db,
    patient_id: int,
    counselor_id: int,
    *,
    marker: str,
    count: int = HISTORY_DONE_COUNT,
) -> int:
    now = china_now()
    base = now - timedelta(days=count + 3)
    created = 0
    for i in range(count):
        start = (base + timedelta(days=i)).replace(minute=0, second=0, microsecond=0)
        end = start + timedelta(minutes=50)
        note = demo_schedule_note("video", status="BOOKED") + f"|{marker}|done"
        db.add(
            AppConsultation(
                PatientId=patient_id,
                CounselorId=counselor_id,
                Status="DONE",
                StartTime=start,
                EndTime=end,
                Note=note,
                CreatedAt=start - timedelta(hours=2),
            )
        )
        created += 1
    return created


def ensure_bookable_slot(
    db,
    counselor_id: int,
    *,
    marker: str,
    hour: int,
) -> AppSchedule:
    now = china_now()
    start = (now + timedelta(days=1)).replace(hour=hour, minute=0, second=0, microsecond=0)
    end = start + timedelta(minutes=50)
    note = demo_schedule_note("video", status="AVAILABLE") + f"|{marker}|slot"

    row = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.CounselorId == counselor_id,
            AppSchedule.StartTime == start,
        )
        .first()
    )
    if not row:
        row = AppSchedule(
            CounselorId=counselor_id,
            StartTime=start,
            EndTime=end,
        )
        db.add(row)
    row.EndTime = end
    row.Status = "AVAILABLE"
    row.Note = note
    db.flush()
    return row


def _staff_remark_editor_id(db) -> int:
    from models import AppRoleBinding

    row = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType == "Admin")
        .first()
    )
    if row:
        return row[0]
    row = (
        db.query(AppRoleBinding.AccountId)
        .filter(AppRoleBinding.RoleType == "Assistant")
        .first()
    )
    return row[0] if row else 1


def ensure_professional_counselor_staff_remark(db, counselor_id: int) -> None:
    editor_id = _staff_remark_editor_id(db)
    set_staff_remark(db, counselor_id, PROFESSIONAL_COUNSELOR_STAFF_REMARK, editor_id)


def _print_reset_line(label: str, stats: dict[str, int]) -> None:
    if not any(stats.values()):
        return
    print(
        f"[INFO] {label} 已重置: "
        f"咨询 {stats['consultations']} 条, "
        f"待支付订单 {stats['orders']} 条, "
        f"里程碑消息 {stats.get('messages', 0)} 条, "
        f"排班 {stats['schedules']} 个恢复可约"
    )


def _print_summary(
    *,
    charity_patient: AppAccount,
    charity_counselor: AppAccount,
    charity_profile: AppCounselorProfile,
    charity_slot: AppSchedule,
    professional_patient: AppAccount,
    professional_counselor: AppAccount,
    professional_profile: AppCounselorProfile,
    professional_slot: AppSchedule,
    db,
) -> None:
    charity_bookings = count_charity_bookings(db, charity_patient.Id)
    charity_done = count_charity_completed(db, charity_patient.Id)
    pro_pair_bookings = count_professional_pair_bookings(
        db, professional_patient.Id, professional_counselor.Id
    )
    charity_slot_time = charity_slot.StartTime.strftime("%Y-%m-%d %H:%M") if charity_slot.StartTime else "—"
    pro_slot_time = professional_slot.StartTime.strftime("%Y-%m-%d %H:%M") if professional_slot.StartTime else "—"

    print("")
    print("=" * 60)
    print("[OK] 第30次里程碑测试数据已就绪（公益 + 正价）")
    print("=" * 60)

    print("\n── 公益咨询（来访 × 公益咨询师）──")
    print(f"  来访 ID: {charity_patient.Id}  姓名: {charity_patient.RealName}  手机: {charity_patient.Mobile}")
    print(f"  来访来源: {charity_patient.PatientSource} ({'公益' if is_charity_patient_source(charity_patient.PatientSource) else '非公益'})")
    print(f"  咨询师: {charity_profile.Name} (ID {charity_counselor.Id})")
    print(f"  公益预约数: {charity_bookings}  完成数: {charity_done}  议价阶段: {'是' if charity_milestone_reached(db, charity_patient.Id) else '否'}")
    negotiated = has_charity_pair_pricing_negotiated(db, charity_patient.Id, charity_counselor.Id)
    print(f"  与陈启明议价完成: {'是' if negotiated else '否'}（定价管理保存后应为是）")
    print(f"  可约 ScheduleId: {charity_slot.Id}  时间: {charity_slot_time}")

    print("\n── 正价咨询（来访 × 专业咨询师 配对）──")
    print(f"  来访 ID: {professional_patient.Id}  姓名: {professional_patient.RealName}  手机: {professional_patient.Mobile}")
    print(f"  来访来源: {professional_patient.PatientSource}")
    print(f"  咨询师: {professional_profile.Name} (ID {professional_counselor.Id})")
    print(f"  配对预约数: {pro_pair_bookings}  （支付第30次后应为 30）")
    print(f"  可约 ScheduleId: {professional_slot.Id}  时间: {pro_slot_time}")
    print(f"  咨询师测试备注: {PROFESSIONAL_COUNSELOR_STAFF_REMARK}")

    print("\n── 测试步骤 ──")
    print("【公益第30次】")
    print("  1. DevRolePicker →「来访·公益测试」(dev_patient_charity_test)")
    print("  2. 预约「陈启明」→ 明天 11:00 → 模拟支付")
    print("  3. 助理/主任/管理员 → 我的消息 →「公益咨询第30次预约」")
    print("  4. 完成第30次咨询 → 收到「公益咨询第30次完成」")
    print("")
    print("【正价配对第30次】")
    print("  1. DevRolePicker →「来访·正价测试」(dev_patient_professional_milestone_test)")
    print("  2. 预约「李心怡」→ 明天 14:00 → 模拟支付")
    print("  3. 助理/主任/管理员 → 我的消息 →「正价咨询第30次预约」（含咨询师备注）")
    print("")
    print("  重复测试: 再次运行本脚本会完全重置两套数据")
    print("=" * 60)


def main() -> None:
    db = SessionLocal()
    try:
        charity_patient = get_or_create_test_patient(db, CHARITY_PATIENT_DATA)
        professional_patient = get_or_create_test_patient(db, PROFESSIONAL_PATIENT_DATA)
        charity_counselor, charity_profile = ensure_counselor(db, charity=True)
        professional_counselor, professional_profile = ensure_counselor(db, charity=False)

        charity_reset = reset_charity_milestone_state(
            db, charity_patient.Id, charity_counselor.Id
        )
        pro_reset = reset_professional_pair_state(
            db, professional_patient.Id, professional_counselor.Id
        )

        charity_created = seed_done_history(
            db,
            charity_patient.Id,
            charity_counselor.Id,
            marker=CHARITY_MARKER,
        )
        pro_created = seed_done_history(
            db,
            professional_patient.Id,
            professional_counselor.Id,
            marker=PROFESSIONAL_MARKER,
        )

        charity_slot = ensure_bookable_slot(
            db, charity_counselor.Id, marker=CHARITY_MARKER, hour=11
        )
        professional_slot = ensure_bookable_slot(
            db, professional_counselor.Id, marker=PROFESSIONAL_MARKER, hour=14
        )
        ensure_professional_counselor_staff_remark(db, professional_counselor.Id)

        db.commit()

        _print_reset_line("公益", charity_reset)
        _print_reset_line("正价", pro_reset)
        print(f"[OK] 已写入公益 DONE 历史 {charity_created} 条、正价配对 DONE 历史 {pro_created} 条")

        _print_summary(
            charity_patient=charity_patient,
            charity_counselor=charity_counselor,
            charity_profile=charity_profile,
            charity_slot=charity_slot,
            professional_patient=professional_patient,
            professional_counselor=professional_counselor,
            professional_profile=professional_profile,
            professional_slot=professional_slot,
            db=db,
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
