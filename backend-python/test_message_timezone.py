import unittest
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from message import _message_response, create_message
from models import AppAccount, AppMessage


class MessageTimezoneTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_message_response_converts_stored_utc_to_china_time(self):
        self.db.add(
            AppAccount(
                Id=1,
                Mobile="13800000001",
                ActiveRole="Patient",
                IsActive=True,
            )
        )
        message = AppMessage(
            Id=1,
            AccountId=1,
            Type="SYSTEM",
            Title="新增预约",
            IsRead=True,
            CreatedAt=datetime(2026, 8, 28, 1, 30),
            ReadAt=datetime(2026, 8, 28, 2, 15),
        )
        self.db.add(message)
        self.db.commit()

        result = _message_response(message, self.db)

        self.assertEqual(result["CreatedAt"].strftime("%Y-%m-%d %H:%M"), "2026-08-28 09:30")
        self.assertEqual(result["ReadAt"].strftime("%Y-%m-%d %H:%M"), "2026-08-28 10:15")
        self.assertEqual(result["CreatedAt"].utcoffset(), timedelta(hours=8))

    def test_new_message_uses_application_utc_instead_of_database_local_time(self):
        before = datetime.utcnow()
        message = create_message(self.db, 1, "SYSTEM", "系统通知")
        after = datetime.utcnow()

        self.assertIsNotNone(message.CreatedAt)
        self.assertLessEqual(before, message.CreatedAt)
        self.assertLessEqual(message.CreatedAt, after)


if __name__ == "__main__":
    unittest.main()
