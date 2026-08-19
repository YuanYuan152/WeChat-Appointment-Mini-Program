"""一次性清理：将所有来访（Patient 角色）账号的 AvatarUrl 置空，统一走默认兔子头像。"""

from database import SessionLocal
from user_avatar import clear_visitor_account_avatars


def main() -> None:
    db = SessionLocal()
    try:
        cleared = clear_visitor_account_avatars(db)
        print(f"[OK] cleared AvatarUrl for {cleared} visitor account(s)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
