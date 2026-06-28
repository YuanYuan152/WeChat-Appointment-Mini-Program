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
    AppCaseRecord,
    AppCaseRecordRevision,
    AppConsultation,
    AppCounselorProfile,
    AppOrder,
    AppRoleBinding,
    AppSchedule,
)
from case_record_service import encode_photo_urls
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
        "consultations": ["refund_ok", "no_refund", "cancelled_refund", "done_lixinyi_recent", "done_lixinyi_old", "done_wang_extra"],
    },
    {
        "mobile": "13800000011",
        "open_id": "demo-openid-patient-xiaogang",
        "nickname": "来访·小刚",
        "real_name": "赵小刚",
        "gender": "男",
        "avatar": "/static/images/tc59.png",
        "consultations": ["pending", "done_zhang_pending"],
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
        "career": "4",
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
        "key": "done_lixinyi_recent",
        "counselor": "李心怡",
        "offset": timedelta(days=-5),
        "center": "yangpu",
        "status": "DONE",
        "billing": 60000,
        "room": "yangpu-r1",
    },
    {
        "key": "done_lixinyi_old",
        "counselor": "李心怡",
        "offset": timedelta(days=-18),
        "center": "pudong",
        "status": "DONE",
        "billing": 60000,
        "room": "pudong-r2",
    },
    {
        "key": "done_wang_extra",
        "counselor": "王婉清",
        "offset": timedelta(days=-12),
        "center": "yangpu",
        "status": "DONE",
        "billing": 68000,
        "room": "yangpu-r2",
    },
    {
        "key": "done_zhang_pending",
        "counselor": "张明远",
        "offset": timedelta(days=-3),
        "center": "pudong",
        "status": "DONE",
        "billing": 55000,
        "room": "pudong-r3",
    },
    {
        "key": "video_confirmed",
        "counselor": "陈启明",
        "offset": timedelta(days=2, hours=1),
        "center": "video",
        "status": "CONFIRMED",
        "billing": 62000,
    },
    {
        "key": "cancelled_refund",
        "counselor": "王婉清",
        "offset": timedelta(days=5),
        "center": "pudong",
        "status": "CANCELLED",
        "billing": 68000,
        "room": "pudong-r2",
        "order_status": "REFUNDED",
    },
]

# 咨询记录演示（对应 DEMO_PATIENT_CONSULTATIONS 中 status=DONE 的咨询单）
DEMO_CASE_RECORDS = [
    {
        "consultation_key": "done",
        "patient": "何小丽",
        "subjective": "来访者反映职场会议前心慌手抖，担心当众发言出错，近一月症状加重。",
        "objective": "面谈时语速略快，提及症状时可见紧张；GAD-7 自评中度。",
        "assessment": "情境性焦虑为主，与完美主义认知及回避行为相关。",
        "plan": "认知重构配合渐进暴露，布置每日 5 分钟呼吸放松练习。",
        "photo_urls": ["/static/images/slide11.png", "/static/images/tc59.png"],
        "revisions": [
            {
                "days_ago": 5,
                "subjective": "来访者主诉近两周工作压力增大，偶有入睡困难。",
                "objective": "情绪尚稳定，配合度良好。",
                "assessment": "轻度焦虑倾向，需进一步评估。",
                "plan": "继续收集信息，下次面谈深入探讨。",
                "photo_urls": ["/static/images/tc59.png"],
            },
        ],
    },
    {
        "consultation_key": "done_lixinyi_recent",
        "patient": "林小美",
        "subjective": "孩子进入青春期后亲子沟通变少，夫妻因教育方式常有争执。",
        "objective": "来访者情绪激动时语速加快，谈及孩子时眼眶湿润。",
        "assessment": "家庭互动模式僵化，存在三角化倾向。",
        "plan": "下次邀请配偶参与部分会谈，练习非暴力沟通句式。",
        "photo_urls": ["/static/images/huodong11.png"],
        "revisions": [],
    },
    {
        "consultation_key": "done_lixinyi_old",
        "patient": "林小美",
        "subjective": "首次咨询，主诉与婆婆同住边界不清，常感到被指责。",
        "objective": "叙述条理清晰，自尊水平尚可，求助动机明确。",
        "assessment": "婆媳关系议题突出，需厘清夫妻同盟。",
        "plan": "绘制家庭关系图，识别可改变互动环节。",
        "photo_urls": [],
        "revisions": [],
    },
    {
        "consultation_key": "done_wang_extra",
        "patient": "林小美",
        "subjective": "长期加班后疲惫感明显，周末也难以恢复精力。",
        "objective": "面色疲倦，自述睡眠质量差，无自杀意念。",
        "assessment": "职业倦怠与轻度抑郁症状需鉴别。",
        "plan": "睡眠卫生教育，评估是否需要精神科会诊。",
        "photo_urls": ["/static/images/slide11.png"],
        "revisions": [
            {
                "days_ago": 10,
                "subjective": "来访者表示最近总是很累，但说不清原因。",
                "objective": "精神状态一般，语速缓慢。",
                "assessment": "待进一步评估。",
                "plan": "下次补充量表测评。",
                "photo_urls": [],
            },
        ],
    },
    # done_zhang_pending 故意不写入记录，用于演示「待填写」
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
    row.TargetGroup = data.get("target_group", "成人,青少年,亲子家庭")
    row.Mode = data.get("mode", "线上/线下")
    row.Billing = data.get("billing") or 60000
    row.FaceBilling = data.get("face_billing") or 30000
    row.ConsultHours = data["consult_hours"]
    row.WorkYears = data["work_years"]
    row.InfoAuthenticitySignerName = data.get("name")
    row.InfoAuthenticityCommittedAt = datetime.utcnow()
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
                Status=cfg.get("order_status", "REFUNDED") if cfg["status"] == "CANCELLED" else "PAID",
                Description=f"演示咨询-{cfg['counselor']}-{demo_key}",
                PaidAt=now - timedelta(days=1),
            )
            db.add(order)
            db.flush()
        else:
            order.SlotId = schedule.Id
            order.TotalFee = cfg["billing"]
            if cfg["status"] == "CANCELLED":
                order.Status = cfg.get("order_status", "REFUNDED")
            else:
                order.Status = "PAID"
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


