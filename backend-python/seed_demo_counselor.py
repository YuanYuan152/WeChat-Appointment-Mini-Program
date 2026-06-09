"""
咨询师角色演示数据注入。

用法: python seed_demo_counselor.py

会先清空所有 App 表，再写入：
  - 演示患者账号（供咨询单关联）
  - 咨询师账号 + 档案 + 排班 + 咨询单 + 个案记录
"""

from seed_base import bind_role, clear_all_tables, create_account, days_from_now, utc_now
from database import SessionLocal
from models import (
    AppCaseRecord,
    AppConsultation,
    AppCounselorProfile,
    AppOrder,
    AppSchedule,
    AppSubscribeTemplate,
)


def seed(db):
    clear_all_tables(db)

    patient = create_account(
        db,
        mobile="13800000000",
        open_id="demo-openid-patient",
        nickname="张小明",
        active_role="Patient",
        real_name="张小明",
        gender="男",
    )
    bind_role(db, patient.Id, "Patient")

    counselor = create_account(
        db,
        mobile="13800000001",
        open_id="demo-openid-counselor",
        nickname="李心怡",
        active_role="Counselor",
        real_name="李心怡",
        gender="女",
        avatar_url="/static/images/zixunshi11.png",
    )
    bind_role(db, counselor.Id, "Counselor")
    bind_role(db, counselor.Id, "Patient")

    db.add(
        AppCounselorProfile(
            AccountId=counselor.Id,
            Name="李心怡",
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
    for index, hour in enumerate([10, 14, 19], start=1):
        start = days_from_now(index, hour=hour)
        schedule = AppSchedule(
            CounselorId=counselor.Id,
            StartTime=start,
            EndTime=start.replace(minute=50),
            Status="AVAILABLE",
            Note="演示可预约时段",
        )
        db.add(schedule)
        schedules.append(schedule)
    db.flush()

    booked_schedule = AppSchedule(
        CounselorId=counselor.Id,
        StartTime=days_from_now(0, hour=15),
        EndTime=days_from_now(0, hour=15).replace(minute=50),
        Status="BOOKED",
        Note="已被预约",
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
            Note="首次咨询，主诉：近期焦虑与睡眠问题",
        ),
        AppConsultation(
            PatientId=patient.Id,
            CounselorId=counselor.Id,
            ScheduleId=schedules[0].Id,
            Status="PENDING",
            StartTime=schedules[0].StartTime,
            EndTime=schedules[0].EndTime,
            Note="待确认预约",
        ),
        AppConsultation(
            PatientId=patient.Id,
            CounselorId=counselor.Id,
            Status="DONE",
            StartTime=days_from_now(-7, hour=10),
            EndTime=days_from_now(-7, hour=10).replace(minute=50),
            Note="已完成咨询",
        ),
    ]
    db.add_all(consultations)
    db.flush()

    db.add(
        AppCaseRecord(
            ConsultationId=consultations[2].Id,
            CounselorId=counselor.Id,
            Subjective="来访者自述近两周入睡困难，易烦躁，与工作压力相关。",
            Objective="情绪稳定，语速正常，配合度良好。",
            Assessment="轻度焦虑，暂无自伤风险。",
            Plan="继续每周一次个体咨询，布置呼吸放松练习。",
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
        print(f"[OK] counselor mobile: {counselor.Mobile}, account_id: {counselor.Id}")
        print(f"[OK] patient mobile: {patient.Mobile}, account_id: {patient.Id}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
