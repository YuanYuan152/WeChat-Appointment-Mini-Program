"""
seed_demo_*.py 公共常量与排期 Note 规则（与 auth.py / schedule_meta.py 对齐）。

主入口：python seed_demo_data.py（增量写入，不清表）
单角色脚本：seed_demo_counselor.py 等（会 clear_all_tables，仅用于隔离测试）

演示账号均为单账号单角色；ensure_role 每次注入会强制覆盖 AppRoleBinding。
"""
import json
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app_time import china_now
from models import (
    AppAccount,
    AppCaseRecord,
    AppCaseRecordRevision,
    AppConsultation,
    AppConsultationFeedback,
    AppContactRecord,
    AppCounselorFavorite,
    AppCounselorProfile,
    AppFeedback,
    AppLeaveRequest,
    AppMessage,
    AppOrder,
    AppPsychScaleResult,
    AppRefundExemption,
    AppRegistrationForm,
    AppRiskAlert,
    AppSchedule,
    AppTask,
)
from pricing_service import default_base_price_cents_for_type, upsert_patient_pricing
from case_record_service import encode_photo_urls
from consultation_feedback import ALLOWED_IMPROVEMENTS, encode_feedback
from psych_scale import encode_answers
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
        "consultations": [
            "refund_ok", "no_refund", "cancelled_refund", "video_confirmed",
            "done_lixinyi_recent", "done_lixinyi_old", "done_wang_extra", "done_xiaomei_chen",
        ],
        "favorites": ["李心怡", "王婉清"],
        "psych_scales": ["phq9_moderate", "gad7_mild", "phq9_old"],
        "refund_exemptions": ["no_refund"],
    },
    {
        "mobile": "13800000011",
        "open_id": "demo-openid-patient-xiaogang",
        "nickname": "来访·小刚",
        "real_name": "赵小刚",
        "gender": "男",
        "avatar": "/static/images/tc59.png",
        "consultations": [
            "pending", "done_zhang_pending", "done_zhang_first", "done_zhang_mid",
            "done_xiaogang_wang", "video_pending",
        ],
        "favorites": ["张明远"],
        "psych_scales": ["phq9_mild"],
    },
    {
        "mobile": "13800000012",
        "open_id": "demo-openid-patient-xiaoli",
        "nickname": "来访·小丽",
        "real_name": "何小丽",
        "gender": "女",
        "avatar": "/static/images/tc59.png",
        "consultations": [
            "done", "done_xiaoli_wang_intake", "done_chen_video", "video_confirmed_xiaoli",
        ],
        "favorites": ["王婉清", "陈启明"],
        "psych_scales": ["gad7_moderate", "phq9_mild"],
        "feedbacks": ["done"],
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
            {"days": 0, "hour": 15, "center": "yangpu", "status": "AVAILABLE", "pref": "yangpu-r2"},
            {"days": 1, "hour": 10, "center": "yangpu", "status": "BOOKED", "room": "yangpu-r1"},
            {"days": 1, "hour": 14, "center": "pudong", "status": "AVAILABLE"},
            {"days": 2, "hour": 9, "center": "yangpu", "status": "AVAILABLE", "pref": "yangpu-r2"},
            {"days": 2, "hour": 14, "center": "pudong", "status": "AVAILABLE"},
            {"days": 3, "hour": 19, "center": "pudong", "status": "AVAILABLE"},
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
            {"days": 2, "hour": 10, "center": "yangpu", "status": "AVAILABLE"},
            {"days": 2, "hour": 14, "center": "pudong", "status": "BOOKED", "room": "pudong-r2"},
            {"days": 3, "hour": 16, "center": "pudong", "status": "AVAILABLE", "pref": "pudong-r1"},
            {"days": 4, "hour": 9, "center": "pudong", "status": "AVAILABLE"},
        ],
        "leave_request": {"days": 3, "hour": 16, "status": "PENDING", "reason": "参加注册系统继续教育培训，申请调休。"},
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
            {"days": 3, "hour": 11, "center": "yangpu", "status": "BOOKED", "room": "yangpu-r3"},
            {"days": 4, "hour": 14, "center": "pudong", "status": "AVAILABLE"},
        ],
        "leave_request": {"days": 3, "hour": 19, "status": "APPROVED", "reason": "家中有急事需处理，已与助理沟通改约。"},
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
        "counselor_type": "CHARITY",
        "billing": 10000,
        "consult_hours": 2800,
        "work_years": 8,
        "slots": [
            {"days": 1, "hour": 13, "center": "yangpu", "status": "AVAILABLE", "pref": "yangpu-r3"},
            {"days": 2, "hour": 9, "center": "video", "status": "AVAILABLE"},
            {"days": 2, "hour": 11, "center": "video", "status": "AVAILABLE"},
            {"days": 2, "hour": 15, "center": "video", "status": "BOOKED"},
            {"days": 3, "hour": 15, "center": "yangpu", "status": "AVAILABLE"},
            {"days": 4, "hour": 10, "center": "video", "status": "AVAILABLE"},
        ],
    },
]

