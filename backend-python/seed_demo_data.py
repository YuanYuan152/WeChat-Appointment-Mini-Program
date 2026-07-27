"""
首页咨询师 + 预约置灰 + 单角色演示数据（Python 注入，启动后端即可用）。

用法（务必使用 venv / conda）:
  cd backend-python
  python seed_demo_data.py

写入内容（增量，不清表）:
  - 三位来访者：林小美 / 赵小刚 / 何小丽（与 auth.py dev_patient_* 对齐）
  - 四位咨询师：李心怡 / 张明远 / 王婉清 / 陈启明（陈启明为公益咨询师 ¥100）
  - 单账号单角色：每位演示账号仅保留一个 AppRoleBinding
  - 定价管理演示：李心怡/王婉清对林小美的个性化调价
  - 预约样例：待确认/已确认/已完成/已取消、视频咨询、退款豁免等
  - 咨询记录（含照片与修改历史）、来访反馈、心理量表、首次登记表
  - 助理待办/风险提醒/联系记录、咨询师请假申请
  - 助理 / 咨询主任 / 管理员演示账号（各一角色）
  - Banner / 活动 / 文章 / 订阅消息模板
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
    ensure_demo_admin_unread_crisis_message,
    ensure_demo_assistant_workspace,
    ensure_demo_case_records,
    ensure_demo_consultation_feedbacks,
    ensure_demo_counselor_favorites,
    ensure_demo_leave_requests,
    cleanup_legacy_demo_pricing,
    ensure_demo_patient_pricing,
    ensure_demo_psych_scales,
    ensure_demo_refund_exemptions,
    ensure_demo_registration_forms,
    ensure_demo_user_feedback,
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


def ensure_subscribe_template(db, event_key, template_id, description, role_scope="All"):
    row = db.query(AppSubscribeTemplate).filter(AppSubscribeTemplate.EventKey == event_key).first()
    if not row:
        row = AppSubscribeTemplate(EventKey=event_key)
        db.add(row)
    row.TemplateId = template_id
    row.Description = description
    if hasattr(AppSubscribeTemplate, "RoleScope"):
        row.RoleScope = role_scope
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

        staff_map = {}
        for cfg in DEMO_STAFF_ACCOUNTS:
            acc = get_or_create_staff_account(
                db, cfg["mobile"], cfg["open_id"], cfg["name"], cfg["role"],
            )
            ensure_role(db, acc.Id, cfg["role"])
            staff_map[cfg["role"]] = acc

        counselor_map = {}
        for cfg in DEMO_COUNSELORS:
            acc = get_or_create_counselor_account(db, cfg["mobile"], cfg["open_id"], cfg["name"])
            ensure_role(db, acc.Id, "Counselor")
            ensure_counselor_profile(db, acc.Id, cfg)
            ensure_counselor_slots(db, acc.Id, cfg["slots"])
            counselor_map[cfg["name"]] = acc

        ensure_banner(db, "专业心理支持", "/static/images/slide11.png", 1, "/pages/consultant/list")
        ensure_banner(db, "家庭关系公益讲座", "/static/images/slide11.png", 2, "/pages/activity/list")
        ensure_banner(db, "心理测评中心", "/static/images/huodong11.png", 3, "/pages/test/index")
        ensure_activity(db, "益家之言论坛", "家庭热点问题系列公益论坛，探讨亲子沟通与代际理解。", "/static/images/huodong11.png", -1, 1)
        ensure_activity(db, "职场情绪管理工作坊", "面向职场人群的半日体验课，学习压力识别与放松技巧。", "/static/images/slide11.png", 7, 2, type_="WORKSHOP")
        ensure_activity(db, "青少年学业压力讲座", "邀请学校心理老师分享考前调适与家庭支持策略。", "/static/images/tc59.png", 14, 3)
        ensure_article(
            db,
            "如何判断自己是否需要心理咨询",
            "从情绪、关系和功能状态三个角度理解求助信号。",
            "<p>当情绪困扰持续影响睡眠、工作、学习或关系时，可以考虑寻求专业心理支持。</p>"
            "<p>常见信号包括：持续两周以上的低落或焦虑、明显回避社交、工作效率下降、"
            "与亲友冲突增多等。早期求助往往有助于缩短恢复周期。</p>",
            1,
        )
        ensure_article(
            db,
            "首次心理咨询前，你可以做哪些准备",
            "了解咨询流程、整理困扰议题、预留安静时间，让第一次会谈更高效。",
            "<p>建议提前 10 分钟到达（视频咨询请检查设备与网络），"
            "可简要记录近期让你困扰的事件与感受。无需刻意「表现正常」，"
            "如实表达即可。</p>",
            2,
        )
        ensure_article(
            db,
            "家长如何支持青少年的心理健康",
            "倾听优于说教，关注情绪变化，必要时寻求专业帮助。",
            "<p>当孩子出现明显情绪波动或学业压力时，家长可先创造安全的沟通空间，"
            "避免简单归因于「不努力」。若困扰持续或影响日常功能，可陪同了解心理咨询资源。</p>",
            3,
        )
        ensure_subscribe_template(
            db,
            "APPOINTMENT_OK",
            "eywQth4gdVTtfS1nlH8Do6IfsPizWlnWSN4jk6p4KjQ",
            "预约成功通知",
            "Patient",
        )
        ensure_subscribe_template(
            db,
            "APPOINTMENT_REMIND",
            "_F8vuT9qgssNOC3Bq0x5Dg9--TKO7znDJFe99m_aeSM",
            "咨询提醒",
            "All",
        )
        ensure_subscribe_template(
            db, "ORDER_STATUS", "TPL_ORDER_STATUS_MOCK", "来访-订单状态变更", "Patient"
        )
        ensure_subscribe_template(
            db, "PAY_SUCCESS", "TPL_PAY_SUCCESS_MOCK", "来访-支付成功通知", "Patient"
        )
        ensure_subscribe_template(
            db, "COUNSELOR_APPOINTMENT_NEW", "TPL_COUNSELOR_NEW_MOCK", "咨询师-来访预约提醒", "Counselor"
        )
        ensure_subscribe_template(
            db, "COUNSELOR_APPOINTMENT_CANCEL", "TPL_COUNSELOR_CANCEL_MOCK", "咨询师-预约取消提醒", "Counselor"
        )
        ensure_subscribe_template(
            db,
            "STAFF_APPROVAL_PENDING",
            "LlsSPQqaMgrySH-Hh7Q3JtshNLPzD5etdEKEO822QlI",
            "待审核提醒",
            "Staff",
        )
        # 首期未接的事件保持库内行但可在 seed_subscribe_templates 中关闭
        for _k in ("ORDER_STATUS", "PAY_SUCCESS", "COUNSELOR_APPOINTMENT_NEW", "COUNSELOR_APPOINTMENT_CANCEL"):
            _row = db.query(AppSubscribeTemplate).filter(AppSubscribeTemplate.EventKey == _k).first()
            if _row:
                _row.IsActive = False
        for cfg in DEMO_PATIENTS:
            acc = patient_map[cfg["real_name"]]
            ensure_patient_consultations(
                db, acc.Id, counselor_map, consultation_keys=cfg.get("consultations"),
            )

        ensure_demo_registration_forms(db, patient_map)
        ensure_demo_psych_scales(db, patient_map)
        ensure_demo_case_records(db, patient_map)
        ensure_demo_consultation_feedbacks(db, patient_map)
        ensure_demo_refund_exemptions(db, patient_map)
        ensure_demo_counselor_favorites(db, patient_map, counselor_map)
        cleanup_legacy_demo_pricing(db)
        ensure_demo_patient_pricing(db, patient_map, counselor_map)
        ensure_demo_leave_requests(db, counselor_map)
        assistant = staff_map.get("Assistant")
        if assistant:
            ensure_demo_assistant_workspace(db, assistant.Id, patient_map, counselor_map)
        ensure_demo_user_feedback(db, patient_map)
        ensure_demo_admin_unread_crisis_message(db)
        from staff_message_service import sync_staff_workbench_inbox_messages

        synced = sync_staff_workbench_inbox_messages(db)
        if synced:
            print(f"[OK] 管理工作台收件箱消息已同步 {synced} 条（助理/主任/管理员一致）")

        db.commit()
        print("[OK] 演示助理/咨询主任/管理员账号已写入（dev_assistant / dev_ops / dev_admin，单角色）")
        print("[OK] 四位咨询师演示数据已写入（陈启明=公益 100元，含视频咨询中心、请假申请）")
        print("[OK] 三位来访者演示数据已写入（预约/登记/量表/反馈/收藏）")
        print("[OK] 定价管理演示：李心怡->林小美 +20元 固定分成 320元；王婉清->林小美 +100元")
        for cfg in DEMO_PATIENTS:
            acc = patient_map[cfg["real_name"]]
            print(f"[OK] 来访者 {cfg['real_name']}: account_id={acc.Id}, mobile={acc.Mobile}")
        for name, acc in counselor_map.items():
            print(f"[OK] 咨询师 {name}: account_id={acc.Id}, mobile={acc.Mobile}")
        print("[提示] BOOKED 时段 Note 含 room:，咨询师工作台应显示咨询室编号")
        print("--- 快速验证（无需支付）---")
        print("  1. 李心怡 → 杨浦 → 明天 10:00 灰显，工作台显示咨询室 yangpu-r1")
        print("  2. 张明远 → 浦东 → 后天 14:00 灰显，工作台显示咨询室 pudong-r2")
        print("  3. 陈启明（公益）-> 视频咨询 -> 后天 11:00 可约；15:00 已约（无咨询室，基础价 100元）")
        print("  4. 林小美：可退款/不可退款/已取消/视频预约 + 豁免申请待审")
        print("  5. 赵小刚：PENDING 预约 + 张明远 2 条已填记录 + 1 条待填写（近3天）")
        print("  6. 何小丽：3 条已完成咨询记录（含首次+视频）")
        print("--- 定价管理（管理员 dev_admin）---")
        print("  7. 李心怡 -> 林小美：调整 +20元，咨询师分成 320元（固定金额）")
        print("  8. 王婉清 -> 林小美：调整 +100元，分成默认 50% 基础价")
        print("--- 咨询记录演示 ---")
        print("  9. 李心怡：林小美 2 条已填（含历史版本）")
        print(" 10. 张明远：赵小刚 2 条已填 + 1 条待填写")
        print(" 11. 王婉清：何小丽/林小美/赵小刚 共 4 条已填")
        print(" 12. 陈启明：何小丽/林小美 各 1 条已填（视频）")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
