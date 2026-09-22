import unittest
from datetime import datetime
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import (
    AppAccount,
    AppConsultation,
    AppConsultationRoom,
    AppConsultationRoomSlot,
    AppCounselorProfile,
    AppLeaveRequest,
    AppOrder,
    AppSchedule,
    AppScheduleRescheduleLog,
)
from schedule_reschedule_service import (
    build_reschedule_options,
    reschedule_booked_consultation,
)


class ScheduleRescheduleTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppSchedule.__table__,
                AppAccount.__table__,
                AppCounselorProfile.__table__,
                AppConsultation.__table__,
                AppOrder.__table__,
                AppLeaveRequest.__table__,
                AppScheduleRescheduleLog.__table__,
                AppConsultationRoom.__table__,
                AppConsultationRoomSlot.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_booking(self, *, description="normal", center="video"):
        source = AppSchedule(
            Id=1,
            CounselorId=10,
            StartTime=datetime(2099, 1, 1, 9, 0),
            EndTime=datetime(2099, 1, 1, 9, 50),
            Status="BOOKED",
            Note=f"center:{center}" + (f";room:{center}-r1" if center != "video" else ""),
        )
        order = AppOrder(
            Id=1,
            AccountId=20,
            SlotId=source.Id,
            OutTradeNo="RESCHEDULE-1",
            TotalFee=60_000,
            Status="PAID",
            Description=description,
        )
        consultation = AppConsultation(
            Id=1,
            OrderId=order.Id,
            PatientId=20,
            CounselorId=10,
            ScheduleId=source.Id,
            Status="CONFIRMED",
            StartTime=source.StartTime,
            EndTime=source.EndTime,
            Note=source.Note,
        )
        self.db.add_all([source, order, consultation])
        self.db.flush()
        return source, order, consultation

    def test_reschedule_moves_to_available_slot_and_restores_original(self):
        source, order, consultation = self.add_booking()
        target = AppSchedule(
            Id=2,
            CounselorId=10,
            StartTime=datetime(2099, 1, 2, 10, 0),
            EndTime=datetime(2099, 1, 2, 10, 50),
            Status="AVAILABLE",
            Note="center:video",
        )
        self.db.add(target)
        self.db.flush()

        with (
            patch("schedule_reschedule_service.validate_slot_in_rolling_window"),
            patch("schedule_reschedule_service._refresh_consultation_tasks_and_messages") as refresh,
        ):
            result = reschedule_booked_consultation(
                self.db,
                schedule_id=source.Id,
                operator_account_id=99,
                new_start_time=target.StartTime,
                new_end_time=target.EndTime,
                room_id=None,
                reason=" 来访时间冲突 ",
            )

        self.assertEqual(result["scheduleId"], target.Id)
        self.assertEqual(source.Status, "AVAILABLE")
        self.assertEqual(target.Status, "BOOKED")
        self.assertEqual(consultation.ScheduleId, target.Id)
        self.assertEqual(consultation.StartTime, target.StartTime)
        self.assertEqual(consultation.EndTime, target.EndTime)
        self.assertEqual(order.SlotId, target.Id)
        self.assertEqual(
            self.db.query(AppScheduleRescheduleLog).one().Reason,
            "来访时间冲突",
        )
        refresh.assert_called_once()

    def test_proxy_created_slot_is_cancelled_after_move(self):
        source, _, _ = self.add_booking(description="proxy:99|center:video|new")
        new_start = datetime(2099, 1, 3, 13, 0)
        with (
            patch("schedule_reschedule_service.validate_slot_in_rolling_window"),
            patch("schedule_reschedule_service._refresh_consultation_tasks_and_messages"),
        ):
            result = reschedule_booked_consultation(
                self.db,
                schedule_id=source.Id,
                operator_account_id=99,
                new_start_time=new_start,
                new_end_time=datetime(2099, 1, 3, 13, 50),
                room_id=None,
                reason="协调改期",
            )
        self.assertEqual(source.Status, "CANCELLED")
        self.assertNotEqual(result["scheduleId"], source.Id)

    def test_reschedule_rejects_blank_reason_and_conflicting_counselor_slot(self):
        source, _, _ = self.add_booking()
        with self.assertRaisesRegex(ValueError, "修改原因不能为空"):
            reschedule_booked_consultation(
                self.db,
                schedule_id=source.Id,
                operator_account_id=99,
                new_start_time=datetime(2099, 1, 2, 9, 0),
                new_end_time=datetime(2099, 1, 2, 9, 50),
                room_id=None,
                reason=" ",
            )

        self.db.add(
            AppSchedule(
                CounselorId=10,
                StartTime=datetime(2099, 1, 2, 9, 0),
                EndTime=datetime(2099, 1, 2, 9, 50),
                Status="BOOKED",
                Note="center:video",
            )
        )
        self.db.flush()
        with (
            patch("schedule_reschedule_service.validate_slot_in_rolling_window"),
            self.assertRaisesRegex(ValueError, "已有其他排期"),
        ):
            reschedule_booked_consultation(
                self.db,
                schedule_id=source.Id,
                operator_account_id=99,
                new_start_time=datetime(2099, 1, 2, 9, 0),
                new_end_time=datetime(2099, 1, 2, 9, 50),
                room_id=None,
                reason="改期",
            )

    def test_reschedule_rejects_consultation_that_already_started(self):
        source, _, consultation = self.add_booking()
        consultation.Status = "ONGOING"
        self.db.flush()

        with self.assertRaisesRegex(ValueError, "仅已预约且尚未完成"):
            reschedule_booked_consultation(
                self.db,
                schedule_id=source.Id,
                operator_account_id=99,
                new_start_time=datetime(2099, 1, 2, 9, 0),
                new_end_time=datetime(2099, 1, 2, 9, 50),
                room_id=None,
                reason="改期",
            )

    def test_notification_failure_aborts_reschedule(self):
        source, _, _ = self.add_booking()
        with (
            patch("schedule_reschedule_service.validate_slot_in_rolling_window"),
            patch(
                "schedule_reschedule_service._refresh_consultation_tasks_and_messages",
                side_effect=RuntimeError("message write failed"),
            ),
            self.assertRaisesRegex(RuntimeError, "message write failed"),
        ):
            reschedule_booked_consultation(
                self.db,
                schedule_id=source.Id,
                operator_account_id=99,
                new_start_time=datetime(2099, 1, 2, 9, 0),
                new_end_time=datetime(2099, 1, 2, 9, 50),
                room_id=None,
                reason="协调改期",
            )

    def test_options_marks_occupied_room_unavailable(self):
        source, _, _ = self.add_booking(center="yangpu")
        self.db.add_all(
            [
                AppConsultationRoom(
                    Id=1,
                    CenterId="yangpu",
                    RoomCode="yangpu-r1",
                    Name="咨询室 A",
                    Status="AVAILABLE",
                    SortOrder=1,
                ),
                AppConsultationRoom(
                    Id=2,
                    CenterId="yangpu",
                    RoomCode="yangpu-r2",
                    Name="咨询室 B",
                    Status="AVAILABLE",
                    SortOrder=2,
                ),
                AppSchedule(
                    CounselorId=11,
                    StartTime=datetime(2099, 1, 2, 9, 0),
                    EndTime=datetime(2099, 1, 2, 9, 50),
                    Status="BOOKED",
                    Note="center:yangpu;room:yangpu-r1",
                ),
            ]
        )
        self.db.flush()
        with (
            patch("schedule_reschedule_service.china_now", return_value=datetime(2099, 1, 1, 8, 0)),
            patch("schedule_reschedule_service.booking_lead_time_reason", return_value=None),
        ):
            options = build_reschedule_options(
                self.db,
                schedule_id=source.Id,
                target_date=datetime(2099, 1, 2).date(),
            )
        nine = next(item for item in options["slots"] if item["key"] == "09:00")
        rooms = {room["roomId"]: room for room in nine["rooms"]}
        self.assertFalse(rooms["yangpu-r1"]["available"])
        self.assertTrue(rooms["yangpu-r2"]["available"])

    def test_overview_searches_counselor_and_patient_nicknames(self):
        from app_time import china_now
        from ops import ops_schedules_overview

        start = datetime.combine(
            china_now().date(),
            datetime.min.time(),
        ).replace(hour=13)
        self.db.add_all(
            [
                AppAccount(Id=10, Mobile="13800000010", RealName="咨询师实名", Nickname="星河老师", IsActive=True),
                AppCounselorProfile(AccountId=10, Name="咨询师档案名", IsActive=True),
                AppAccount(Id=20, Mobile="13800000020", RealName="来访实名", Nickname="小月亮", IsActive=True),
                AppSchedule(
                    Id=10,
                    CounselorId=10,
                    StartTime=start,
                    EndTime=start.replace(minute=50),
                    Status="BOOKED",
                    Note="center:video",
                ),
                AppConsultation(
                    Id=10,
                    PatientId=20,
                    CounselorId=10,
                    ScheduleId=10,
                    Status="CONFIRMED",
                    StartTime=start,
                    EndTime=start.replace(minute=50),
                    Note="center:video",
                ),
            ]
        )
        self.db.flush()

        with patch("ops._schedule_patient_info", return_value=("来访实名", None, None)):
            by_counselor = ops_schedules_overview(
                date=None, keyword="星河", _ops=None, db=self.db,
            )
            by_patient = ops_schedules_overview(
                date=None, keyword="小月亮", _ops=None, db=self.db,
            )

        self.assertEqual(by_counselor["counselors"][0]["counselorId"], 10)
        self.assertEqual(by_patient["counselors"][0]["schedules"][0]["scheduleId"], 10)


if __name__ == "__main__":
    unittest.main()