DEMO_STAFF_ACCOUNTS = [
    {"mobile": "13800000004", "open_id": "demo-openid-assistant", "name": "演示助理", "role": "Assistant"},
    {"mobile": "13800000005", "open_id": "demo-openid-ops", "name": "演示运营", "role": "Ops"},
    {"mobile": "13800000006", "open_id": "demo-openid-admin", "name": "演示管理员", "role": "Admin"},
]

# 定价管理 · 个性化调价演示（管理员工作台）
DEMO_PATIENT_PRICING = [
    {
        "counselor": "李心怡",
        "patient": "林小美",
        "adjustment_cents": 2000,
        "share_mode": "AMOUNT",
        "revenue_share_cents": 32000,
    },
    {
        "counselor": "王婉清",
        "patient": "林小美",
        "adjustment_cents": 10000,
        "share_mode": None,
    },
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
        "billing": 10000,
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
    {
        "key": "done_chen_video",
        "counselor": "陈启明",
        "offset": timedelta(days=-10),
        "center": "video",
        "status": "DONE",
        "billing": 10000,
    },
    {
        "key": "done_xiaogang_wang",
        "counselor": "王婉清",
        "offset": timedelta(days=-14),
        "center": "yangpu",
        "status": "DONE",
        "billing": 68000,
        "room": "yangpu-r3",
    },
    {
        "key": "video_pending",
        "counselor": "陈启明",
        "offset": timedelta(days=5),
        "center": "video",
        "status": "CONFIRMED",
        "billing": 10000,
    },
    {
        "key": "video_confirmed_xiaoli",
        "counselor": "陈启明",
        "offset": timedelta(days=4),
        "center": "video",
        "status": "CONFIRMED",
        "billing": 10000,
    },
    {
        "key": "done_xiaomei_chen",
        "counselor": "陈启明",
        "offset": timedelta(days=-9),
        "center": "video",
        "status": "DONE",
        "billing": 10000,
    },
    {
        "key": "done_xiaoli_wang_intake",
        "counselor": "王婉清",
        "offset": timedelta(days=-25),
        "center": "yangpu",
        "status": "DONE",
        "billing": 68000,
        "room": "yangpu-r1",
    },
    {
        "key": "done_zhang_first",
        "counselor": "张明远",
        "offset": timedelta(days=-12),
        "center": "yangpu",
        "status": "DONE",
        "billing": 55000,
        "room": "yangpu-r2",
    },
    {
        "key": "done_zhang_mid",
        "counselor": "张明远",
        "offset": timedelta(days=-6),
        "center": "pudong",
        "status": "DONE",
        "billing": 55000,
        "room": "pudong-r1",
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
        "risk_assessment": "当前无自伤他伤风险，家庭冲突以言语争执为主。",
        "header_info": "第 3 次个体咨询｜杨浦中心｜50 分钟",
        "photo_urls": ["/static/images/huodong11.png"],
        "revisions": [
            {
                "days_ago": 6,
                "subjective": "来访者表示本周与孩子发生激烈争吵，感到无力。",
                "objective": "情绪起伏较大，仍有求助意愿。",
                "assessment": "亲子边界议题待进一步工作。",
                "plan": "继续家庭互动评估。",
                "risk_assessment": "低风险。",
                "photo_urls": [],
            },
        ],
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
    {
        "consultation_key": "done_chen_video",
        "patient": "何小丽",
        "subjective": "视频咨询中谈及童年被忽视经历，近期人际回避加重。",
        "objective": "屏幕前目光回避，谈及创伤片段时呼吸加快；否认当前自伤计划。",
        "assessment": "复杂性创伤后应激反应，需稳定化与资源建立。",
        "plan": "继续视频咨询，教授地面化技术，评估是否需要延长会谈频率。",
        "photo_urls": [],
        "revisions": [],
    },
    {
        "consultation_key": "done_xiaogang_wang",
        "patient": "赵小刚",
        "subjective": "高三学生，模拟考后焦虑明显，担心考不上理想大学。",
        "objective": "思维敏捷，自述考前失眠；父母在场时略显紧张。",
        "assessment": "考试焦虑伴完美主义，家庭期待压力较高。",
        "plan": "放松训练与认知调整，建议家长减少成绩比较式沟通。",
        "risk_assessment": "否认自伤意念，焦虑为中度，需关注考前情绪波动。",
        "header_info": "第 2 次个体咨询｜杨浦中心｜50 分钟",
        "photo_urls": ["/static/images/tc59.png"],
        "revisions": [],
    },
    {
        "consultation_key": "done_xiaomei_chen",
        "patient": "林小美",
        "subjective": "视频咨询，谈及长期承担家庭情绪劳动却得不到认可，委屈感强烈。",
        "objective": "视频画面中表情克制，谈及配偶时叹气；逻辑清晰，反思能力较好。",
        "assessment": "情感忽视与角色过载相关，需重建自我边界与表达需求。",
        "plan": "叙事取向外化「好妻子/好妈妈」标签，布置自我关怀小练习。",
        "risk_assessment": "低风险，无自杀自伤计划。",
        "header_info": "第 1 次视频咨询｜50 分钟",
        "photo_urls": [],
        "revisions": [],
    },
    {
        "consultation_key": "done_xiaoli_wang_intake",
        "patient": "何小丽",
        "subjective": "首次来访，主诉近半年汇报场合紧张、手心出汗，回避部门例会发言。",
        "objective": "仪容整洁，进入咨询室后略拘谨；量表提示 GAD-7 中度。",
        "assessment": "社交表现焦虑，与负性自动思维及过度自我监控有关。",
        "plan": "建立治疗联盟，介绍认知行为模型，预约每周一次面谈。",
        "risk_assessment": "低风险。",
        "header_info": "首次咨询｜杨浦中心｜50 分钟",
        "photo_urls": ["/static/images/slide11.png"],
        "revisions": [
            {
                "days_ago": 24,
                "subjective": "来访者简要描述工作压力与人际困扰，尚未展开细节。",
                "objective": "合作度良好，情绪略紧张。",
                "assessment": "初步印象为情境性焦虑，待进一步评估。",
                "plan": "下次深入探索触发情境与回避行为。",
                "photo_urls": [],
            },
        ],
    },
    {
        "consultation_key": "done_zhang_first",
        "patient": "赵小刚",
        "subjective": "母亲陪同首次咨询，学生本人诉模拟考排名下滑后压力大、注意力不集中。",
        "objective": "少年言语简练，母亲插话较多；学生眼神回避但可回应提问。",
        "assessment": "学业压力与亲子沟通模式需同步工作；建议逐步建立以学生为主体的会谈空间。",
        "plan": "与父母单独沟通 10 分钟说明保密原则，下次尝试单独会谈。",
        "risk_assessment": "低风险，偶有消极想法无具体计划。",
        "header_info": "首次咨询｜杨浦中心｜50 分钟（家长在场）",
        "photo_urls": ["/static/images/huodong11.png"],
        "revisions": [],
    },
    {
        "consultation_key": "done_zhang_mid",
        "patient": "赵小刚",
        "subjective": "第二次单独会谈，自述按建议记录焦虑情境，考前心慌有所减轻。",
        "objective": "比首次放松，能描述身体感受与自动思维；睡眠略有改善。",
        "assessment": "对放松训练反应良好，完美主义信念仍较突出。",
        "plan": "继续认知重构，引入「足够好」标准；布置考前一周睡眠计划。",
        "risk_assessment": "低风险。",
        "header_info": "第 2 次个体咨询｜浦东中心｜50 分钟",
        "photo_urls": ["/static/images/tc59.png", "/static/images/slide11.png"],
        "revisions": [
            {
                "days_ago": 7,
                "subjective": "来访者带来一周睡眠记录，显示平均入睡时间约 40 分钟。",
                "objective": "情绪平稳，愿意尝试新练习。",
                "assessment": "睡眠困扰与焦虑交互影响。",
                "plan": "强化睡眠卫生与放松训练。",
                "photo_urls": ["/static/images/tc59.png"],
            },
        ],
    },
    # done_zhang_pending 故意不写入记录，用于演示「待填写」
]

# 来访咨询反馈（已完成咨询；done_chen_video 故意不写，供来访提交反馈）
DEMO_CONSULTATION_FEEDBACKS = [
    {
        "consultation_key": "done",
        "patient": "何小丽",
        "goal_score": 4,
        "rhythm_score": 5,
        "improvements": ["预约流程的便捷程度（如改约、提醒）"],
        "days_ago": 6,
    },
    {
        "consultation_key": "done_lixinyi_recent",
        "patient": "林小美",
        "goal_score": 3,
        "rhythm_score": 4,
        "improvements": ["咨询频率、时长的弹性安排"],
        "days_ago": 4,
    },
    {
        "consultation_key": "done_wang_extra",
        "patient": "林小美",
        "goal_score": 5,
        "rhythm_score": 5,
        "improvements": ["暂无需要改进的地方"],
        "days_ago": 11,
    },
    {
        "consultation_key": "done_xiaogang_wang",
        "patient": "赵小刚",
        "goal_score": 4,
        "rhythm_score": 3,
        "improvements": ["空间布置（如灯光、座椅、温度等）", "费用支付或接待指引"],
        "days_ago": 13,
    },
]

# 心理量表测评（PHQ-9 / GAD-7）
DEMO_PSYCH_SCALES = {
    "phq9_moderate": {"scale_type": "PHQ9", "answers": [1, 2, 1, 2, 1, 2, 1, 1, 1], "days_ago": 3},
    "phq9_mild": {"scale_type": "PHQ9", "answers": [1, 1, 1, 1, 0, 1, 1, 0, 0], "days_ago": 7},
    "phq9_old": {"scale_type": "PHQ9", "answers": [2, 2, 1, 1, 1, 1, 0, 1, 0], "days_ago": 45},
    "gad7_mild": {"scale_type": "GAD7", "answers": [1, 1, 1, 1, 1, 1, 0], "days_ago": 3},
    "gad7_moderate": {"scale_type": "GAD7", "answers": [2, 2, 1, 2, 1, 2, 1], "days_ago": 8},
}

# 首次咨询登记表
DEMO_REGISTRATION_FORMS = {
    "林小美": {
        "occupation": "互联网产品经理",
        "education": "硕士",
        "marital_status": "已婚",
        "age_years": 34,
        "emergency_contact": "林先生（配偶）",
        "emergency_phone": "13900001111",
        "chief_complaint": "亲子沟通困难，与配偶在教育观念上分歧明显，情绪易烦躁。",
        "phq_answers": [1, 1, 2, 1, 1, 1, 0, 1, 0],
        "gad_answers": [1, 1, 1, 0, 1, 0, 0],
        "past_diagnosis": "无精神科确诊史",
        "treatment_history": "未曾接受系统心理咨询",
        "medication_history": "无长期服药",
        "family_mental_history": "母亲曾有焦虑倾向，未就诊",
        "family_relationship": "与配偶关系尚可，与婆婆同住存在边界问题",
        "sleep_status": "入睡需 40 分钟左右，偶有早醒",
        "appetite_status": "正常",
        "substance_use": "不饮酒，不吸烟",
        "self_harm_risk": "否认自伤自杀意念",
        "consultation_goal": "改善亲子沟通，缓解家庭冲突带来的压力",
    },
    "赵小刚": {
        "occupation": "高三学生",
        "education": "高中在读",
        "marital_status": "未婚",
        "age_years": 18,
        "emergency_contact": "赵父",
        "emergency_phone": "13900002222",
        "chief_complaint": "模拟考后焦虑加重，担心高考发挥失常，夜间多梦。",
        "phq_answers": [1, 1, 1, 1, 0, 1, 0, 0, 0],
        "gad_answers": [2, 1, 1, 1, 1, 1, 0],
        "past_diagnosis": "无",
        "treatment_history": "学校心理辅导老师曾约谈 2 次",
        "medication_history": "无",
        "family_mental_history": "无",
        "family_relationship": "父母期望较高，沟通以成绩为中心",
        "sleep_status": "考前常失眠",
        "appetite_status": "紧张时食欲下降",
        "substance_use": "无",
        "self_harm_risk": "否认，偶有消极想法但能自我调节",
        "consultation_goal": "缓解考试焦虑，建立合理学习目标",
    },
    "何小丽": {
        "occupation": "市场专员",
        "education": "本科",
        "marital_status": "未婚",
        "age_years": 28,
        "emergency_contact": "何母",
        "emergency_phone": "13900003333",
        "chief_complaint": "职场汇报前紧张心慌，担心表现不佳被否定。",
        "phq_answers": [1, 1, 1, 0, 1, 0, 0, 0, 0],
        "gad_answers": [2, 2, 1, 2, 1, 1, 1],
        "past_diagnosis": "无",
        "treatment_history": "无",
        "medication_history": "无",
        "family_mental_history": "无",
        "family_relationship": "与父母关系疏远，独居",
        "sleep_status": "工作压力大时入睡困难",
        "appetite_status": "正常",
        "substance_use": "偶尔饮酒助眠",
        "self_harm_risk": "否认",
        "consultation_goal": "降低社交与职场情境焦虑，提升自信",
    },
}

# 退款豁免申请（距咨询开始不足 24h 的取消场景）
DEMO_REFUND_EXEMPTIONS = [
    {
        "consultation_key": "no_refund",
        "patient": "林小美",
        "amount": 60000,
        "reason": "突发急性肠胃炎需就医，附医院就诊记录截图。",
        "screenshot_url": "/static/images/slide11.png",
        "status": "PENDING",
    },
]

# 助理工作台演示
DEMO_ASSISTANT_TASKS = [
    {
        "type": "FOLLOW_UP",
        "title": "【演示】跟进林小美首次咨询前登记",
        "content": "确认登记表已填写，提醒携带既往心理测评报告。",
        "patient": "林小美",
        "priority": "HIGH",
        "status": "OPEN",
        "due_days": 1,
        "due_hour": 9,
    },
    {
        "type": "APPOINTMENT",
        "title": "【演示】协调李心怡下周晚间排班",
        "content": "来访者希望预约工作日晚间时段，需与咨询师确认。",
        "counselor": "李心怡",
        "priority": "NORMAL",
        "status": "IN_PROGRESS",
        "due_days": 2,
        "due_hour": 14,
    },
    {
        "type": "CALLBACK",
        "title": "【演示】回访何小丽视频咨询后一周",
        "content": "了解咨询后情绪变化，记录反馈。",
        "patient": "何小丽",
        "priority": "NORMAL",
        "status": "OPEN",
        "due_days": 0,
        "due_hour": 16,
    },
    {
        "type": "RISK",
        "title": "【演示】复核赵小刚考前情绪状态",
        "content": "登记表提示轻度焦虑，高考前需电话随访。",
        "patient": "赵小刚",
        "priority": "HIGH",
        "status": "OPEN",
        "due_days": 1,
        "due_hour": 11,
    },
    {
        "type": "CALLBACK",
        "title": "【演示】上周已完成咨询用户回访",
        "content": "已完成，记录存档。",
        "priority": "NORMAL",
        "status": "DONE",
        "due_days": -2,
        "due_hour": 10,
    },
]

DEMO_RISK_ALERTS = [
    {
        "patient": "林小美",
        "level": "MEDIUM",
        "description": "登记表自评 PHQ-9 总分偏高，需电话复核当前情绪状态。",
        "status": "OPEN",
    },
    {
        "patient": "赵小刚",
        "level": "LOW",
        "description": "考前焦虑，暂无自伤风险，建议持续观察。",
        "status": "OPEN",
    },
    {
        "patient": "何小丽",
        "level": "LOW",
        "description": "来访者反馈近期睡眠改善，继续观察。",
        "status": "HANDLED",
        "handler_note": "已电话回访，情绪稳定，建议继续咨询。",
        "days_ago": 2,
    },
]

DEMO_CONTACT_RECORDS = [
    {
        "patient": "林小美",
        "method": "PHONE",
        "content": "首次电话沟通，确认咨询需求与可预约时间，发送机构介绍。",
        "next_follow_days": 3,
        "next_follow_hour": 10,
    },
    {
        "patient": "林小美",
        "method": "WECHAT",
        "content": "发送咨询前须知、地址导航与登记表填写链接。",
        "next_follow_days": 1,
        "next_follow_hour": 15,
    },
    {
        "patient": "赵小刚",
        "method": "PHONE",
        "content": "与家长沟通咨询安排，确认可由学生本人签署知情同意。",
        "next_follow_days": 2,
        "next_follow_hour": 9,
    },
    {
        "patient": "何小丽",
        "method": "WECHAT",
        "content": "确认视频咨询设备与网络环境，发送会议链接使用说明。",
        "next_follow_days": 4,
        "next_follow_hour": 14,
    },
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
    构建排期/咨询单 Note：
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
# 账号与排期写入（seed_demo_data 与各单角色脚本共用）
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
        if hasattr(account, "AccessRevokedAt"):
            account.AccessRevokedAt = None
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
    """单账号单角色：每次注入都强制覆盖为唯一绑定。"""
    from role_active import set_account_role

    set_account_role(db, account_id, role)


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
    counselor_type = data.get("counselor_type") or "PROFESSIONAL"
    row.CounselorType = counselor_type
    if counselor_type == "CHARITY":
        row.Billing = default_base_price_cents_for_type("CHARITY")
    else:
        row.Billing = data.get("billing") or default_base_price_cents_for_type("PROFESSIONAL")
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
        record.RiskAssessment = cfg.get("risk_assessment")
        record.HeaderInfo = cfg.get("header_info")
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
                    RiskAssessment=rev_cfg.get("risk_assessment"),
                    HeaderInfo=rev_cfg.get("header_info"),
                    PhotoUrls=encode_photo_urls(rev_cfg.get("photo_urls")),
                    RevisedAt=revised_at,
                    RevisedBy=consultation.CounselorId,
                )
            )


