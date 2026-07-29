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
  - 当前业务表补充：咨询室/停用时段、待支付代理订单、修改审核、请假凭证
  - 用户画像补充：偏好标签、订阅授权、内部备注、系统设置
  - EAP 演示报告：使用当前发布定义、真实计分和完整快照生成

有意不伪造的运行时数据:
  - AppLoginSession / AppSmsVerification（认证流程自动产生）
  - AppRoleSwitchLog（角色变更审计流程自动产生）
  - AppMessageLog / AppRemindTask（发送与定时任务流程自动产生）
  - AppAssessmentShareScan / AppAssessmentAuditLog
    （必须通过真实扫码和审计服务产生，避免污染统计或伪造审计记录）
"""
import hashlib
from datetime import datetime, timedelta

from database import SessionLocal
from models import (
    AppActivity,
    AppArticle,
    AppAssessmentReport,
    AppBanner,
    AppCaseRecord,
    AppCaseRecordAmendmentRequest,
    AppConsultation,
    AppConsultationRoom,
    AppCounselorProfile,
    AppLeaveRequest,
    AppOrder,
    AppRefundExemption,
    AppSchedule,
    AppScheduleCancelLog,
    AppStaffAccountRemark,
    AppSubscribeTemplate,
    AppSystemSetting,
    AppUserPreferenceTag,
    AppUserSubscribeAuth,
)
from app_time import china_now
from assessment_report_service import _canonical_json, _snapshot
from assessment_routes import get_assessment_store
from assessment_scoring_service import (
    assessment_result_summary,
    calculate_assessment_result,
    validate_submission_answers,
)
from config import settings
from room_slot_status import upsert_slot_statuses
from schedule_meta import CONSULTATION_ROOMS
from system_setting_service import (
    DEFAULT_PROXY_ORDER_TTL_MINUTES,
    PROXY_ORDER_TTL_MINUTES_KEY,
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


def ensure_demo_account_profiles(db, patient_map, counselor_map):
    """补齐来访者业务画像、首次协议和咨询师绑定字段。"""
    now = china_now()
    profiles = {
        "林小美": {
            "birthday": datetime(1994, 6, 15),
            "emergency_contact": "林女士",
            "emergency_relation": "母亲",
            "emergency_phone": "13800000110",
            "counselor": "李心怡",
        },
        "赵小刚": {
            "birthday": datetime(2009, 9, 1),
            "emergency_contact": "赵先生",
            "emergency_relation": "父亲",
            "emergency_phone": "13800000111",
            "counselor": "张明远",
        },
        "何小丽": {
            "birthday": datetime(1989, 3, 20),
            "emergency_contact": "何女士",
            "emergency_relation": "姐姐",
            "emergency_phone": "13800000112",
            "counselor": "王婉清",
        },
    }
    for real_name, cfg in profiles.items():
        account = patient_map.get(real_name)
        counselor = counselor_map.get(cfg["counselor"])
        if not account or not counselor:
            continue
        account.Birthday = cfg["birthday"]
        account.EmergencyContact = cfg["emergency_contact"]
        account.EmergencyRelation = cfg["emergency_relation"]
        account.EmergencyPhone = cfg["emergency_phone"]
        account.IntakeAgreementSignedAt = account.IntakeAgreementSignedAt or now
        account.IntakeIsAdult = cfg["birthday"].year <= now.year - 18
        account.IntakeSignatureUrl = f"/static/demo/signatures/{account.Id}.png"
        account.ProfileCompletedAt = account.ProfileCompletedAt or now
        account.PatientSource = "MINI_PROGRAM"
        account.IsContractSigned = True
        account.BoundCounselorId = counselor.Id
        account.BoundCounselorChangedAt = account.BoundCounselorChangedAt or now
        account.IsActive = True
        account.DeletedAt = None


def ensure_demo_rooms(db):
    """写入实体咨询室，以及全局停用和单时段停用两类状态。"""
    sort_order = 0
    room_map = {}
    for center_id, rooms in CONSULTATION_ROOMS.items():
        for cfg in rooms:
            row = (
                db.query(AppConsultationRoom)
                .filter(
                    AppConsultationRoom.CenterId == center_id,
                    AppConsultationRoom.RoomCode == cfg["id"],
                )
                .first()
            )
            if not row:
                row = AppConsultationRoom(
                    CenterId=center_id,
                    RoomCode=cfg["id"],
                    Name=cfg["name"],
                )
                db.add(row)
                db.flush()
            row.Name = cfg["name"]
            row.Status = "AVAILABLE"
            row.SortOrder = sort_order
            room_map[cfg["id"]] = row
            sort_order += 1

    maintenance = (
        db.query(AppConsultationRoom)
        .filter(
            AppConsultationRoom.CenterId == "pudong",
            AppConsultationRoom.RoomCode == "pudong-r4",
        )
        .first()
    )
    if not maintenance:
        maintenance = AppConsultationRoom(
            CenterId="pudong",
            RoomCode="pudong-r4",
            Name="咨询室 D（维护演示）",
        )
        db.add(maintenance)
    maintenance.Status = "DISABLED"
    maintenance.SortOrder = sort_order

    disabled_room = room_map.get("yangpu-r3")
    if disabled_room:
        disabled_at = (china_now() + timedelta(days=2)).replace(
            hour=16, minute=0, second=0, microsecond=0,
        )
        upsert_slot_statuses(
            db,
            disabled_room.Id,
            [{"start_time": disabled_at, "status": "DISABLED"}],
        )


def ensure_demo_pending_proxy_order(db, patient_map, counselor_map, staff_map):
    """增加可重复支付联调的代理预约待支付订单，不提前占用排期。"""
    patient = patient_map.get("林小美")
    counselor = counselor_map.get("李心怡")
    assistant = staff_map.get("Assistant")
    if not patient or not counselor or not assistant:
        return

    now = china_now()
    schedule = (
        db.query(AppSchedule)
        .filter(
            AppSchedule.CounselorId == counselor.Id,
            AppSchedule.Status == "AVAILABLE",
            AppSchedule.StartTime > now + timedelta(hours=2),
            ~db.query(AppOrder.Id).filter(
                AppOrder.SlotId == AppSchedule.Id,
                AppOrder.Status == "PENDING",
            ).exists(),
        )
        .order_by(AppSchedule.StartTime.asc())
        .first()
    )
    if not schedule:
        return

    out_trade_no = f"DEMO-PROXY-PENDING-{patient.Id}"
    row = db.query(AppOrder).filter(AppOrder.OutTradeNo == out_trade_no).first()
    if not row:
        row = AppOrder(
            AccountId=patient.Id,
            OutTradeNo=out_trade_no,
            TotalFee=60000,
        )
        db.add(row)
    row.AccountId = patient.Id
    row.SlotId = schedule.Id
    row.TransactionId = None
    row.TotalFee = 60000
    row.Status = "PENDING"
    row.Description = "【演示】助理推送待支付订单|center:yangpu"
    row.IntakeIsAdult = None
    row.IntakeSignatureUrl = None
    row.PaidAt = None
    row.ExpiresAt = now + timedelta(minutes=DEFAULT_PROXY_ORDER_TTL_MINUTES)
    row.ProxyCreatedByAccountId = assistant.Id
    row.ProxyAgreementIsAdult = True


def ensure_demo_preferences_and_subscriptions(db, patient_map):
    """覆盖个人/兴趣标签，以及 accept/reject/ban 三种订阅状态。"""
    now = china_now()
    tag_sets = {
        "林小美": (["职场人士", "情感困惑者"], ["焦虑与压力", "亲密关系", "睡眠问题"]),
        "赵小刚": (["学生", "青少年"], ["焦虑与压力", "人际关系", "自我成长"]),
        "何小丽": (["职场人士"], ["职场心理", "情绪管理", "睡眠问题"]),
    }
    for real_name, (personal_tags, interest_tags) in tag_sets.items():
        account = patient_map.get(real_name)
        if not account:
            continue
        db.query(AppUserPreferenceTag).filter(
            AppUserPreferenceTag.AccountId == account.Id,
        ).delete(synchronize_session=False)
        for tag in personal_tags:
            db.add(AppUserPreferenceTag(
                AccountId=account.Id,
                Category="personal",
                Tag=tag,
            ))
        for tag in interest_tags:
            db.add(AppUserPreferenceTag(
                AccountId=account.Id,
                Category="interest",
                Tag=tag,
            ))
        account.PreferenceTagsCompletedAt = now

    template = (
        db.query(AppSubscribeTemplate)
        .filter(AppSubscribeTemplate.EventKey == "APPOINTMENT_OK")
        .first()
    )
    statuses = {"林小美": "accept", "赵小刚": "reject", "何小丽": "ban"}
    for real_name, status in statuses.items():
        account = patient_map.get(real_name)
        if not account:
            continue
        row = (
            db.query(AppUserSubscribeAuth)
            .filter(
                AppUserSubscribeAuth.AccountId == account.Id,
                AppUserSubscribeAuth.EventKey == "APPOINTMENT_OK",
            )
            .first()
        )
        if not row:
            row = AppUserSubscribeAuth(
                AccountId=account.Id,
                EventKey="APPOINTMENT_OK",
            )
            db.add(row)
        row.TemplateId = template.TemplateId if template else None
        row.Status = status
        row.RoleAtAuth = "Patient"
        row.UpdatedAt = now
        account.SubscribeOptInAt = now if status == "accept" else None
        account.SubscribeRoleVersion = "Patient" if status == "accept" else None


def ensure_demo_staff_remarks(db, patient_map, counselor_map, staff_map):
    """为来访者和咨询师看板增加内部备注。"""
    editor = staff_map.get("Admin") or staff_map.get("Assistant")
    if not editor:
        return
    remarks = [
        (patient_map.get("林小美"), "【演示】偏好工作日晚间咨询，首次来访需关注睡眠状况。"),
        (patient_map.get("赵小刚"), "【演示】未成年人，联系安排时需同步监护人。"),
        (counselor_map.get("陈启明"), "【演示】公益咨询师，达到阶段次数后需进入议价流程。"),
    ]
    for account, content in remarks:
        if not account:
            continue
        row = (
            db.query(AppStaffAccountRemark)
            .filter(AppStaffAccountRemark.AccountId == account.Id)
            .first()
        )
        if not row:
            row = AppStaffAccountRemark(AccountId=account.Id)
            db.add(row)
        row.Remark = content
        row.UpdatedByAccountId = editor.Id
        row.UpdatedAt = china_now()


def _demo_case_record(db, patient, demo_key):
    out_trade_no = f"DEMO-PAT-{demo_key}-{patient.Id}"
    return (
        db.query(AppCaseRecord)
        .join(AppConsultation, AppConsultation.Id == AppCaseRecord.ConsultationId)
        .join(AppOrder, AppOrder.Id == AppConsultation.OrderId)
        .filter(AppOrder.OutTradeNo == out_trade_no)
        .first()
    )


def ensure_demo_review_workflows(db, patient_map, counselor_map, staff_map):
    """补齐修改申请、退款审批、请假审批和沟通凭证状态。"""
    now = china_now()
    admin = staff_map.get("Admin")
    if not admin:
        return

    amendment_configs = [
        ("林小美", "done_lixinyi_recent", "PENDING", "【演示】补充来访者本周睡眠变化", None),
        ("赵小刚", "done_zhang_first", "APPROVED", "【演示】修正首次咨询目标表述", None),
        ("何小丽", "done", "REJECTED", "【演示】申请删除必要风险描述", "风险信息需按原始记录保留"),
    ]
    for patient_name, demo_key, status, reason, reject_reason in amendment_configs:
        patient = patient_map.get(patient_name)
        if not patient:
            continue
        record = _demo_case_record(db, patient, demo_key)
        if not record:
            continue
        row = (
            db.query(AppCaseRecordAmendmentRequest)
            .filter(
                AppCaseRecordAmendmentRequest.CaseRecordId == record.Id,
                AppCaseRecordAmendmentRequest.Reason == reason,
            )
            .first()
        )
        if not row:
            row = AppCaseRecordAmendmentRequest(
                CaseRecordId=record.Id,
                ConsultationId=record.ConsultationId,
                CounselorId=record.CounselorId,
                Subjective=record.Subjective or "演示主诉",
                Objective=record.Objective or "演示观察",
                Assessment=record.Assessment or "演示评估",
                Plan=record.Plan or "演示计划",
                Reason=reason,
            )
            db.add(row)
        row.Subjective = f"{record.Subjective or '演示主诉'}（修改稿）"
        row.Objective = record.Objective or "演示观察"
        row.Assessment = record.Assessment or "演示评估"
        row.Plan = record.Plan or "演示计划"
        row.RiskAssessment = record.RiskAssessment
        row.HeaderInfo = record.HeaderInfo
        row.PhotoUrls = record.PhotoUrls
        row.Status = status
        row.RejectReason = reject_reason
        row.ReviewedBy = admin.Id if status != "PENDING" else None
        row.ReviewedAt = now - timedelta(days=1) if status != "PENDING" else None

    refund_configs = [
        ("林小美", "cancelled_refund", "APPROVED", "【演示】突发住院，审批同意全额退款", None),
        ("何小丽", "video_confirmed_xiaoli", "REJECTED", "【演示】个人行程变化申请退款", "不符合临时退款豁免条件"),
    ]
    for patient_name, demo_key, status, reason, reject_reason in refund_configs:
        patient = patient_map.get(patient_name)
        if not patient:
            continue
        order = (
            db.query(AppOrder)
            .filter(AppOrder.OutTradeNo == f"DEMO-PAT-{demo_key}-{patient.Id}")
            .first()
        )
        consultation = (
            db.query(AppConsultation)
            .filter(AppConsultation.OrderId == order.Id)
            .first()
            if order else None
        )
        if not consultation:
            continue
        row = (
            db.query(AppRefundExemption)
            .filter(
                AppRefundExemption.ConsultationId == consultation.Id,
                AppRefundExemption.Reason == reason,
            )
            .first()
        )
        if not row:
            row = AppRefundExemption(
                ConsultationId=consultation.Id,
                AccountId=patient.Id,
                Amount=order.TotalFee,
                Reason=reason,
            )
            db.add(row)
        row.Status = status
        row.ScreenshotUrl = "/static/images/slide11.png"
        row.RejectReason = reject_reason
        row.ReviewedBy = admin.Id
        row.ReviewedAt = now - timedelta(hours=8)

    charity = counselor_map.get("陈启明")
    if charity:
        schedule = (
            db.query(AppSchedule)
            .filter(
                AppSchedule.CounselorId == charity.Id,
                AppSchedule.Status == "AVAILABLE",
                AppSchedule.StartTime > now,
            )
            .order_by(AppSchedule.StartTime.desc())
            .first()
        )
        if schedule:
            leave = (
                db.query(AppLeaveRequest)
                .filter(
                    AppLeaveRequest.ScheduleId == schedule.Id,
                    AppLeaveRequest.CounselorId == charity.Id,
                )
                .first()
            )
            if not leave:
                leave = AppLeaveRequest(
                    ScheduleId=schedule.Id,
                    CounselorId=charity.Id,
                    Reason="【演示】临时参加督导，提交请假申请。",
                )
                db.add(leave)
                db.flush()
            leave.Status = "REJECTED"
            leave.RejectReason = "距离咨询时间较近，请先完成改约沟通"
            leave.ReviewedBy = admin.Id
            leave.ReviewedAt = now - timedelta(hours=2)

    for leave in db.query(AppLeaveRequest).filter(
        AppLeaveRequest.CounselorId.in_([item.Id for item in counselor_map.values()]),
    ).all():
        log = (
            db.query(AppScheduleCancelLog)
            .filter(AppScheduleCancelLog.LeaveRequestId == leave.Id)
            .first()
        )
        if not log:
            log = AppScheduleCancelLog(
                ScheduleId=leave.ScheduleId,
                CounselorId=leave.CounselorId,
                LeaveRequestId=leave.Id,
                ScreenshotUrl=f"/static/demo/leave/{leave.Id}.png",
            )
            db.add(log)
        consultation = (
            db.query(AppConsultation)
            .filter(AppConsultation.ScheduleId == leave.ScheduleId)
            .first()
        )
        log.ConsultationId = consultation.Id if consultation else None


def ensure_demo_assessment_report(db, patient_map):
    """用真实发布定义、答案校验和计分逻辑生成一份可读取的 EAP 报告。"""
    account = patient_map.get("林小美")
    if not account:
        return

    store = get_assessment_store()
    published = store.get_published("dark-light-personality")
    definition = published["definition"]
    version = int(definition["version"])
    client_submission_id = f"demo-dark-light-v{version}"
    row = (
        db.query(AppAssessmentReport)
        .filter(
            AppAssessmentReport.AccountId == account.Id,
            AppAssessmentReport.ClientSubmissionId == client_submission_id,
        )
        .first()
    )

    answers = {
        question["id"]: question["options"][0]["id"]
        for question in definition["questions"]
    }
    demographics, normalized_answers = validate_submission_answers(
        definition,
        {},
        answers,
    )
    result = calculate_assessment_result(definition, normalized_answers)
    completed_at = row.CompletedAt if row else datetime.utcnow()
    snapshot = _snapshot(definition, result, completed_at)
    snapshot_json = _canonical_json(snapshot)

    if not row:
        row = AppAssessmentReport(
            PublicId=f"rpt_demo_dark_{account.Id}_v{version}",
            AccountId=account.Id,
            ClientSubmissionId=client_submission_id,
            AssessmentId=definition["id"],
            AssessmentVersion=version,
            Category=definition["category"],
            AssessmentTitle=definition["title"],
            ScoringType=definition["scoringType"],
            EntrySource="direct",
            ConsentVersion=settings.ASSESSMENT_CONSENT_VERSION or "demo",
            ConsentAcceptedAt=completed_at,
            CompletedAt=completed_at,
            CreatedAt=completed_at,
        )
        db.add(row)
    row.DemographicAnswers = _canonical_json(demographics)
    row.Answers = _canonical_json(normalized_answers)
    row.ResultJson = _canonical_json(result)
    row.ResultSummary = assessment_result_summary(result)
    row.ReportSnapshot = snapshot_json
    row.SnapshotSha256 = hashlib.sha256(snapshot_json.encode("utf-8")).hexdigest()
    row.DeletedAt = None


def ensure_demo_system_settings(db, staff_map):
    """补齐非敏感的系统业务配置。"""
    admin = staff_map.get("Admin")
    setting = (
        db.query(AppSystemSetting)
        .filter(AppSystemSetting.SettingKey == PROXY_ORDER_TTL_MINUTES_KEY)
        .first()
    )
    if not setting:
        setting = AppSystemSetting(
            SettingKey=PROXY_ORDER_TTL_MINUTES_KEY,
            SettingValue=str(DEFAULT_PROXY_ORDER_TTL_MINUTES),
        )
        db.add(setting)
        setting.UpdatedByAccountId = admin.Id if admin else None


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

        ensure_demo_account_profiles(db, patient_map, counselor_map)
        ensure_demo_rooms(db)

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
        ensure_demo_preferences_and_subscriptions(db, patient_map)

        for cfg in DEMO_PATIENTS:
            acc = patient_map[cfg["real_name"]]
            ensure_patient_consultations(
                db, acc.Id, counselor_map, consultation_keys=cfg.get("consultations"),
            )
        ensure_demo_pending_proxy_order(db, patient_map, counselor_map, staff_map)

        ensure_demo_registration_forms(db, patient_map)
        ensure_demo_psych_scales(db, patient_map)
        ensure_demo_assessment_report(db, patient_map)
        ensure_demo_case_records(db, patient_map)
        ensure_demo_consultation_feedbacks(db, patient_map)
        ensure_demo_refund_exemptions(db, patient_map)
        ensure_demo_counselor_favorites(db, patient_map, counselor_map)
        cleanup_legacy_demo_pricing(db)
        ensure_demo_patient_pricing(db, patient_map, counselor_map)
        ensure_demo_leave_requests(db, counselor_map)
        ensure_demo_review_workflows(db, patient_map, counselor_map, staff_map)
        ensure_demo_staff_remarks(db, patient_map, counselor_map, staff_map)
        ensure_demo_system_settings(db, staff_map)
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
        print("[OK] 当前业务表演示数据已补齐（咨询室/待支付/审核流/标签/订阅/备注/系统设置）")
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
