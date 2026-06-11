"""
首页三位咨询师 + 预约置灰演示数据（Python 注入，启动后端即可用）。

用法（务必使用 venv）:
  cd backend-python
  .\\venv\\Scripts\\activate
  python seed_demo_data.py

写入内容:
  - 演示患者 13800000000
  - 三位咨询师：李心怡 / 张明远 / 王婉清（独立账号与介绍）
  - 每位咨询师若干排班，部分 Status=BOOKED（模拟「已支付完成」→ 所有用户看到灰色不可选）

测试置灰（无需真实微信支付）:
  方式一【推荐】直接看 seed 预置的 BOOKED 时段:
    - 李心怡 → 杨浦 → 明天 10:00  应为灰色「已约满」
    - 张明远 → 浦东 → 后天 14:00  应为灰色「已约满」
  方式二 改 seed 里某时段 status 为 "BOOKED" 后重新 python seed_demo_data.py
  方式三 登录后预约王婉清可约时段 → 确认支付 → 后端 confirm-dev 将该时段 BOOKED
"""
from datetime import datetime, timedelta

from database import SessionLocal
from models import (
    AppAccount,
    AppActivity,
    AppArticle,
    AppBanner,
    AppConsultation,
    AppCounselorProfile,
    AppOrder,
    AppRoleBinding,
    AppSchedule,
    AppSubscribeTemplate,
)
from app_time import china_now
from schedule_meta import center_note

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
            {"days": 1, "hour": 10, "center": "yangpu", "status": "BOOKED"},
            {"days": 2, "hour": 9, "center": "yangpu", "status": "AVAILABLE"},
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
            {"days": 2, "hour": 14, "center": "pudong", "status": "BOOKED"},
            {"days": 3, "hour": 16, "center": "pudong", "status": "AVAILABLE"},
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
]


def get_or_create_patient(db):
    account = db.query(AppAccount).filter(AppAccount.Mobile == "13800000000").first()
    if account:
        account.OpenId = "demo-openid-patient"
        account.Nickname = "演示用户"
        account.AvatarUrl = "/static/images/tc59.png"
        account.ActiveRole = "Patient"
        account.RealName = "演示用户"
        account.Gender = "女"
        return account
    account = AppAccount(
        OpenId="demo-openid-patient",
        Mobile="13800000000",
        Nickname="演示用户",
        AvatarUrl="/static/images/tc59.png",
        ActiveRole="Patient",
        RealName="演示用户",
        Gender="女",
    )
    db.add(account)
    db.flush()
    return account


DEV_STAFF_ACCOUNTS = [
    {"mobile": "13800000004", "open_id": "demo-openid-assistant", "name": "演示助理", "role": "Assistant"},
    {"mobile": "13800000005", "open_id": "demo-openid-ops", "name": "演示运营", "role": "Ops"},
    {"mobile": "13800000006", "open_id": "demo-openid-admin", "name": "演示管理员", "role": "Admin"},
]


def get_or_create_staff_account(db, mobile, open_id, nickname, active_role):
    account = db.query(AppAccount).filter(AppAccount.Mobile == mobile).first()
    if not account:
        account = db.query(AppAccount).filter(AppAccount.OpenId == open_id).first()
    if account:
        account.OpenId = open_id
        account.Mobile = mobile
        account.Nickname = nickname
        account.RealName = nickname
        account.ActiveRole = active_role
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


def get_or_create_counselor_account(db, mobile, open_id, nickname):
    account = db.query(AppAccount).filter(AppAccount.Mobile == mobile).first()
    if account:
        account.OpenId = open_id
        account.Nickname = nickname
        account.RealName = nickname
        account.ActiveRole = "Counselor"
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


def ensure_role(db, account_id, role):
    exists = (
        db.query(AppRoleBinding)
        .filter(AppRoleBinding.AccountId == account_id, AppRoleBinding.RoleType == role)
        .first()
    )
    if not exists:
        db.add(AppRoleBinding(AccountId=account_id, RoleType=role, TargetId=account_id))