DEMO_ADMIN_CRISIS_MSG_TITLE = "【演示】个案风险需上报"


def ensure_demo_admin_unread_crisis_message(db: Session) -> None:
    """为管理工作台全员保留一条未读风险上报演示消息，便于验证「我的消息」橘色提示条。"""
    staff_open_ids = (
        "demo-openid-assistant",
        "demo-openid-ops",
        "demo-openid-admin",
    )
    accounts = (
        db.query(AppAccount)
        .filter(AppAccount.OpenId.in_(staff_open_ids))
        .all()
    )
    if not accounts:
        return

    summary = "李心怡 · 林小美 · 高风险（演示） · 来访 13800000010 · 咨询师 13800000001"
    detail = {
        "counselorName": "李心怡",
        "counselorPhone": "13800000001",
        "patientName": "林小美",
        "patientPhone": "13800000010",
        "caseRecordId": 1,
        "consultationId": 1,
        "crisisLevel": "A",
        "crisisLevelLabel": "高风险",
        "startTime": china_now().strftime("%Y-%m-%d %H:%M"),
    }
    content = json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False)

    for acc in accounts:
        msg = (
            db.query(AppMessage)
            .filter(
                AppMessage.AccountId == acc.Id,
                AppMessage.Title == DEMO_ADMIN_CRISIS_MSG_TITLE,
            )
            .first()
        )
        if msg:
            msg.IsRead = False
            msg.ReadAt = None
            msg.Content = content
            msg.RelatedType = "CASE_RECORD_CRISIS_REPORT"
            msg.Type = "RISK"
            continue
        db.add(
            AppMessage(
                AccountId=acc.Id,
                Type="RISK",
                Title=DEMO_ADMIN_CRISIS_MSG_TITLE,
                Content=content,
                RelatedType="CASE_RECORD_CRISIS_REPORT",
                RelatedId=1,
                IsRead=False,
            )
        )


