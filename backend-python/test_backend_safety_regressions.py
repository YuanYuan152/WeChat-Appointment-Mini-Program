import json
import os
import unittest
from datetime import datetime, time, timedelta
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from account_deletion_service import hard_delete_account
from admin import (
    AdminCounselorUpdatePayload,
    BindRoleRequest,
    bind_user_role,
    update_admin_counselor,
)
from app_time import china_now
from booking_availability import schedules_to_booking_time_slots
from counselor import ScheduleCreate, create_schedule, schedule_slot_options
from database import Base
from message import require_message_internal_or_staff
from message_enrich import enrich_message
from models import (
    AppAccount,
    AppConsultation,
    AppConsultationRoom,
    AppCounselorProfile,
    AppMessage,
    AppOrder,
    AppRoleBinding,
    AppRoleSwitchLog,
    AppSchedule,
)
from patient_contract_service import (
    COUNSELOR_UNAVAILABLE_FOR_PAYMENT,
    assert_counselor_active_for_booking,
    retire_counselor_booking_relationships,
)
from ops import _available_rooms_for_schedule, _room_occupancy_at
from payment import CreateOrderRequest, _create_pending_order, _load_payable_order
from payment_service import complete_paid_order
from proxy_booking_service import build_proxy_slot_options
from role_active import get_account_role
from schedule_slots import (
    BOOKING_LEAD_TIME_MESSAGE,
    booking_lead_time_reason,
    validate_booking_lead_time,
)


class BackendSafetyRegressionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_counselor(self, counselor_id: int = 2, name: str = "李咨询") -> AppAccount:
        account = AppAccount(
            Id=counselor_id,
            Mobile=f"138{counselor_id:08d}"[-11:],
            RealName=name,
            ActiveRole="Counselor",
            IsActive=True,
        )
        self.db.add(account)
        self.db.add(AppRoleBinding(AccountId=counselor_id, RoleType="Counselor"))
        self.db.add(
            AppCounselorProfile(
                AccountId=counselor_id,
                Name=name,
                Billing=60_000,
                FaceBilling=30_000,
                IsActive=True,
            )
        )
        return account

    def add_patient(
        self,
        patient_id: int = 1,
        counselor_id: int = 2,
        *,
        signed: bool = True,
    ) -> AppAccount:
        patient = AppAccount(
            Id=patient_id,
            Mobile=f"139{patient_id:08d}"[-11:],
            RealName="林小美",
            ActiveRole="Patient",
            IsActive=True,
            BoundCounselorId=counselor_id,
            BoundCounselorChangedAt=datetime.utcnow() - timedelta(days=1),
            IsContractSigned=signed,
        )
        self.db.add(patient)
        self.db.add(AppRoleBinding(AccountId=patient_id, RoleType="Patient"))
        return patient

    def add_schedule_order(
        self,
        *,
        schedule_id: int = 101,
        patient_id: int = 1,
        counselor_id: int = 2,
        schedule_status: str = "AVAILABLE",
        order_status: str = "PENDING",
        description: str = "proxy:90|center:video|schedule:existing",
    ) -> tuple[AppSchedule, AppOrder]:
        start = china_now() + timedelta(days=2)
        schedule = AppSchedule(
            Id=schedule_id,
            CounselorId=counselor_id,
            StartTime=start,
            EndTime=start + timedelta(minutes=50),
            Status=schedule_status,
            Note="center:video",
        )
        order = AppOrder(
            Id=schedule_id + 1000,
            AccountId=patient_id,
            SlotId=schedule_id,
            OutTradeNo=f"SAFE-{schedule_id}",
            TotalFee=60_000,
            Status=order_status,
            Description=description,
            ExpiresAt=china_now() + timedelta(hours=1),
        )
        self.db.add_all([schedule, order])
        return schedule, order

    def test_internal_message_routes_require_staff_or_configured_token(self):
        patient = self.add_patient(counselor_id=999)
        staff = AppAccount(
            Id=90,
            Mobile="13800000090",
            ActiveRole="Assistant",
            IsActive=True,
        )
        self.db.add(staff)
        self.db.add(AppRoleBinding(AccountId=90, RoleType="Assistant"))
        self.db.commit()

        empty_tokens = {
            "MESSAGE_INTERNAL_TOKEN": "",
            "LXXL_MESSAGE_INTERNAL_TOKEN": "",
        }
        with patch.dict(os.environ, empty_tokens):
            with self.assertRaises(HTTPException) as anonymous:
                require_message_internal_or_staff(None, None, self.db)
            self.assertEqual(anonymous.exception.status_code, 401)

            with self.assertRaises(HTTPException) as non_staff:
                require_message_internal_or_staff(None, patient, self.db)
            self.assertEqual(non_staff.exception.status_code, 403)
            self.assertIs(
                require_message_internal_or_staff(None, staff, self.db),
                staff,
            )

        with patch.dict(os.environ, {"MESSAGE_INTERNAL_TOKEN": "cron-secret"}):
            self.assertIsNone(
                require_message_internal_or_staff("cron-secret", None, self.db)
            )
            with self.assertRaises(HTTPException) as invalid:
                require_message_internal_or_staff("wrong", None, self.db)
            self.assertEqual(invalid.exception.status_code, 401)

    def test_payable_order_rejects_inactive_counselor_profile(self):
        self.add_counselor()
        patient = self.add_patient()
        _schedule, order = self.add_schedule_order()
        self.db.commit()
        profile = self.db.query(AppCounselorProfile).filter_by(AccountId=2).one()
        profile.IsActive = False
        self.db.commit()

        with self.assertRaises(HTTPException) as raised:
            _load_payable_order(self.db, patient, order.Id)
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail, COUNSELOR_UNAVAILABLE_FOR_PAYMENT)

    def test_new_pending_order_rejects_counselor_deactivated_after_page_load(self):
        self.add_counselor()
        patient = self.add_patient()
        schedule, _existing = self.add_schedule_order()
        self.db.commit()
        profile = self.db.query(AppCounselorProfile).filter_by(AccountId=2).one()
        profile.IsActive = False
        self.db.commit()

        request = CreateOrderRequest(slot_id=schedule.Id, total_fee=60_000)
        with self.assertRaises(HTTPException) as raised:
            _create_pending_order(self.db, patient, request, "NEW-SAFETY-CHECK")
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail, COUNSELOR_UNAVAILABLE_FOR_PAYMENT)

    def test_payment_completion_rechecks_counselor_role_before_mutation(self):
        self.add_counselor()
        self.add_patient()
        schedule, order = self.add_schedule_order()
        self.db.commit()
        self.db.query(AppRoleBinding).filter(
            AppRoleBinding.AccountId == 2,
            AppRoleBinding.RoleType == "Counselor",
        ).delete(synchronize_session=False)
        self.db.commit()

        with self.assertRaisesRegex(ValueError, "咨询师账号已停用"):
            complete_paid_order(self.db, order)
        self.db.refresh(order)
        self.db.refresh(schedule)
        self.assertEqual(order.Status, "PENDING")
        self.assertEqual(schedule.Status, "AVAILABLE")

    def test_booking_lead_time_accepts_exact_90_minute_boundary(self):
        now = datetime(2026, 8, 14, 9, 0)

        self.assertIsNone(booking_lead_time_reason(now + timedelta(minutes=90), now))
        validate_booking_lead_time(now + timedelta(minutes=90), now)
        self.assertEqual(
            booking_lead_time_reason(now + timedelta(minutes=89, seconds=59), now),
            BOOKING_LEAD_TIME_MESSAGE,
        )

    def test_payment_create_load_and_complete_reject_slots_under_90_minutes(self):
        self.add_counselor()
        patient = self.add_patient()
        schedule, order = self.add_schedule_order()
        now = china_now()
        schedule.StartTime = now + timedelta(minutes=89)
        schedule.EndTime = schedule.StartTime + timedelta(minutes=50)
        order.ExpiresAt = now + timedelta(minutes=30)
        self.db.commit()

        request = CreateOrderRequest(slot_id=schedule.Id, total_fee=60_000)
        with patch("schedule_slots.china_now", return_value=now):
            with self.assertRaisesRegex(HTTPException, BOOKING_LEAD_TIME_MESSAGE):
                _create_pending_order(self.db, patient, request, "LEAD-CREATE")
            with self.assertRaisesRegex(HTTPException, BOOKING_LEAD_TIME_MESSAGE):
                _load_payable_order(self.db, patient, order.Id)
            with self.assertRaisesRegex(ValueError, BOOKING_LEAD_TIME_MESSAGE):
                complete_paid_order(self.db, order, center_id="video")

        self.db.refresh(order)
        self.db.refresh(schedule)
        self.assertEqual(order.Status, "PENDING")
        self.assertEqual(schedule.Status, "AVAILABLE")

    def test_booking_availability_returns_gray_reason_under_90_minutes(self):
        now = china_now()
        schedule = AppSchedule(
            Id=8201,
            CounselorId=2,
            StartTime=now + timedelta(minutes=60),
            EndTime=now + timedelta(minutes=110),
            Status="AVAILABLE",
            Note="center:video",
        )
        self.db.add(schedule)
        self.db.commit()

        with patch("schedule_slots.china_now", return_value=now):
            slots, _center_ids = schedules_to_booking_time_slots(
                self.db,
                [schedule],
                billing_cents=60_000,
            )

        self.assertEqual(slots[0]["status"], "TOO_SOON")
        self.assertFalse(slots[0]["isBookable"])
        self.assertEqual(slots[0]["unavailableReason"], BOOKING_LEAD_TIME_MESSAGE)

    def test_counselor_and_proxy_slot_options_gray_slots_under_90_minutes(self):
        counselor = self.add_counselor()
        now = datetime(2026, 8, 14, 9, 0)

        with patch("counselor.china_now", return_value=now):
            counselor_options = schedule_slot_options(
                date=now.date().isoformat(),
                center_id="video",
                counselor=counselor,
                db=self.db,
            )
        counselor_slot = next(item for item in counselor_options.slots if item.startTime.hour == 10)
        self.assertTrue(counselor_slot.tooSoon)
        self.assertEqual(counselor_slot.unavailableReason, BOOKING_LEAD_TIME_MESSAGE)

        with patch("proxy_booking_service._now", return_value=now):
            proxy_options = build_proxy_slot_options(
                self.db,
                counselor.Id,
                now.date(),
                "video",
            )
        proxy_slot = next(item for item in proxy_options if item["key"] == "10:00")
        self.assertTrue(proxy_slot["tooSoon"])
        self.assertFalse(proxy_slot["selectable"])
        self.assertEqual(proxy_slot["unavailableReason"], BOOKING_LEAD_TIME_MESSAGE)

    def test_schedule_creation_rejects_slot_under_90_minutes(self):
        counselor = self.add_counselor()
        now = datetime(2026, 8, 14, 9, 0)
        start = now + timedelta(minutes=60)

        with patch("schedule_slots.china_now", return_value=now):
            with self.assertRaisesRegex(HTTPException, BOOKING_LEAD_TIME_MESSAGE):
                create_schedule(
                    ScheduleCreate(
                        start_time=start,
                        end_time=start + timedelta(minutes=50),
                        center_id="video",
                    ),
                    counselor,
                    self.db,
                )

    def test_active_counselor_check_requires_account_role_and_profile(self):
        counselor = self.add_counselor()
        self.db.commit()
        assert_counselor_active_for_booking(self.db, counselor.Id)

        counselor.IsActive = False
        self.db.commit()
        with self.assertRaisesRegex(ValueError, "订单已失效"):
            assert_counselor_active_for_booking(self.db, counselor.Id)

    def test_retire_unbinds_cancels_pending_and_cancels_future_availability(self):
        self.add_counselor()
        patient = self.add_patient()
        schedule, order = self.add_schedule_order()
        self.db.commit()

        result = retire_counselor_booking_relationships(self.db, 2)
        self.db.commit()
        self.db.refresh(patient)
        self.db.refresh(schedule)
        self.db.refresh(order)
        self.assertIsNone(patient.BoundCounselorId)
        self.assertFalse(patient.IsContractSigned)
        self.assertEqual(order.Status, "CANCELLED")
        self.assertEqual(schedule.Status, "CANCELLED")
        self.assertEqual(result["unboundPatients"], 1)
        self.assertEqual(result["cancelledPendingOrders"], 1)
        self.assertEqual(result["cancelledFutureSchedules"], 1)

    def test_retire_blocks_future_booked_or_paid_appointment(self):
        self.add_counselor()
        patient = self.add_patient()
        schedule, order = self.add_schedule_order(
            schedule_status="BOOKED",
            order_status="PAID",
        )
        self.db.commit()

        with self.assertRaisesRegex(ValueError, "仍有未完成的预约"):
            retire_counselor_booking_relationships(self.db, 2)
        self.db.refresh(patient)
        self.db.refresh(schedule)
        self.db.refresh(order)
        self.assertEqual(patient.BoundCounselorId, 2)
        self.assertTrue(patient.IsContractSigned)
        self.assertEqual(schedule.Status, "BOOKED")
        self.assertEqual(order.Status, "PAID")

    def test_retire_blocks_future_active_consultation(self):
        self.add_counselor()
        self.add_patient()
        schedule, order = self.add_schedule_order(order_status="CANCELLED")
        consultation = AppConsultation(
            Id=5001,
            OrderId=order.Id,
            PatientId=1,
            CounselorId=2,
            ScheduleId=schedule.Id,
            Status="CONFIRMED",
            StartTime=schedule.StartTime,
            EndTime=schedule.EndTime,
            Note="center:video",
        )
        self.db.add(consultation)
        self.db.commit()

        with self.assertRaisesRegex(ValueError, "仍有未完成的预约"):
            retire_counselor_booking_relationships(self.db, 2)
        self.assertEqual(consultation.Status, "CONFIRMED")

    def test_role_change_uses_retirement_cleanup_in_same_transaction(self):
        self.add_counselor()
        patient = self.add_patient()
        schedule, order = self.add_schedule_order()
        admin = AppAccount(
            Id=90,
            Mobile="13800000090",
            ActiveRole="Admin",
            IsActive=True,
        )
        self.db.add(admin)
        self.db.add(AppRoleBinding(AccountId=90, RoleType="Admin"))
        self.db.commit()

        with patch(
            "admin.AppRoleSwitchLog",
            side_effect=lambda **values: AppRoleSwitchLog(Id=8001, **values),
        ):
            bind_user_role(2, BindRoleRequest(role="Assistant"), admin, self.db)
        self.db.refresh(patient)
        self.db.refresh(schedule)
        self.db.refresh(order)
        profile = self.db.query(AppCounselorProfile).filter_by(AccountId=2).one()
        self.assertEqual(get_account_role(self.db, 2), "Assistant")
        self.assertFalse(profile.IsActive)
        self.assertIsNone(patient.BoundCounselorId)
        self.assertEqual(schedule.Status, "CANCELLED")
        self.assertEqual(order.Status, "CANCELLED")

    def test_admin_deactivation_rejects_future_booked_appointment(self):
        counselor = self.add_counselor()
        self.add_patient()
        self.add_schedule_order(schedule_status="BOOKED", order_status="PAID")
        admin = AppAccount(
            Id=90,
            Mobile="13800000090",
            ActiveRole="Admin",
            IsActive=True,
        )
        self.db.add(admin)
        self.db.add(AppRoleBinding(AccountId=90, RoleType="Admin"))
        self.db.commit()

        with self.assertRaises(HTTPException) as raised:
            update_admin_counselor(
                counselor.Id,
                AdminCounselorUpdatePayload(isActive=False),
                admin,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 400)
        profile = self.db.query(AppCounselorProfile).filter_by(AccountId=2).one()
        self.assertTrue(profile.IsActive)

    def test_hard_delete_preserves_cancelled_order_without_orphan_slot(self):
        self.add_counselor()
        patient = self.add_patient()
        schedule, order = self.add_schedule_order()
        schedule_id = schedule.Id
        self.db.commit()

        hard_delete_account(self.db, 2)
        self.db.commit()
        self.db.refresh(patient)
        self.db.refresh(order)
        self.assertIsNone(self.db.query(AppAccount).filter_by(Id=2).first())
        self.assertIsNone(self.db.query(AppSchedule).filter_by(Id=schedule_id).first())
        self.assertEqual(order.Status, "CANCELLED")
        self.assertIsNone(order.SlotId)
        self.assertIsNone(patient.BoundCounselorId)
        self.assertFalse(patient.IsContractSigned)

    def test_hard_delete_blocks_paid_order_even_without_consultation_row(self):
        self.add_counselor()
        self.add_patient()
        schedule, order = self.add_schedule_order(
            schedule_status="BOOKED",
            order_status="PAID",
        )
        self.db.commit()

        with self.assertRaisesRegex(ValueError, "排期存在已支付订单"):
            hard_delete_account(self.db, 2)
        self.assertIsNotNone(self.db.query(AppAccount).filter_by(Id=2).first())
        self.assertIsNotNone(self.db.query(AppSchedule).filter_by(Id=schedule.Id).first())
        self.assertEqual(order.Status, "PAID")

    def test_proxy_order_message_enriches_live_status_and_contract(self):
        self.add_counselor(name="李心怡")
        patient = self.add_patient()
        schedule, order = self.add_schedule_order()
        self.db.commit()
        message = AppMessage(
            Id=7001,
            AccountId=2,
            Type="ORDER",
            Title="代理预约待支付",
            Content=json.dumps(
                {
                    "summary": "旧快照",
                    "detail": {
                        "patientName": "旧名字",
                        "patientContractTag": None,
                        "location": "视频咨询",
                    },
                },
                ensure_ascii=False,
            ),
            RelatedType="COUNSELOR_PROXY_ORDER_PENDING",
            RelatedId=order.Id,
            IsRead=False,
            CreatedAt=datetime.utcnow(),
        )

        pending = enrich_message(message, self.db)
        pending_payload = json.loads(pending.Content)
        self.assertEqual(pending_payload["detail"]["status"], "PENDING")
        self.assertEqual(
            pending_payload["detail"]["patientContractTag"],
            "已签约-【李心怡】",
        )

        order.Status = "PAID"
        self.db.commit()
        paid = enrich_message(message, self.db)
        paid_payload = json.loads(paid.Content)
        self.assertEqual(paid.Title, "代理预约已支付")
        self.assertEqual(paid_payload["detail"]["statusLabel"], "已支付")

        order.Status = "CANCELLED"
        patient.BoundCounselorId = None
        patient.IsContractSigned = False
        self.db.commit()
        cancelled = enrich_message(message, self.db)
        cancelled_payload = json.loads(cancelled.Content)
        self.assertEqual(cancelled.Title, "代理预约已取消")
        self.assertEqual(cancelled_payload["detail"]["status"], "CANCELLED")
        self.assertIsNone(cancelled_payload["detail"]["patientContractTag"])

        order.Status = "PENDING"
        order.ExpiresAt = china_now() - timedelta(minutes=1)
        self.db.commit()
        expired = enrich_message(message, self.db)
        expired_payload = json.loads(expired.Content)
        self.assertEqual(expired.Title, "代理预约已过期")
        self.assertEqual(expired_payload["detail"]["status"], "EXPIRED")

    def test_counselor_schedule_rejects_globally_disabled_room(self):
        counselor = self.add_counselor()
        start = datetime.combine(
            (china_now() + timedelta(days=2)).date(),
            time(9, 0),
        )
        room = AppConsultationRoom(
            Id=8101,
            CenterId="yangpu",
            RoomCode="disabled-room",
            Name="停用咨询室",
            Status="DISABLED",
            SortOrder=1,
        )
        self.db.add(room)
        self.db.commit()
        room_payload = [{
            "id": room.RoomCode,
            "name": room.Name,
            "status": room.Status,
            "dbId": room.Id,
        }]

        with patch("counselor.get_consultation_rooms", return_value=room_payload):
            options = schedule_slot_options(
                date=start.date().isoformat(),
                center_id="yangpu",
                counselor=counselor,
                db=self.db,
            )
            matching = next(item for item in options.slots if item.startTime == start)
            self.assertFalse(matching.rooms[0].available)
            self.assertTrue(matching.allRoomsFull)

            with self.assertRaises(HTTPException) as raised:
                create_schedule(
                    ScheduleCreate(
                        start_time=start,
                        end_time=start + timedelta(minutes=50),
                        center_id="yangpu",
                        room_id=room.RoomCode,
                    ),
                    counselor,
                    self.db,
                )
        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("暂无可用咨询室", raised.exception.detail)

    def test_ops_room_views_respect_globally_disabled_room(self):
        self.add_counselor()
        start = datetime.combine(
            (china_now() + timedelta(days=2)).date(),
            time(9, 0),
        )
        schedule = AppSchedule(
            Id=8102,
            CounselorId=2,
            StartTime=start,
            EndTime=start + timedelta(minutes=50),
            Status="BOOKED",
            Note="center:yangpu;room:disabled-room",
        )
        room = AppConsultationRoom(
            Id=8103,
            CenterId="yangpu",
            RoomCode="disabled-room",
            Name="停用咨询室",
            Status="DISABLED",
            SortOrder=1,
        )
        self.db.add_all([schedule, room])
        self.db.commit()
        room_payload = [{
            "id": room.RoomCode,
            "name": room.Name,
            "status": room.Status,
            "dbId": room.Id,
        }]

        occupancy = _room_occupancy_at(
            self.db,
            "yangpu",
            room.RoomCode,
            start,
            room.Status,
            room_db_id=room.Id,
        )
        self.assertEqual(occupancy["occupancy"], "DISABLED")
        with patch("ops.get_consultation_rooms", return_value=room_payload):
            self.assertEqual(_available_rooms_for_schedule(self.db, schedule), [])


if __name__ == "__main__":
    unittest.main()
