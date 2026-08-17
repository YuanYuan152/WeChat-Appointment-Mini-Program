import unittest
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import AppConsultation, AppConsultationRoom, AppOrder, AppSchedule
from ops import delete_room
from schedule_meta import get_consultation_rooms, room_display_name


class RoomDeletionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()
        self.room = AppConsultationRoom(
            CenterId="yangpu",
            RoomCode="yangpu-r1",
            Name="测试咨询室",
            Status="AVAILABLE",
            SortOrder=1,
        )
        self.db.add(self.room)
        self.db.commit()
        self.db.refresh(self.room)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_schedule(self, *, status: str = "BOOKED") -> AppSchedule:
        start = datetime.utcnow() + timedelta(days=1)
        row = AppSchedule(
            CounselorId=10,
            StartTime=start,
            EndTime=start + timedelta(minutes=50),
            Status=status,
            Note="center:yangpu;room:yangpu-r1",
        )
        self.db.add(row)
        self.db.flush()
        return row

    def test_pending_order_blocks_room_deletion(self):
        schedule = self.add_schedule(status="AVAILABLE")
        self.db.add(
            AppOrder(
                AccountId=20,
                SlotId=schedule.Id,
                OutTradeNo="ROOM-DELETE-PENDING",
                TotalFee=60_000,
                Status="PENDING",
            )
        )
        self.db.commit()

        with self.assertRaises(HTTPException) as caught:
            delete_room(self.room.Id, _ops=None, db=self.db)

        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("未完成", caught.exception.detail)
        self.db.refresh(self.room)
        self.assertEqual(self.room.Status, "AVAILABLE")

    def test_active_consultation_blocks_room_deletion(self):
        schedule = self.add_schedule()
        self.db.add(
            AppConsultation(
                PatientId=20,
                CounselorId=10,
                ScheduleId=schedule.Id,
                Status="CONFIRMED",
                StartTime=schedule.StartTime,
                EndTime=schedule.EndTime,
                Note=schedule.Note,
            )
        )
        self.db.commit()

        with self.assertRaises(HTTPException) as caught:
            delete_room(self.room.Id, _ops=None, db=self.db)

        self.assertEqual(caught.exception.status_code, 400)

    def test_orphan_booked_schedule_blocks_room_deletion(self):
        self.add_schedule()
        self.db.commit()

        with self.assertRaises(HTTPException) as caught:
            delete_room(self.room.Id, _ops=None, db=self.db)

        self.assertEqual(caught.exception.status_code, 400)

    def test_done_consultation_allows_soft_delete_and_preserves_history_name(self):
        schedule = self.add_schedule()
        self.db.add(
            AppConsultation(
                PatientId=20,
                CounselorId=10,
                ScheduleId=schedule.Id,
                Status="DONE",
                StartTime=schedule.StartTime,
                EndTime=schedule.EndTime,
                Note=schedule.Note,
            )
        )
        self.db.commit()

        result = delete_room(self.room.Id, _ops=None, db=self.db)

        self.assertEqual(result["msg"], "咨询室已删除")
        self.db.refresh(self.room)
        self.assertEqual(self.room.Status, "DELETED")
        self.assertNotIn(
            "yangpu-r1",
            [room["id"] for room in get_consultation_rooms(self.db, "yangpu")],
        )
        self.assertEqual(
            room_display_name("yangpu", "yangpu-r1", self.db),
            "测试咨询室",
        )


if __name__ == "__main__":
    unittest.main()