def _apply_phq_gad_to_form(form: AppRegistrationForm, phq: list[int], gad: list[int]) -> None:
    for i, val in enumerate(phq[:9], start=1):
        setattr(form, f"Phq{i}", val)
    form.PhqTotal = sum(phq[:9])
    for i, val in enumerate(gad[:7], start=1):
        setattr(form, f"Gad{i}", val)
    form.GadTotal = sum(gad[:7])


def ensure_demo_registration_forms(db: Session, patient_map: dict) -> None:
    now = china_now()
    for real_name, cfg in DEMO_REGISTRATION_FORMS.items():
        patient = patient_map.get(real_name)
        if not patient:
            continue
        form = (
            db.query(AppRegistrationForm)
            .filter(AppRegistrationForm.AccountId == patient.Id)
            .order_by(AppRegistrationForm.CreatedAt.desc())
            .first()
        )
        if not form:
            form = AppRegistrationForm(AccountId=patient.Id)
            db.add(form)
        birthday = now.replace(
            year=now.year - cfg["age_years"], month=6, day=15,
            hour=0, minute=0, second=0, microsecond=0,
        )
        form.RealName = real_name
        form.Gender = patient.Gender
        form.Birthday = birthday
        form.Occupation = cfg["occupation"]
        form.Education = cfg["education"]
        form.MaritalStatus = cfg["marital_status"]
        form.Phone = patient.Mobile
        form.EmergencyContact = cfg["emergency_contact"]
        form.EmergencyPhone = cfg["emergency_phone"]
        form.ChiefComplaint = cfg["chief_complaint"]
        _apply_phq_gad_to_form(form, cfg["phq_answers"], cfg["gad_answers"])
        form.PastDiagnosis = cfg["past_diagnosis"]
        form.TreatmentHistory = cfg["treatment_history"]
        form.MedicationHistory = cfg["medication_history"]
        form.FamilyMentalHistory = cfg["family_mental_history"]
        form.FamilyRelationship = cfg["family_relationship"]
        form.SleepStatus = cfg["sleep_status"]
        form.AppetiteStatus = cfg["appetite_status"]
        form.SubstanceUse = cfg["substance_use"]
        form.SelfHarmRisk = cfg["self_harm_risk"]
        form.ConsultationGoal = cfg["consultation_goal"]
        form.UpdatedAt = now


