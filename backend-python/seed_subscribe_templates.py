"""写入首期 3 条真实订阅消息模板 ID（可单独运行，不必跑全量 seed）。

用法（在 backend-python 目录、已激活 venv）:
  python seed_subscribe_templates.py
"""

from database import SessionLocal
from models import AppSubscribeTemplate

# 与公众平台「我的模板」一致（首期启用）
REAL_TEMPLATES = [
    {
        "event_key": "APPOINTMENT_OK",
        "template_id": "eywQth4gdVTtfS1nlH8Do6IfsPizWlnWSN4jk6p4KjQ",
        "description": "预约成功通知",
        "role_scope": "Patient",
    },
    {
        "event_key": "APPOINTMENT_REMIND",
        "template_id": "_F8vuT9qgssNOC3Bq0x5Dg9--TKO7znDJFe99m_aeSM",
        "description": "咨询提醒",
        "role_scope": "All",  # 来访 + 咨询师共用
    },
    {
        "event_key": "STAFF_APPROVAL_PENDING",
        "template_id": "LlsSPQqaMgrySH-Hh7Q3JtshNLPzD5etdEKEO822QlI",
        "description": "待审核提醒",
        "role_scope": "Staff",
    },
]

# 首期不启用，避免前端误拉 mock / 未接字段
DISABLE_EVENT_KEYS = {
    "ORDER_STATUS",
    "PAY_SUCCESS",
    "COUNSELOR_APPOINTMENT_NEW",
    "COUNSELOR_APPOINTMENT_CANCEL",
}


def ensure_row(db, event_key, template_id, description, role_scope="All", active=True):
    row = db.query(AppSubscribeTemplate).filter(AppSubscribeTemplate.EventKey == event_key).first()
    if not row:
        row = AppSubscribeTemplate(EventKey=event_key)
        db.add(row)
    row.TemplateId = template_id
    row.Description = description
    if hasattr(row, "RoleScope"):
        row.RoleScope = role_scope
    row.IsActive = active


def main():
    db = SessionLocal()
    try:
        for item in REAL_TEMPLATES:
            ensure_row(
                db,
                item["event_key"],
                item["template_id"],
                item["description"],
                item.get("role_scope", "All"),
                active=True,
            )
            print(f"[OK] {item['event_key']} -> {item['template_id']}")

        for key in DISABLE_EVENT_KEYS:
            row = db.query(AppSubscribeTemplate).filter(AppSubscribeTemplate.EventKey == key).first()
            if row:
                row.IsActive = False
                print(f"[OK] disabled {key}")

        db.commit()
        print("[OK] 订阅消息模板已更新。请重启 uvicorn 后访问:")
        print(
            "  GET /api/mini/message/templates"
            "?event_keys=APPOINTMENT_OK,APPOINTMENT_REMIND,STAFF_APPROVAL_PENDING"
        )
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