def ensure_banner(db, title, image_url, sort_order, link_value=None):
    row = db.query(AppBanner).filter(AppBanner.Title == title).first()
    if row:
        row.ImageUrl = image_url
        row.SortOrder = sort_order
        row.LinkValue = link_value
        row.IsActive = True
        return
    db.add(
        AppBanner(
            Title=title,
            ImageUrl=image_url,
            LinkType="PAGE",
            LinkValue=link_value,
            SortOrder=sort_order,
            IsActive=True,
        )
    )


def ensure_counselor_profile(db, account_id, data):
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
    row.Career = data["career"]
    row.Qualification = data["qualification"]
    row.Billing = data["billing"]
    row.ConsultHours = data["consult_hours"]
    row.WorkYears = data["work_years"]
    row.IsActive = True


# 演示来访者的咨询记录（我的咨询记录页 + 取消/退款规则）
DEMO_PATIENT_CONSULTATIONS = [
    {
        "key": "refund_ok",
        "counselor": "王婉清",
        "offset": timedelta(days=3),
        "center": "yangpu",
        "status": "CONFIRMED",
        "billing": 68000,
    },
    {
        "key": "no_refund",
        "counselor": "李心怡",
        "offset": timedelta(hours=10),
        "center": "pudong",
        "status": "CONFIRMED",
        "billing": 60000,
    },
    {
        "key": "pending",
        "counselor": "张明远",
        "offset": timedelta(days=2),
        "center": "pudong",
        "status": "PENDING",
        "billing": 55000,
    },
    {
        "key": "done",
        "counselor": "王婉清",
        "offset": timedelta(days=-7),
        "center": "pudong",
        "status": "DONE",
        "billing": 68000,
    },
]


def _slot_start_from_offset(now: datetime, offset: timedelta) -> datetime:
    start = now + offset
    if offset.total_seconds() >= 0:
        return start.replace(minute=0, second=0, microsecond=0)
    return start.replace(minute=0, second=0, microsecond=0)


def ensure_patient_consultations(db, patient_id: int, counselor_map: dict):
    """为演示来访者写入咨询记录、订单与已约排班。"""
    now = china_now()
    for cfg in DEMO_PATIENT_CONSULTATIONS:
        counselor = counselor_map.get(cfg["counselor"])
        if not counselor:
            continue

        start = _slot_start_from_offset(now, cfg["offset"])
        end = start + timedelta(minutes=50)
        note = center_note(cfg["center"])
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
                Note=note,
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


def ensure_counselor_slots(db, counselor_id, slots):
    now = china_now()
    for cfg in slots:
        start = (now + timedelta(days=cfg["days"])).replace(
            hour=cfg["hour"], minute=0, second=0, microsecond=0
        )
        row = (
            db.query(AppSchedule)
            .filter(AppSchedule.CounselorId == counselor_id, AppSchedule.StartTime == start)
            .first()
        )
        if not row:
            row = AppSchedule(CounselorId=counselor_id, StartTime=start, EndTime=start + timedelta(minutes=50))
            db.add(row)
        row.EndTime = start + timedelta(minutes=50)
        row.Status = cfg.get("status", "AVAILABLE")
        row.Note = center_note(cfg["center"])


def ensure_activity(db, title, content, cover_url, days_offset, sort_order, type_="ACTIVITY"):
    row = db.query(AppActivity).filter(AppActivity.Title == title).first()
    start_at = datetime.utcnow() + timedelta(days=days_offset)
    if not row:
        row = AppActivity(Title=title)
        db.add(row)
    row.Type = type_
    row.Content = content
    row.CoverUrl = cover_url
    row.StartAt = start_at
    row.EndAt = start_at + timedelta(days=30)
    row.SortOrder = sort_order
    row.IsActive = True


def ensure_article(db, title, summary, content, sort_order):
    row = db.query(AppArticle).filter(AppArticle.Title == title).first()
    if not row:
        row = AppArticle(Title=title)
        db.add(row)
    row.Category = "文章"
    row.Summary = summary
    row.Content = content
    row.CoverUrl = "/static/images/slide11.png"
    row.Author = "连心心理"
    row.Source = "演示数据"
    row.IsTop = sort_order == 1
    row.IsActive = True
    row.SortOrder = sort_order
    row.PublishedAt = datetime.utcnow() - timedelta(days=sort_order)