def ensure_demo_psych_scales(db: Session, patient_map: dict) -> None:
    now = china_now()
    for cfg in DEMO_PATIENTS:
        patient = patient_map.get(cfg["real_name"])
        if not patient:
            continue
        for scale_key in cfg.get("psych_scales", []):
            scale_cfg = DEMO_PSYCH_SCALES.get(scale_key)
            if not scale_cfg:
                continue
            answers = scale_cfg["answers"]
            total = sum(answers)
            created_at = now - timedelta(days=scale_cfg.get("days_ago", 1))
            row = (
                db.query(AppPsychScaleResult)
                .filter(
                    AppPsychScaleResult.AccountId == patient.Id,
                    AppPsychScaleResult.ScaleType == scale_cfg["scale_type"],
                    AppPsychScaleResult.Total == total,
                )
                .first()
            )
            if not row:
                row = AppPsychScaleResult(
                    AccountId=patient.Id,
                    ScaleType=scale_cfg["scale_type"],
                    Answers=encode_answers(answers),
                    Total=total,
                    CreatedAt=created_at,
                )
                db.add(row)
            else:
                row.Answers = encode_answers(answers)
                row.CreatedAt = created_at


def ensure_demo_consultation_feedbacks(db: Session, patient_map: dict) -> None:
    now = china_now()
    for fb_cfg in DEMO_CONSULTATION_FEEDBACKS:
        patient = patient_map.get(fb_cfg["patient"])
        if not patient:
            continue
        consultation = _consultation_by_demo_key(db, patient.Id, fb_cfg["consultation_key"])
        if not consultation or consultation.Status != "DONE":
            continue
        improvements = [
            item for item in fb_cfg.get("improvements", [])
            if item in ALLOWED_IMPROVEMENTS
        ]
        content = encode_feedback(
            fb_cfg.get("goal_score"),
            fb_cfg.get("rhythm_score"),
            improvements,
        )
        row = (
            db.query(AppConsultationFeedback)
            .filter(AppConsultationFeedback.ConsultationId == consultation.Id)
            .first()
        )
        created_at = now - timedelta(days=fb_cfg.get("days_ago", 1))
        if not row:
            row = AppConsultationFeedback(
                ConsultationId=consultation.Id,
                AccountId=patient.Id,
                Content=content,
                CreatedAt=created_at,
            )
            db.add(row)
        else:
            row.Content = content
            row.CreatedAt = created_at


