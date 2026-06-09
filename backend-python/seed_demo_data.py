from datetime import datetime, timedelta

from database import SessionLocal
from models import (
    AppAccount,
    AppActivity,
    AppArticle,
    AppBanner,
    AppCounselorProfile,
    AppRoleBinding,
    AppSchedule,
    AppSubscribeTemplate,
)


def get_or_create_account(db):
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


def ensure_counselor(db, account_id, data):
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


def ensure_schedules(db, counselor_id):
    now = datetime.utcnow()
    existing = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.CounselorId == counselor_id,
            AppSchedule.Status == "AVAILABLE",
            AppSchedule.StartTime >= now,
        )
        .count()
    )
    if existing:
        return

    centers = ["center:yangpu", "center:pudong", "center:yangpu"]
    for index, hour in enumerate([10, 14, 19], start=1):
        start = (now + timedelta(days=index)).replace(hour=hour, minute=0, second=0, microsecond=0)
        db.add(
            AppSchedule(
                CounselorId=counselor_id,
                StartTime=start,
                EndTime=start + timedelta(minutes=50),
                Status="AVAILABLE",
                Note=centers[index - 1],
            )
        )


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
    """清理上一轮临时使用的英文兜底以及 VARCHAR 时代写入后变成 '???' 的演示数据。"""
    legacy_banners = ["Professional Support", "Family Forum"]
    legacy_activities = ["Demo Family Forum", "Demo Reading Group", "Demo Mental Health Talk"]
    legacy_articles = ["When to Seek Counseling", "Parent Child Communication"]

    db.query(AppBanner).filter(AppBanner.Title.in_(legacy_banners)).delete(synchronize_session=False)
    db.query(AppActivity).filter(AppActivity.Title.in_(legacy_activities)).delete(synchronize_session=False)
    db.query(AppArticle).filter(AppArticle.Title.in_(legacy_articles)).delete(synchronize_session=False)

    # VARCHAR 时代被写入后存成 "?" 的旧记录无法还原，直接删除
    db.query(AppBanner).filter(AppBanner.Title.like("%??%")).delete(synchronize_session=False)
    db.query(AppActivity).filter(AppActivity.Title.like("%??%")).delete(synchronize_session=False)
    db.query(AppArticle).filter(AppArticle.Title.like("%??%")).delete(synchronize_session=False)


def ensure_subscribe_template(db, event_key, template_id, description):
    row = (
        db.query(AppSubscribeTemplate)
        .filter(AppSubscribeTemplate.EventKey == event_key)
        .first()
    )
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
        account = get_or_create_account(db)
        db.flush()
        for role in ["Patient", "Counselor", "Assistant", "Ops", "Admin"]:
            ensure_role(db, account.Id, role)

        ensure_banner(db, "专业心理支持", "/static/images/slide11.png", 1, "/pages/consultant/list")
        ensure_banner(db, "家庭关系公益讲座", "/static/images/slide11.png", 2, "/pages/activity/list")
        ensure_banner(db, "情绪管理主题月", "/static/images/slide11.png", 3, "/pages/theme/index")

        ensure_counselor(
            db,
            account.Id,
            {
                "name": "李心怡",
                "avatar": "/static/images/zixunshi11.png",
                "title": "国家二级心理咨询师",
                "specialty": "亲子关系｜婚姻情感｜情绪压力管理",
                "field": "家庭治疗,认知行为疗法,儿童青少年",
                "introduce": "从业 9 年，长期在一线开展个体咨询与团体辅导，专注帮助来访者梳理情绪、建立健康关系。",
                "career": "曾任三甲医院心理科咨询师，长期接受专业督导，年均接案 600+ 小时。",
                "qualification": "国家二级心理咨询师；中国心理学会临床注册心理师候选人。",
                "billing": 60000,
                "consult_hours": 1200,
                "work_years": 9,
            },
        )
        ensure_schedules(db, account.Id)

        # 已在过去开始 + 未来结束 → 在"进行中"列表里出现
        ensure_activity(db, "益家之言论坛", "家庭热点问题系列公益论坛", "/static/images/huodong11.png", -1, 1)
        ensure_activity(db, "系列读书会【第二期火热招募中】", "让阅读成为一种习惯", "/static/images/huodong11.png", -2, 2)
        ensure_activity(db, "心理健康讲座", "情绪管理与压力调节技巧", "/static/images/huodong11.png", -3, 3)
        # 主题月（type=THEME）演示数据
        ensure_activity(db, "情绪管理主题月", "5 月主题：与情绪和解，照顾真实的自己", "/static/images/place11.png", -2, 4, type_="THEME")
        ensure_activity(db, "亲子关系主题月", "6 月主题：从倾听到共情，重塑亲子连接", "/static/images/place14.png", 30, 5, type_="THEME")

        ensure_article(
            db,
            "如何判断自己是否需要心理咨询",
            "从情绪、关系和功能状态三个角度理解求助信号。",
            "<p>当情绪困扰持续影响睡眠、工作、学习或关系时，可以考虑寻求专业心理支持。</p>",
            1,
        )
        ensure_article(
            db,
            "亲子沟通中的三个关键动作",
            "倾听、确认和边界，是亲子沟通中最容易被忽略的基础。",
            "<p>有效沟通不是说服孩子，而是先建立一个能被听见的空间。</p>",
            2,
        )
        ensure_article(
            db,
            "情绪急救包：5 分钟自我安顿练习",
            "当情绪即将失控时，先把自己稳住。",
            "<p>呼吸 → 命名情绪 → 落地感知 → 自我对话 → 行动一小步。</p>",
            3,
        )

        # 订阅消息模板（升级方案 §7.6）
        # 上线前需替换为微信公众平台真实模板 ID。当前 mock 值仅用于联调。
        ensure_subscribe_template(db, "APPOINTMENT_OK", "TPL_APPOINTMENT_OK_MOCK", "预约成功通知")
        ensure_subscribe_template(db, "APPOINTMENT_REMIND", "TPL_APPOINTMENT_REMIND_MOCK", "咨询前提醒")
        ensure_subscribe_template(db, "PAY_SUCCESS", "TPL_PAY_SUCCESS_MOCK", "支付成功通知")

        db.commit()
        print("[OK] demo data seeded")
        print(f"[OK] demo mobile: {account.Mobile}, account_id: {account.Id}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