def _consultation_by_demo_key(db: Session, patient_id: int, demo_key: str) -> Optional[AppConsultation]:
    out_trade_no = f"DEMO-PAT-{demo_key}-{patient_id}"
    order = db.query(AppOrder).filter(AppOrder.OutTradeNo == out_trade_no).first()
    if not order:
        return None
    return db.query(AppConsultation).filter(AppConsultation.OrderId == order.Id).first()


def ensure_demo_case_records(db: Session, patient_map: dict) -> None:
    """为已完成咨询写入/更新咨询记录与历史版本（增量可重复执行）。"""
    now = china_now()
    for cfg in DEMO_CASE_RECORDS:
        patient = patient_map.get(cfg["patient"])
        if not patient:
            continue
        consultation = _consultation_by_demo_key(db, patient.Id, cfg["consultation_key"])
        if not consultation or consultation.Status != "DONE":
            continue

        record = (
            db.query(AppCaseRecord)
            .filter(AppCaseRecord.ConsultationId == consultation.Id)
            .first()
        )
        if not record:
            record = AppCaseRecord(
                ConsultationId=consultation.Id,
                CounselorId=consultation.CounselorId,
            )
            db.add(record)
            db.flush()

        record.Subjective = cfg.get("subjective")
        record.Objective = cfg.get("objective")
        record.Assessment = cfg.get("assessment")
        record.Plan = cfg.get("plan")
        record.PhotoUrls = encode_photo_urls(cfg.get("photo_urls"))
        record.UpdatedAt = now

        db.query(AppCaseRecordRevision).filter(
            AppCaseRecordRevision.CaseRecordId == record.Id,
        ).delete(synchronize_session=False)

        for rev_cfg in cfg.get("revisions", []):
            revised_at = now - timedelta(days=rev_cfg.get("days_ago", 1))
            db.add(
                AppCaseRecordRevision(
                    CaseRecordId=record.Id,
                    ConsultationId=consultation.Id,
                    CounselorId=consultation.CounselorId,
                    Subjective=rev_cfg.get("subjective"),
                    Objective=rev_cfg.get("objective"),
                    Assessment=rev_cfg.get("assessment"),
                    Plan=rev_cfg.get("plan"),
                    PhotoUrls=encode_photo_urls(rev_cfg.get("photo_urls")),
                    RevisedAt=revised_at,
                    RevisedBy=consultation.CounselorId,
                )
            )


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