def ensure_demo_refund_exemptions(db: Session, patient_map: dict) -> None:
    for ex_cfg in DEMO_REFUND_EXEMPTIONS:
        patient = patient_map.get(ex_cfg["patient"])
        if not patient:
            continue
        consultation = _consultation_by_demo_key(db, patient.Id, ex_cfg["consultation_key"])
        if not consultation:
            continue
        row = (
            db.query(AppRefundExemption)
            .filter(
                AppRefundExemption.ConsultationId == consultation.Id,
                AppRefundExemption.AccountId == patient.Id,
            )
            .first()
        )
        if not row:
            row = AppRefundExemption(
                ConsultationId=consultation.Id,
                AccountId=patient.Id,
                Amount=ex_cfg["amount"],
                Reason=ex_cfg["reason"],
                ScreenshotUrl=ex_cfg.get("screenshot_url"),
                Status=ex_cfg.get("status", "PENDING"),
            )
            db.add(row)
        else:
            row.Amount = ex_cfg["amount"]
            row.Reason = ex_cfg["reason"]
            row.ScreenshotUrl = ex_cfg.get("screenshot_url")
            row.Status = ex_cfg.get("status", "PENDING")


def ensure_demo_counselor_favorites(
    db: Session, patient_map: dict, counselor_map: dict,
) -> None:
    for cfg in DEMO_PATIENTS:
        patient = patient_map.get(cfg["real_name"])
        if not patient:
            continue
        for counselor_name in cfg.get("favorites", []):
            counselor = counselor_map.get(counselor_name)
            if not counselor:
                continue
            exists = (
                db.query(AppCounselorFavorite)
                .filter(
                    AppCounselorFavorite.AccountId == patient.Id,
                    AppCounselorFavorite.CounselorId == counselor.Id,
                )
                .first()
            )
            if not exists:
                db.add(AppCounselorFavorite(
                    AccountId=patient.Id,
                    CounselorId=counselor.Id,
                ))


