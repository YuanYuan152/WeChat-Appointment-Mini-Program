"""
seed_demo_*.py 公共常量与排班 Note 规则（与 auth.py / schedule_meta.py 对齐）。

主入口：python seed_demo_data.py（增量写入，不清表）
单角色脚本：seed_demo_counselor.py 等（会 clear_all_tables，仅用于隔离测试）
"""
from datetime import datetime, timedelta
from typing import Optional

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
from schedule_meta import (
    is_video_center,
    schedule_note,
    schedule_pref_note,
)

# ---------------------------------------------------------------------------
# 与 auth.py DEV_MOCK_CODE_OPENIDS 对齐的演示账号
# ---------------------------------------------------------------------------

DEMO_PATIENTS = [
    {
        "mobile": "13800000010",
        "open_id": "demo-openid-patient-xiaomei",
        "nickname": "来访·小美",
        "real_name": "林小美",
        "gender": "女",
        "avatar": "/static/images/tc59.png",
        "consultations": ["refund_ok", "no_refund"],
    },
    {
        "mobile": "13800000011",
        "open_id": "demo-openid-patient-xiaogang",
        "nickname": "来访·小刚",
        "real_name": "赵小刚",
        "gender": "男",
        "avatar": "/static/images/tc59.png",
        "consultations": ["pending"],
    },
    {
        "mobile": "13800000012",
        "open_id": "demo-openid-patient-xiaoli",
        "nickname": "来访·小丽",
        "real_name": "何小丽",
        "gender": "女",
        "avatar": "/static/images/tc59.png",
        "consultations": ["done"],
    },
]

DEMO_COUNSELORS = [
    {
        "mobile": "13800000001",
        "open_id": "demo-counselor-lixinyi",
        "name": "李心怡",
        "avatar": "/static/images/zixunshi11.png",
        "title": "国家二级心理咨询师",
        "specialty": "亲子关系｜婚姻情感｜情绪压力",
        "field": "家庭治疗,婚姻情感,情绪压力,亲子关系",
        "introduce": "从业 9 年，专注家庭与亲密关系咨询，帮助来访者梳理情绪、重建沟通。",
        "career": "曾任三甲医院心理科咨询师，长期接受专业督导，年均接案 600+ 小时。",
        "qualification": "国家二级心理咨询师；中国心理学会注册系统助理心理师",
        "billing": 60000,
        "consult_hours": 3200,
        "work_years": 9,
        "slots": [
            {"days": 1, "hour": 10, "center": "yangpu", "status": "BOOKED", "room": "yangpu-r1"},
            {"days": 2, "hour": 9, "center": "yangpu", "status": "AVAILABLE", "pref": "yangpu-r2"},
            {"days": 2, "hour": 14, "center": "pudong", "status": "AVAILABLE"},
        ],
    },
    {
        "mobile": "13800000002",
        "open_id": "demo-counselor-zhangmingyuan",
        "name": "张明远",
        "avatar": "/static/images/tc59.png",
        "title": "国家三级心理咨询师",
        "specialty": "青少年心理｜学业压力｜个人成长",
        "field": "青少年心理,学业发展,个人成长,人际关系",
        "introduce": "擅长与青少年及家长工作，关注学业压力、同伴关系与自我认同议题。",
        "career": "学校心理辅导专项培训结业，多年青少年个案经验。",
        "qualification": "国家三级心理咨询师；学校心理辅导专项培训结业",
        "billing": 55000,
        "consult_hours": 2100,
        "work_years": 7,
        "slots": [
            {"days": 1, "hour": 11, "center": "yangpu", "status": "AVAILABLE"},
            {"days": 2, "hour": 14, "center": "pudong", "status": "BOOKED", "room": "pudong-r2"},
            {"days": 3, "hour": 16, "center": "pudong", "status": "AVAILABLE", "pref": "pudong-r1"},
        ],
    },
    {
        "mobile": "13800000003",
        "open_id": "demo-counselor-wangwanqing",
        "name": "王婉清",
        "avatar": "/static/images/zixunshi11.png",
        "title": "国家二级心理咨询师",
        "specialty": "职场压力｜焦虑抑郁｜睡眠困扰",
        "field": "职场压力,焦虑抑郁,睡眠困扰,个人成长",
        "introduce": "聚焦职场人群的情绪管理与身心调适，整合认知行为与正念取向干预。",
        "career": "正念减压（MBSR）受训背景，擅长压力与睡眠相关议题。",
        "qualification": "国家二级心理咨询师；正念减压（MBSR）受训背景",
        "billing": 68000,
        "consult_hours": 4500,
        "work_years": 11,
        "slots": [
            {"days": 1, "hour": 15, "center": "yangpu", "status": "AVAILABLE"},
            {"days": 2, "hour": 10, "center": "pudong", "status": "AVAILABLE"},
            {"days": 3, "hour": 19, "center": "pudong", "status": "AVAILABLE"},
        ],
    },
    {
        "mobile": "13800000013",
        "open_id": "demo-counselor-chenqiming",
        "name": "陈启明",
        "avatar": "/static/images/doctor2.jpg",
        "title": "国家二级心理咨询师",
        "specialty": "创伤疗愈｜情绪调节｜自我探索",
        "field": "创伤疗愈,情绪调节,自我探索,人际关系",
        "introduce": "整合人本与叙事取向，陪伴来访者处理过往创伤、重建自我认同与边界感。",
        "career": "多年一线咨询经验，持续接受注册系统督导与创伤取向培训。",
        "qualification": "国家二级心理咨询师；叙事治疗连续培训结业",
        "billing": 62000,
        "consult_hours": 2800,
        "work_years": 8,
        "slots": [
            {"days": 1, "hour": 13, "center": "yangpu", "status": "AVAILABLE", "pref": "yangpu-r3"},
            {"days": 2, "hour": 11, "center": "video", "status": "AVAILABLE"},
            {"days": 2, "hour": 15, "center": "video", "status": "BOOKED"},
            {"days": 3, "hour": 15, "center": "yangpu", "status": "AVAILABLE"},
        ],
    },
]

