"""
管理员角色演示数据注入。

用法: python seed_demo_admin.py

会先清空所有 App 表，再写入：
  - 管理员账号
  - 多角色示例用户（供角色绑定/解绑接口测试）
  - 基础内容数据
"""

from seed_base import bind_role, clear_all_tables, create_account
from database import SessionLocal
from models import AppActivity, AppBanner, AppRoleBinding


def seed(db):
    clear_all_tables(db)

    admin = create_account(
        db,
        mobile="13800000004",
        open_id="demo-openid-admin",
        nickname="系统管理员",
        active_role="Admin",
        real_name="系统管理员",
        gender="男",
    )
    bind_role(db, admin.Id, "Admin")
    bind_role(db, admin.Id, "Ops")
    bind_role(db, admin.Id, "Patient")

    role_users = [
        ("13800000000", "demo-openid-patient-only", "纯患者用户", "Patient", ["Patient"]),
        ("13800000001", "demo-openid-counselor-only", "咨询师用户", "Counselor", ["Patient", "Counselor"]),
        ("13800000002", "demo-openid-assistant-only", "助理用户", "Assistant", ["Patient", "Assistant"]),
        ("13800000003", "demo-openid-ops-only", "运营用户", "Ops", ["Patient", "Ops"]),
        ("13800000005", "demo-openid-multi-role", "多角色用户", "Patient", ["Patient", "Counselor", "Assistant"]),
    ]

    created_users = []
    for mobile, open_id, nickname, active_role, roles in role_users:
        user = create_account(
            db,
            mobile=mobile,
            open_id=open_id,
            nickname=nickname,
            active_role=active_role,
            real_name=nickname,
        )
        for role in roles:
            bind_role(db, user.Id, role)
        created_users.append(user)

    db.add(
        AppBanner(
            Title="管理员测试 Banner",
            ImageUrl="/static/images/slide11.png",
            LinkType="PAGE",
            LinkValue="/pages/index/index",
            SortOrder=1,
            IsActive=True,
        )
    )
    db.add(
        AppActivity(
            Type="NOTICE",
            Title="管理员初始化数据",
            Content="此活动由 seed_demo_admin.py 注入，用于验证运营读取接口。",
            CoverUrl="/static/images/huodong11.png",
            IsActive=True,
            SortOrder=1,
        )
    )

    return admin, created_users


def main():
    db = SessionLocal()
    try:
        admin, users = seed(db)
        db.commit()
        print("[OK] admin demo data seeded")
        print(f"[OK] admin mobile: {admin.Mobile}, account_id: {admin.Id}")
        print("[OK] sample users for role management:")
        for user in users:
            roles = (
                db.query(AppRoleBinding.RoleType)
                .filter(AppRoleBinding.AccountId == user.Id)
                .all()
            )
            role_names = ", ".join(r[0] for r in roles)
            print(f"     - {user.Mobile} ({user.Nickname}): {role_names}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