def ensure_demo_leave_requests(db: Session, counselor_map: dict) -> None:
    now = china_now()
    for cfg in DEMO_COUNSELORS:
        leave_cfg = cfg.get("leave_request")
        if not leave_cfg:
            continue
        counselor = counselor_map.get(cfg["name"])
        if not counselor:
            continue
        start = (now + timedelta(days=leave_cfg["days"])).replace(
            hour=leave_cfg["hour"], minute=0, second=0, microsecond=0,
        )
        schedule = (
            db.query(AppSchedule)
            .filter(
                AppSchedule.CounselorId == counselor.Id,
                AppSchedule.StartTime == start,
            )
            .first()
        )
        if not schedule:
            continue
        row = (
            db.query(AppLeaveRequest)
            .filter(
                AppLeaveRequest.ScheduleId == schedule.Id,
                AppLeaveRequest.CounselorId == counselor.Id,
            )
            .first()
        )
        if not row:
            row = AppLeaveRequest(
                ScheduleId=schedule.Id,
                CounselorId=counselor.Id,
                Reason=leave_cfg["reason"],
                Status=leave_cfg.get("status", "PENDING"),
            )
            db.add(row)
        else:
            row.Reason = leave_cfg["reason"]
            row.Status = leave_cfg.get("status", "PENDING")