DEMO_STAFF_ACCOUNTS = [
    {"mobile": "13800000004", "open_id": "demo-openid-assistant", "name": "演示助理", "role": "Assistant"},
    {"mobile": "13800000005", "open_id": "demo-openid-ops", "name": "演示运营", "role": "Ops"},
    {"mobile": "13800000006", "open_id": "demo-openid-admin", "name": "演示管理员", "role": "Admin"},
]

# 演示来访者咨询记录（我的咨询记录 + 取消/退款规则）
DEMO_PATIENT_CONSULTATIONS = [
    {
        "key": "refund_ok",
        "counselor": "王婉清",
        "offset": timedelta(days=3),
        "center": "yangpu",
        "status": "CONFIRMED",
        "billing": 68000,
        "room": "yangpu-r2",
    },
    {
        "key": "no_refund",
        "counselor": "李心怡",
        "offset": timedelta(hours=10),
        "center": "pudong",
        "status": "CONFIRMED",
        "billing": 60000,
        "room": "pudong-r1",
    },
    {
        "key": "pending",
        "counselor": "张明远",
        "offset": timedelta(days=2),
        "center": "pudong",
        "status": "PENDING",
        "billing": 55000,
        "room": "pudong-r3",
    },
    {
        "key": "done",
        "counselor": "王婉清",
        "offset": timedelta(days=-7),
        "center": "pudong",
        "status": "DONE",
        "billing": 68000,
        "room": "pudong-r1",
    },
    {
        "key": "video_confirmed",
        "counselor": "陈启明",
        "offset": timedelta(days=2, hours=1),
        "center": "video",
        "status": "CONFIRMED",
        "billing": 62000,
    },
]

DEMO_CENTER_DEFAULT_ROOM = {
    "yangpu": "yangpu-r1",
    "pudong": "pudong-r1",
}


def demo_schedule_note(
    center_id: str,
    *,
    status: str = "AVAILABLE",
    pref: Optional[str] = None,
    room: Optional[str] = None,
) -> str:
    """
    构建排班/咨询单 Note：
    - AVAILABLE：center + 可选 pref（视频咨询无 pref）
    - BOOKED：center + room（视频咨询无 room，模拟付款后占用咨询室）
    """
    if is_video_center(center_id):
        return schedule_note(center_id)
    if status == "BOOKED":
        assigned = room or DEMO_CENTER_DEFAULT_ROOM.get(center_id)
        return schedule_note(center_id, assigned) if assigned else schedule_note(center_id)
    return schedule_pref_note(center_id, pref)