def cleanup_legacy_demo(db):
    for title in ["Professional Support", "Family Forum"]:
        db.query(AppBanner).filter(AppBanner.Title == title).delete(synchronize_session=False)


def ensure_subscribe_template(db, event_key, template_id, description):
    row = db.query(AppSubscribeTemplate).filter(AppSubscribeTemplate.EventKey == event_key).first()
    if not row:
        row = AppSubscribeTemplate(EventKey=event_key)
        db.add(row)
    row.TemplateId = template_id
    row.Description = description
    row.IsActive = True


def main():
    db = SessionLocal()
    try:
        cleanup_legacy_demo(db)
        patient = get_or_create_patient(db)
        ensure_role(db, patient.Id, "Patient")

        # 患者账号上若残留旧版「李心怡」档案，停用以免首页出现第 4 位咨询师
        stale = (
            db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == patient.Id)
            .first()
        )
        if stale:
            stale.IsActive = False

        for cfg in DEV_STAFF_ACCOUNTS:
            acc = get_or_create_staff_account(
                db, cfg["mobile"], cfg["open_id"], cfg["name"], cfg["role"]
            )
            ensure_role(db, acc.Id, "Patient")
            ensure_role(db, acc.Id, cfg["role"])

        counselor_map = {}
        for cfg in DEMO_COUNSELORS:
            acc = get_or_create_counselor_account(db, cfg["mobile"], cfg["open_id"], cfg["name"])
            ensure_role(db, acc.Id, "Counselor")
            ensure_counselor_profile(db, acc.Id, cfg)
            ensure_counselor_slots(db, acc.Id, cfg["slots"])
            counselor_map[cfg["name"]] = acc

        ensure_banner(db, "专业心理支持", "/static/images/slide11.png", 1, "/pages/consultant/list")
        ensure_banner(db, "家庭关系公益讲座", "/static/images/slide11.png", 2, "/pages/activity/list")
        ensure_activity(db, "益家之言论坛", "家庭热点问题系列公益论坛", "/static/images/huodong11.png", -1, 1)
        ensure_article(
            db,
            "如何判断自己是否需要心理咨询",
            "从情绪、关系和功能状态三个角度理解求助信号。",
            "<p>当情绪困扰持续影响睡眠、工作、学习或关系时，可以考虑寻求专业心理支持。</p>",
            1,
        )
        ensure_subscribe_template(db, "APPOINTMENT_OK", "TPL_APPOINTMENT_OK_MOCK", "预约成功通知")
        ensure_patient_consultations(db, patient.Id, counselor_map)

        db.commit()
        print("[OK] 演示助理/运营/管理员账号已写入（dev_assistant / dev_ops / dev_admin）")
        print("[OK] 三位咨询师演示数据已写入")
        print(f"[OK] 来访者: {patient.Mobile} (account_id={patient.Id})")
        for name, acc in counselor_map.items():
            print(f"[OK] 咨询师 {name}: account_id={acc.Id}, mobile={acc.Mobile}")
        print("[提示] 已约时段 Status=BOOKED = 模拟支付后状态，所有用户详情页应灰色不可选")
        print("--- 快速验证（无需支付）---")
        print("  1. 打开 李心怡 → 选「杨浦预约中心」→ 明天 10:00 应灰显")
        print("  2. 打开 张明远 → 选「浦东预约中心」→ 后天 14:00 应灰显")
        print("  3. 打开 王婉清 → 全部可约；走完预约+确认支付后可测「自己预约后置灰」")
        print("  4. dev_patient 登录 → 我的咨询记录：")
        print("     - 王婉清 3天后 CONFIRMED → 可取消且退款")
        print("     - 李心怡 10小时后 CONFIRMED → 可取消不退款")
        print("     - 张明远 2天后 PENDING → 可取消且退款")
        print("     - 王婉清 7天前 DONE → 灰色已完成")
        print("  修改 DEMO_COUNSELORS 里 status:'BOOKED' 可模拟更多已约时段")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