def ensure_demo_assistant_workspace(
    db: Session,
    assistant_id: int,
    patient_map: dict,
    counselor_map: dict,
) -> None:
    now = china_now()
    for task_cfg in DEMO_ASSISTANT_TASKS:
        related_id = None
        if task_cfg.get("patient"):
            p = patient_map.get(task_cfg["patient"])
            related_id = p.Id if p else None
        elif task_cfg.get("counselor"):
            c = counselor_map.get(task_cfg["counselor"])
            related_id = c.Id if c else None
        due_at = (now + timedelta(days=task_cfg.get("due_days", 1))).replace(
            hour=task_cfg.get("due_hour", 10), minute=0, second=0, microsecond=0,
        )
        row = (
            db.query(AppTask)
            .filter(
                AppTask.AssistantId == assistant_id,
                AppTask.Title == task_cfg["title"],
            )
            .first()
        )
        if not row:
            row = AppTask(
                AssistantId=assistant_id,
                Type=task_cfg["type"],
                Title=task_cfg["title"],
                Content=task_cfg.get("content"),
                RelatedId=related_id,
                Priority=task_cfg.get("priority", "NORMAL"),
                Status=task_cfg.get("status", "OPEN"),
                DueAt=due_at,
            )
            db.add(row)
        else:
            row.Content = task_cfg.get("content")
            row.RelatedId = related_id
            row.Priority = task_cfg.get("priority", "NORMAL")
            row.Status = task_cfg.get("status", "OPEN")
            row.DueAt = due_at

    for alert_cfg in DEMO_RISK_ALERTS:
        patient = patient_map.get(alert_cfg["patient"])
        if not patient:
            continue
        desc = alert_cfg["description"]
        row = (
            db.query(AppRiskAlert)
            .filter(
                AppRiskAlert.AssistantId == assistant_id,
                AppRiskAlert.PatientId == patient.Id,
                AppRiskAlert.Description == desc,
            )
            .first()
        )
        handled_at = None
        if alert_cfg.get("status") == "HANDLED":
            handled_at = now - timedelta(days=alert_cfg.get("days_ago", 1))
        if not row:
            row = AppRiskAlert(
                PatientId=patient.Id,
                AssistantId=assistant_id,
                Level=alert_cfg["level"],
                Description=desc,
                Status=alert_cfg.get("status", "OPEN"),
                HandledAt=handled_at,
                HandlerNote=alert_cfg.get("handler_note"),
            )
            db.add(row)
        else:
            row.Level = alert_cfg["level"]
            row.Status = alert_cfg.get("status", "OPEN")
            row.HandledAt = handled_at
            row.HandlerNote = alert_cfg.get("handler_note")

    for contact_cfg in DEMO_CONTACT_RECORDS:
        patient = patient_map.get(contact_cfg["patient"])
        if not patient:
            continue
        content = contact_cfg["content"]
        row = (
            db.query(AppContactRecord)
            .filter(
                AppContactRecord.AssistantId == assistant_id,
                AppContactRecord.PatientId == patient.Id,
                AppContactRecord.Content == content,
            )
            .first()
        )
        next_follow = (now + timedelta(days=contact_cfg.get("next_follow_days", 1))).replace(
            hour=contact_cfg.get("next_follow_hour", 10),
            minute=0, second=0, microsecond=0,
        )
        if not row:
            db.add(AppContactRecord(
                AssistantId=assistant_id,
                PatientId=patient.Id,
                ContactMethod=contact_cfg.get("method", "PHONE"),
                Content=content,
                NextFollowAt=next_follow,
            ))
        else:
            row.ContactMethod = contact_cfg.get("method", "PHONE")
            row.NextFollowAt = next_follow


def cleanup_legacy_demo_pricing(db: Session) -> None:
    """移除指向已停用旧演示来访账号的个性化调价。"""
    from models import AppCounselorPatientPricing

    legacy = db.query(AppAccount).filter(AppAccount.Mobile == "13800000000").first()
    if not legacy:
        return
    db.query(AppCounselorPatientPricing).filter(
        AppCounselorPatientPricing.PatientAccountId == legacy.Id,
    ).delete(synchronize_session=False)


def ensure_demo_patient_pricing(
    db: Session,
    patient_map: dict,
    counselor_map: dict,
) -> None:
    """写入定价管理 · 个性化调价演示数据。"""
    for cfg in DEMO_PATIENT_PRICING:
        counselor = counselor_map.get(cfg["counselor"])
        patient = patient_map.get(cfg["patient"])
        if not counselor or not patient:
            continue
        upsert_patient_pricing(
            db,
            counselor.Id,
            patient.Id,
            adjustment_cents=cfg["adjustment_cents"],
            share_mode=cfg.get("share_mode"),
            revenue_share_cents=cfg.get("revenue_share_cents"),
            revenue_share_percent=cfg.get("revenue_share_percent"),
        )


def ensure_demo_user_feedback(db: Session, patient_map: dict) -> None:
    patient = patient_map.get("林小美")
    if not patient:
        return
    content = "希望小程序能增加咨询前的准备清单推送，整体体验很好。"
    row = (
        db.query(AppFeedback)
        .filter(AppFeedback.AccountId == patient.Id, AppFeedback.Content == content)
        .first()
    )
    if not row:
        db.add(AppFeedback(
            AccountId=patient.Id,
            Category="建议",
            Content=content,
            Contact=patient.Mobile,
            Status="OPEN",
        ))


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
