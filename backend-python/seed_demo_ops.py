"""
运营角色演示数据注入。

用法: python seed_demo_ops.py

会先清空所有 App 表，再写入：
  - 运营账号 + 若干示例用户（供用户列表接口）
  - Banner / 活动 / 文章等内容运营数据
"""

from datetime import timedelta

from seed_base import bind_role, clear_all_tables, create_account, utc_now
from database import SessionLocal
from models import AppActivity, AppArticle, AppBanner, AppSubscribeTemplate


def seed(db):
    clear_all_tables(db)

    ops = create_account(
        db,
        mobile="13800000003",
        open_id="demo-openid-ops",
        nickname="陈运营",
        active_role="Ops",
        real_name="陈运营",
        gender="女",
    )
    bind_role(db, ops.Id, "Ops")
    bind_role(db, ops.Id, "Patient")

    sample_users = [
        ("13800000010", "demo-openid-user-a", "访客用户A", "Patient"),
        ("13800000011", "demo-openid-user-b", "访客用户B", "Patient"),
        ("13800000012", "demo-openid-user-c", "咨询师候选", "Counselor"),
    ]
    for mobile, open_id, nickname, role in sample_users:
        user = create_account(
            db,
            mobile=mobile,
            open_id=open_id,
            nickname=nickname,
            active_role=role,
            real_name=nickname,
        )
        bind_role(db, user.Id, role)

    now = utc_now()
    db.add_all(
        [
            AppBanner(
                Title="春季心理健康月",
                ImageUrl="/static/images/slide11.png",
                LinkType="PAGE",
                LinkValue="/pages/activity/list",
                SortOrder=1,
                IsActive=True,
            ),
            AppBanner(
                Title="专业咨询师团队",
                ImageUrl="/static/images/slide11.png",
                LinkType="PAGE",
                LinkValue="/pages/consultant/list",
                SortOrder=2,
                IsActive=True,
            ),
            AppBanner(
                Title="家庭关系公益讲座",
                ImageUrl="/static/images/slide11.png",
                LinkType="PAGE",
                LinkValue="/pages/theme/index",
                SortOrder=3,
                IsActive=True,
                StartAt=now,
                EndAt=now + timedelta(days=60),
            ),
        ]
    )

    db.add_all(
        [
            AppActivity(
                Type="ACTIVITY",
                Title="益家之言论坛",
                Content="家庭热点问题系列公益论坛，每周一期线上直播。",
                CoverUrl="/static/images/huodong11.png",
                IsActive=True,
                StartAt=now - timedelta(days=1),
                EndAt=now + timedelta(days=30),
                SortOrder=1,
            ),
            AppActivity(
                Type="ACTIVITY",
                Title="系列读书会【第三期招募中】",
                Content="共读《被讨厌的勇气》，6 周线上共读营。",
                CoverUrl="/static/images/huodong11.png",
                IsActive=True,
                StartAt=now - timedelta(days=2),
                EndAt=now + timedelta(days=45),
                SortOrder=2,
            ),
            AppActivity(
                Type="NOTICE",
                Title="五一假期咨询安排通知",
                Content="5 月 1 日至 3 日部分咨询师休假，请提前预约。",
                CoverUrl="/static/images/huodong11.png",
                IsActive=True,
                StartAt=now,
                EndAt=now + timedelta(days=15),
                SortOrder=3,
            ),
            AppActivity(
                Type="THEME",
                Title="情绪管理主题月",
                Content="5 月主题：与情绪和解，照顾真实的自己。",
                CoverUrl="/static/images/place11.png",
                IsActive=True,
                StartAt=now - timedelta(days=2),
                EndAt=now + timedelta(days=28),
                SortOrder=4,
            ),
        ]
    )

    db.add_all(
        [
            AppArticle(
                Title="如何判断自己是否需要心理咨询",
                Category="文章",
                Summary="从情绪、关系和功能状态三个角度理解求助信号。",
                Content="<p>当情绪困扰持续影响睡眠、工作、学习或关系时，可以考虑寻求专业心理支持。</p>",
                CoverUrl="/static/images/slide11.png",
                Author="连心心理",
                Source="运营演示",
                IsTop=True,
                IsActive=True,
                SortOrder=1,
                PublishedAt=now - timedelta(days=1),
            ),
            AppArticle(
                Title="亲子沟通中的三个关键动作",
                Category="文章",
                Summary="倾听、确认和边界，是亲子沟通中最容易被忽略的基础。",
                Content="<p>有效沟通不是说服孩子，而是先建立一个能被听见的空间。</p>",
                CoverUrl="/static/images/slide11.png",
                Author="连心心理",
                Source="运营演示",
                IsActive=True,
                SortOrder=2,
                PublishedAt=now - timedelta(days=2),
            ),
            AppArticle(
                Title="平台服务升级公告",
                Category="公告",
                Summary="小程序新版上线，支持多角色工作台与在线预约。",
                Content="<p>欢迎体验新版连心心理小程序，如有问题请联系客服。</p>",
                CoverUrl="/static/images/slide11.png",
                Author="运营团队",
                Source="运营演示",
                IsActive=True,
                SortOrder=3,
                PublishedAt=now,
            ),
        ]
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

    return ops


def main():
    db = SessionLocal()
    try:
        ops = seed(db)
        db.commit()
        print("[OK] ops demo data seeded")
        print(f"[OK] ops mobile: {ops.Mobile}, account_id: {ops.Id}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
