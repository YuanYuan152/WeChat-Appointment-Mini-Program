"""
咨询助理角色演示数据注入（隔离测试，会清空所有 App 表）。

推荐日常使用: python seed_demo_data.py

用法: python seed_demo_assistant.py

写入（与 auth.py 对齐）:
  - 来访者林小美、咨询师李心怡（排期总览）
  - 助理账号 demo-openid-assistant（13800000004）
  - 待办任务 + 风险提醒 + 联系记录
"""

from seed_base import bind_role, clear_all_tables, create_account, days_from_now, utc_now
from database import SessionLocal
from models import (
    AppContactRecord,
    AppCounselorProfile,
    AppRiskAlert,
    AppSchedule,
    AppTask,
)
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
ASSISTANT = {
    "mobile": "13800000004",
    "open_id": "demo-openid-assistant",
    "nickname": "演示助理",
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
        avatar_url="/static/images-opt/counselor-avatar.png",
    )
    bind_role(db, counselor.Id, "Counselor")

    db.add(
        AppCounselorProfile(
            AccountId=counselor.Id,
            Name=LI_XINYI["name"],
            AvatarUrl="/static/images-opt/counselor-avatar.png",
            Title="国家二级心理咨询师",
            Specialty="情绪压力管理",
            Field="家庭治疗,认知行为疗法",
            Introduce="供助理排期总览演示使用。",
            Billing=60000,
            ConsultHours=800,
            WorkYears=7,
            IsActive=True,
        )
    )

    for index, hour, center in [(1, 9, "yangpu"), (2, 13, "pudong"), (3, 16, "pudong")]:
        start = days_from_now(index, hour=hour)
        db.add(
            AppSchedule(
                CounselorId=counselor.Id,
                StartTime=start,
                EndTime=start.replace(minute=50),
                Status="AVAILABLE",
                Note=demo_schedule_note(center, status="AVAILABLE"),
            )
        )

    assistant = create_account(
        db,
        mobile=ASSISTANT["mobile"],
        open_id=ASSISTANT["open_id"],
        nickname=ASSISTANT["nickname"],
        active_role="Assistant",
        real_name=ASSISTANT["nickname"],
        gender="女",
    )
    bind_role(db, assistant.Id, "Assistant")
    bind_role(db, assistant.Id, "Patient")
    db.flush()

    db.add_all(
        [
            AppTask(
                AssistantId=assistant.Id,
                Type="FOLLOW_UP",
                Title="跟进林小美首次咨询前登记",
                Content="确认登记表已填写，提醒携带既往心理测评报告。",
                RelatedId=patient.Id,
                Priority="HIGH",
                Status="OPEN",
                DueAt=days_from_now(1, hour=9),
            ),
            AppTask(
                AssistantId=assistant.Id,
                Type="APPOINTMENT",
                Title="协调李心怡下周排期空档",
                Content="患者希望预约工作日晚间时段，需与咨询师确认。",
                RelatedId=counselor.Id,
                Priority="NORMAL",
                Status="IN_PROGRESS",
                DueAt=days_from_now(2, hour=14),
            ),
            AppTask(
                AssistantId=assistant.Id,
                Type="CALLBACK",
                Title="回访上周已完成咨询用户",
                Content="了解咨询后一周情绪变化，记录反馈。",
                Priority="NORMAL",
                Status="DONE",
                DueAt=days_from_now(-1, hour=10),
            ),
        ]
    )

    db.add_all(
        [
            AppRiskAlert(
                PatientId=patient.Id,
                AssistantId=assistant.Id,
                Level="MEDIUM",
                Description="登记表自评 PHQ-9 总分偏高，需电话复核当前情绪状态。",
                Status="OPEN",
            ),
            AppRiskAlert(
                PatientId=patient.Id,
                AssistantId=assistant.Id,
                Level="LOW",
                Description="来访者反馈近期睡眠改善，继续观察。",
                Status="HANDLED",
                HandledAt=utc_now(),
                HandlerNote="已电话回访，情绪稳定，建议继续咨询。",
            ),
        ]
    )

    db.add_all(
        [
            AppContactRecord(
                AssistantId=assistant.Id,
                PatientId=patient.Id,
                ContactMethod="PHONE",
                Content="首次电话沟通，确认咨询需求与可预约时间。",
                NextFollowAt=days_from_now(3, hour=10),
            ),
            AppContactRecord(
                AssistantId=assistant.Id,
                PatientId=patient.Id,
                ContactMethod="WECHAT",
                Content="发送咨询前须知与地址导航。",
                NextFollowAt=days_from_now(1, hour=15),
            ),
        ]
    )

    return assistant, patient, counselor


def main():
    db = SessionLocal()
    try:
        assistant, patient, counselor = seed(db)
        db.commit()
        print("[OK] assistant demo data seeded")
        print(f"[OK] assistant mobile: {assistant.Mobile}, open_id: {assistant.OpenId}")
        print(f"[OK] patient mobile: {patient.Mobile}, open_id: {patient.OpenId}")
        print(f"[OK] counselor account_id: {counselor.Id}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
