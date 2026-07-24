"""
咨询师角色演示数据注入（隔离测试，会清空所有 App 表）。

推荐日常使用: python seed_demo_data.py（增量，与 DevRolePicker 对齐）

用法: python seed_demo_counselor.py

写入：
  - 来访者林小美（demo-openid-patient-xiaomei）
  - 咨询师李心怡（demo-counselor-lixinyi）+ 档案 + 排期（含 BOOKED+room）+ 咨询单 + 个案
"""

from seed_base import bind_role, clear_all_tables, create_account, days_from_now, utc_now
from datetime import timedelta
from database import SessionLocal
from models import (
    AppCaseRecord,
    AppCaseRecordRevision,
    AppConsultation,
    AppCounselorProfile,
    AppOrder,
    AppSchedule,
    AppSubscribeTemplate,
)
from case_record_service import encode_photo_urls
from seed_demo_common import demo_schedule_note

LI_XINYI = {
    "mobile": "13800000001",
    "open_id": "demo-counselor-lixinyi",
    "name": "李心怡",
}
XIAOMEI = {
    "mobile": "13800000010",
    "open_id": "demo-openid-patient-xiaomei",
    "nickname": "来访·小美",
    "real_name": "林小美",
}


def seed(db):
    clear_all_tables(db)

    patient = create_account(
        db,
        mobile=XIAOMEI["mobile"],
        open_id=XIAOMEI["open_id"],
        nickname=XIAOMEI["nickname"],
        active_role="Patient",
        real_name=XIAOMEI["real_name"],
        gender="女",
    )
    bind_role(db, patient.Id, "Patient")

    counselor = create_account(
        db,
        mobile=LI_XINYI["mobile"],
        open_id=LI_XINYI["open_id"],
        nickname=LI_XINYI["name"],
        active_role="Counselor",
        real_name=LI_XINYI["name"],
        gender="女",
        avatar_url="/static/images/zixunshi11.png",
    )
    bind_role(db, counselor.Id, "Counselor")
    bind_role(db, counselor.Id, "Patient")

    db.add(
        AppCounselorProfile(
            AccountId=counselor.Id,
            Name=LI_XINYI["name"],
            AvatarUrl="/static/images/zixunshi11.png",
            Title="国家二级心理咨询师",
            Specialty="亲子关系｜婚姻情感｜情绪压力管理",
            Field="家庭治疗,认知行为疗法,儿童青少年",
            Introduce="从业 9 年，长期在一线开展个体咨询与团体辅导，专注帮助来访者梳理情绪、建立健康关系。",
            Career="曾任三甲医院心理科咨询师，长期接受专业督导，年均接案 600+ 小时。",
            Qualification="国家二级心理咨询师；中国心理学会临床注册心理师候选人。",
            Billing=60000,
            ConsultHours=1200,
            WorkYears=9,
            IsActive=True,
        )
    )
    db.flush()

    schedules = []
    slot_defs = [
        (1, 10, "yangpu", "AVAILABLE", None, None),
        (2, 14, "pudong", "AVAILABLE", None, None),
        (3, 19, "pudong", "AVAILABLE", None, None),
    ]
    for days, hour, center, status, pref, room in slot_defs:
        start = days_from_now(days, hour=hour)
        schedule = AppSchedule(
            CounselorId=counselor.Id,
            StartTime=start,
            EndTime=start.replace(minute=50),
            Status=status,
            Note=demo_schedule_note(center, status=status, pref=pref, room=room),
        )
        db.add(schedule)
        schedules.append(schedule)
    db.flush()

    booked_start = days_from_now(0, hour=15)
    booked_note = demo_schedule_note("yangpu", status="BOOKED", room="yangpu-r1")
    booked_schedule = AppSchedule(
        CounselorId=counselor.Id,
        StartTime=booked_start,
        EndTime=booked_start.replace(minute=50),
        Status="BOOKED",
        Note=booked_note,
    )
    db.add(booked_schedule)
    db.flush()

    order = AppOrder(
        AccountId=patient.Id,
        SlotId=booked_schedule.Id,
        OutTradeNo=f"DEMO-C-{int(utc_now().timestamp())}",
        TotalFee=60000,
        Status="PAID",
        Description="个体心理咨询（50分钟）",
        PaidAt=utc_now(),
    )
    db.add(order)
    db.flush()

    consultations = [
        AppConsultation(
            OrderId=order.Id,
            PatientId=patient.Id,
            CounselorId=counselor.Id,
            ScheduleId=booked_schedule.Id,
            Status="CONFIRMED",
            StartTime=booked_schedule.StartTime,
            EndTime=booked_schedule.EndTime,
            Note=booked_note,
        ),
        AppConsultation(
            PatientId=patient.Id,
            CounselorId=counselor.Id,
            ScheduleId=schedules[0].Id,
            Status="PENDING",
            StartTime=schedules[0].StartTime,
            EndTime=schedules[0].EndTime,
            Note=schedules[0].Note,
        ),
        AppConsultation(
            PatientId=patient.Id,
            CounselorId=counselor.Id,
            Status="DONE",
            StartTime=days_from_now(-7, hour=10),
            EndTime=days_from_now(-7, hour=10).replace(minute=50),
            Note=demo_schedule_note("pudong", status="BOOKED", room="pudong-r1"),
        ),
    ]
    db.add_all(consultations)
    db.flush()

    done_consultation = consultations[2]
    record = AppCaseRecord(
        ConsultationId=done_consultation.Id,
        CounselorId=counselor.Id,
        Subjective="来访者自述近两周入睡困难，易烦躁，与工作压力相关。",
        Objective="情绪稳定，语速正常，配合度良好。",
        Assessment="轻度焦虑，暂无自伤风险。",
        Plan="继续每周一次个体咨询，布置呼吸放松练习。",
        PhotoUrls=encode_photo_urls(["/static/images/tc59.png", "/static/images/slide11.png"]),
        UpdatedAt=utc_now(),
    )
    db.add(record)
    db.flush()
    db.add(
        AppCaseRecordRevision(
            CaseRecordId=record.Id,
            ConsultationId=done_consultation.Id,
            CounselorId=counselor.Id,
            Subjective="来访者主诉近期睡眠不佳，情绪偶有低落。",
            Objective="精神状态一般，愿意配合咨询。",
            Assessment="待进一步评估。",
            Plan="下次补充量表与睡眠日记。",
            PhotoUrls=encode_photo_urls(["/static/images/tc59.png"]),
            RevisedAt=utc_now() - timedelta(days=3),
            RevisedBy=counselor.Id,
        )
    )

    for event_key, template_id, description in [
        ("APPOINTMENT_OK", "TPL_APPOINTMENT_OK_MOCK", "预约成功通知"),
        ("APPOINTMENT_REMIND", "TPL_APPOINTMENT_REMIND_MOCK", "咨询前提醒"),
        ("PAY_SUCCESS", "TPL_PAY_SUCCESS_MOCK", "支付成功通知"),
    ]:
        db.add(
            AppSubscribeTemplate(
                EventKey=event_key,
                TemplateId=template_id,
                Description=description,
                IsActive=True,
            )
        )

    return counselor, patient


def main():
    db = SessionLocal()
    try:
        counselor, patient = seed(db)
        db.commit()
        print("[OK] counselor demo data seeded")
        print(f"[OK] counselor mobile: {counselor.Mobile}, open_id: {counselor.OpenId}")
        print(f"[OK] patient mobile: {patient.Mobile}, open_id: {patient.OpenId}")
        print("[OK] 今日 15:00 BOOKED 时段 Note 含 room:yangpu-r1")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
