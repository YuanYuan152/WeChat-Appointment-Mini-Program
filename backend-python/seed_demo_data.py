"""
首页咨询师 + 预约置灰 + 多角色演示数据（Python 注入，启动后端即可用）。

用法（务必使用 venv / conda）:
  cd backend-python
  python seed_demo_data.py

写入内容（增量，不清表）:
  - 三位来访者：林小美 / 赵小刚 / 何小丽（与 auth.py dev_patient_* 对齐）
  - 四位咨询师：李心怡 / 张明远 / 王婉清 / 陈启明（含视频咨询中心时段）
  - BOOKED 时段 Note 含 center + room（视频中心无 room），工作台可显示咨询室
  - 助理 / 运营 / 管理员演示账号

测试置灰（无需真实微信支付）:
  - 李心怡 → 杨浦 → 明天 10:00  灰色「已约满」，咨询室 yangpu-r1
  - 张明远 → 浦东 → 后天 14:00  灰色「已约满」，咨询室 pudong-r2
  - 陈启明 → 视频咨询 → 后天 15:00  已约（无咨询室）
"""
from datetime import datetime, timedelta

from database import SessionLocal
from models import (
    AppActivity,
    AppArticle,
    AppBanner,
    AppCounselorProfile,
    AppSubscribeTemplate,
)
from seed_demo_common import (
    DEMO_COUNSELORS,
    DEMO_PATIENTS,
    DEMO_STAFF_ACCOUNTS,
    ensure_counselor_profile,
    ensure_counselor_slots,
    ensure_patient_consultations,
    ensure_role,
    get_or_create_counselor_account,
    get_or_create_demo_patient,
    get_or_create_staff_account,
    legacy_patient_placeholder,
)


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
        legacy_patient_placeholder(db)

        patient_map = {}
        for cfg in DEMO_PATIENTS:
            acc = get_or_create_demo_patient(db, cfg)
            ensure_role(db, acc.Id, "Patient")
            patient_map[cfg["real_name"]] = acc

        for acc in patient_map.values():
            stale = (
                db.query(AppCounselorProfile)
                .filter(AppCounselorProfile.AccountId == acc.Id)
                .first()
            )
            if stale:
                stale.IsActive = False

        for cfg in DEMO_STAFF_ACCOUNTS:
            acc = get_or_create_staff_account(
                db, cfg["mobile"], cfg["open_id"], cfg["name"], cfg["role"],
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
        for cfg in DEMO_PATIENTS:
            acc = patient_map[cfg["real_name"]]
            ensure_patient_consultations(
                db, acc.Id, counselor_map, consultation_keys=cfg.get("consultations"),
            )

        db.commit()
        print("[OK] 演示助理/运营/管理员账号已写入（dev_assistant / dev_ops / dev_admin）")
        print("[OK] 四位咨询师演示数据已写入（含视频咨询中心）")
        print("[OK] 三位来访者演示数据已写入")
        for cfg in DEMO_PATIENTS:
            acc = patient_map[cfg["real_name"]]
            print(f"[OK] 来访者 {cfg['real_name']}: account_id={acc.Id}, mobile={acc.Mobile}")
        for name, acc in counselor_map.items():
            print(f"[OK] 咨询师 {name}: account_id={acc.Id}, mobile={acc.Mobile}")
        print("[提示] BOOKED 时段 Note 含 room:，咨询师工作台应显示咨询室编号")
        print("--- 快速验证（无需支付）---")
        print("  1. 李心怡 → 杨浦 → 明天 10:00 灰显，工作台显示咨询室 yangpu-r1")
        print("  2. 张明远 → 浦东 → 后天 14:00 灰显，工作台显示咨询室 pudong-r2")
        print("  3. 陈启明 → 视频咨询 → 后天 11:00 可约；15:00 已约（无咨询室）")
        print("  4. DevRolePicker 三位来访者「我的咨询记录」见各账号 consultations 配置")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