def consultation_note_from_schedule(schedule: AppSchedule) -> str:
    return schedule.Note or ""


def _slot_start_from_offset(now: datetime, offset: timedelta) -> datetime:
    start = now + offset
    return start.replace(minute=0, second=0, microsecond=0)


# ---------------------------------------------------------------------------
# 账号与排班写入（seed_demo_data 与各单角色脚本共用）
# ---------------------------------------------------------------------------

def get_or_create_demo_patient(db: Session, data: dict) -> AppAccount:
    account = db.query(AppAccount).filter(AppAccount.Mobile == data["mobile"]).first()
    if not account:
        account = db.query(AppAccount).filter(AppAccount.OpenId == data["open_id"]).first()
    if account:
        account.OpenId = data["open_id"]
        account.Mobile = data["mobile"]
        account.Nickname = data["nickname"]
        account.AvatarUrl = data.get("avatar", "/static/images/tc59.png")
        account.ActiveRole = "Patient"
        account.RealName = data["real_name"]
        account.Gender = data["gender"]
        account.IsActive = True
        return account
    account = AppAccount(
        OpenId=data["open_id"],
        Mobile=data["mobile"],
        Nickname=data["nickname"],
        AvatarUrl=data.get("avatar", "/static/images/tc59.png"),
        ActiveRole="Patient",
        RealName=data["real_name"],
        Gender=data["gender"],
    )
    db.add(account)
    db.flush()
    return account


def get_or_create_staff_account(
    db: Session, mobile: str, open_id: str, nickname: str, active_role: str,
) -> AppAccount:
    account = db.query(AppAccount).filter(AppAccount.Mobile == mobile).first()
    if not account:
        account = db.query(AppAccount).filter(AppAccount.OpenId == open_id).first()
    if account:
        account.OpenId = open_id
        account.Mobile = mobile
        account.Nickname = nickname
        account.RealName = nickname
        account.ActiveRole = active_role
        account.IsActive = True
        return account
    account = AppAccount(
        OpenId=open_id,
        Mobile=mobile,
        Nickname=nickname,
        RealName=nickname,
        ActiveRole=active_role,
    )
    db.add(account)
    db.flush()
    return account


def get_or_create_counselor_account(
    db: Session, mobile: str, open_id: str, nickname: str,
) -> AppAccount:
    account = db.query(AppAccount).filter(AppAccount.Mobile == mobile).first()
    if not account:
        account = db.query(AppAccount).filter(AppAccount.OpenId == open_id).first()
    if account:
        account.OpenId = open_id
        account.Nickname = nickname
        account.RealName = nickname
        account.ActiveRole = "Counselor"
        account.IsActive = True
        return account
    account = AppAccount(
        OpenId=open_id,
        Mobile=mobile,
        Nickname=nickname,
        RealName=nickname,
        ActiveRole="Counselor",
    )
    db.add(account)
    db.flush()
    return account


def ensure_role(db: Session, account_id: int, role: str) -> None:
    exists = (
        db.query(AppRoleBinding)
        .filter(AppRoleBinding.AccountId == account_id, AppRoleBinding.RoleType == role)
        .first()
    )
    if not exists:
        db.add(AppRoleBinding(AccountId=account_id, RoleType=role, TargetId=account_id))


def ensure_counselor_profile(db: Session, account_id: int, data: dict) -> None:
    row = db.query(AppCounselorProfile).filter(AppCounselorProfile.AccountId == account_id).first()
    if not row:
        row = AppCounselorProfile(AccountId=account_id)
        db.add(row)
    row.Name = data["name"]
    row.AvatarUrl = data["avatar"]
    row.Title = data["title"]
    row.Specialty = data["specialty"]
    row.Field = data["field"]
    row.Introduce = data["introduce"]
    row.Career = data.get("career")
    row.Qualification = data.get("qualification")
    row.Billing = data["billing"]
    row.ConsultHours = data["consult_hours"]
    row.WorkYears = data["work_years"]
    row.IsActive = True


def ensure_counselor_slots(db: Session, counselor_id: int, slots: list) -> None:
    now = china_now()
    for cfg in slots:
        start = (now + timedelta(days=cfg["days"])).replace(
            hour=cfg["hour"], minute=0, second=0, microsecond=0,
        )
        status = cfg.get("status", "AVAILABLE")
        note = demo_schedule_note(
            cfg["center"],
            status=status,
            pref=cfg.get("pref"),
            room=cfg.get("room"),
        )
        row = (
            db.query(AppSchedule)
            .filter(AppSchedule.CounselorId == counselor_id, AppSchedule.StartTime == start)
            .first()
        )
        if not row:
            row = AppSchedule(
                CounselorId=counselor_id,
                StartTime=start,
                EndTime=start + timedelta(minutes=50),
            )
            db.add(row)
        row.EndTime = start + timedelta(minutes=50)
        row.Status = status
        row.Note = note


def ensure_patient_consultations(
    db: Session,
    patient_id: int,
    counselor_map: dict,
    consultation_keys: Optional[list] = None,
) -> None:
    now = china_now()
    keys = set(consultation_keys) if consultation_keys is not None else None
    for cfg in DEMO_PATIENT_CONSULTATIONS:
        if keys is not None and cfg["key"] not in keys:
            continue
        counselor = counselor_map.get(cfg["counselor"])
        if not counselor:
            continue

        start = _slot_start_from_offset(now, cfg["offset"])
        end = start + timedelta(minutes=50)
        center = cfg["center"]
        schedule_status = "BOOKED" if cfg["status"] != "CANCELLED" else "AVAILABLE"
        note = demo_schedule_note(
            center,
            status=schedule_status,
            room=cfg.get("room"),
        )
        demo_key = cfg["key"]

        schedule = (
            db.query(AppSchedule)
            .filter(
                AppSchedule.CounselorId == counselor.Id,
                AppSchedule.StartTime == start,
            )
            .first()
        )
        if not schedule:
            schedule = AppSchedule(
                CounselorId=counselor.Id,
                StartTime=start,
                EndTime=end,
            )
            db.add(schedule)
            db.flush()
        schedule.EndTime = end
        schedule.Note = note
        if cfg["status"] == "DONE":
            schedule.Status = "BOOKED"
        elif cfg["status"] == "CANCELLED":
            schedule.Status = "AVAILABLE"
        else:
            schedule.Status = "BOOKED"

        out_trade_no = f"DEMO-PAT-{demo_key}-{patient_id}"
        order = db.query(AppOrder).filter(AppOrder.OutTradeNo == out_trade_no).first()
        if not order:
            order = AppOrder(
                AccountId=patient_id,
                SlotId=schedule.Id,
                OutTradeNo=out_trade_no,
                TotalFee=cfg["billing"],
                Status="PAID",
                Description=f"演示咨询-{cfg['counselor']}-{demo_key}",
                PaidAt=now - timedelta(days=1),
            )
            db.add(order)
            db.flush()
        else:
            order.SlotId = schedule.Id
            order.TotalFee = cfg["billing"]
            order.Status = "PAID" if cfg["status"] != "CANCELLED" else order.Status
            order.PaidAt = order.PaidAt or (now - timedelta(days=1))

        consultation = (
            db.query(AppConsultation)
            .filter(
                AppConsultation.PatientId == patient_id,
                AppConsultation.ScheduleId == schedule.Id,
            )
            .first()
        )
        if not consultation:
            consultation = AppConsultation(
                OrderId=order.Id,
                PatientId=patient_id,
                CounselorId=counselor.Id,
                ScheduleId=schedule.Id,
            )
            db.add(consultation)
        consultation.OrderId = order.Id
        consultation.Status = cfg["status"]
        consultation.StartTime = start
        consultation.EndTime = end
        consultation.Note = note


def legacy_patient_placeholder(db: Session) -> None:
    """旧版单一来访者账号标记停用，避免 openid 与 dev_patient 冲突。"""
    account = db.query(AppAccount).filter(AppAccount.OpenId == "demo-openid-patient").first()
    if not account:
        account = db.query(AppAccount).filter(AppAccount.Mobile == "13800000000").first()
    if account:
        account.OpenId = "demo-openid-patient-legacy"
        account.Mobile = "13800000000"
        account.Nickname = "来访·旧演示"
        account.ActiveRole = "Patient"
        account.IsActive = False
