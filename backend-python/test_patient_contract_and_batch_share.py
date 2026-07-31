import asyncio
import json
import unittest
from datetime import datetime
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from counselor import (
    ConsultationUpdate,
    LeaveRequestCreate,
    ScheduleUpdate,
    _calendar_items_for_schedules,
    submit_leave_request,
    update_consultation,
    update_schedule,
)
from database import Base
from leave_request_service import (
    approve_leave_request,
    build_leave_request_out,
    reject_leave_request,
)
from models import (
    AppAccount,
    AppConsultation,
    AppConsultationRoom,
    AppConsultationRoomSlot,
    AppCounselorPatientPricing,
    AppCounselorProfile,
    AppLeaveRequest,
    AppMessage,
    AppOrder,
    AppRoleBinding,
    AppSchedule,
    AppScheduleCancelLog,
    AppSystemSetting,
)
from patient_contract_service import (
    assert_patient_can_self_book,
    backfill_patient_contract_signed_from_orders,
    bind_patient_counselor,
    maybe_mark_patient_contract_signed,
    patient_contract_extras,
)
from order_contract_agreement import (
    assert_order_contract_agreement_ready,
    attach_contract_agreement_to_order,
    needs_contract_agreement_for_order,
)
from pricing_service import (
    counselor_pricing_summary,
    list_counselor_pricing_summaries,
    pricing_breakdown,
    preview_batch_counselor_default_share_percent,
    update_counselor_base_pricing_cents,
    update_batch_counselor_default_share_percent,
)
from proxy_booking_service import (
    build_proxy_slot_options,
    push_proxy_order,
    search_counselor_proxy_patients,
    search_proxy_counselors,
    search_proxy_patients,
    validate_counselor_proxy_patient,
)
from proxy_booking_notify import notify_proxy_order_created
from counselor_message_service import notify_counselor_proxy_order_pending
from payment_service import (
    _assert_order_binding_current,
    _assert_proxy_order_binding_current,
    complete_paid_order,
)
from payment import payment_callback
from room_assignment import assign_room_for_payment


class BackendServiceTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppRoleBinding.__table__,
                AppOrder.__table__,
                AppSchedule.__table__,
                AppConsultation.__table__,
                AppConsultationRoom.__table__,
                AppConsultationRoomSlot.__table__,
                AppLeaveRequest.__table__,
                AppMessage.__table__,
                AppScheduleCancelLog.__table__,
                AppCounselorProfile.__table__,
                AppCounselorPatientPricing.__table__,
                AppSystemSetting.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_counselor(self, counselor_id: int, name: str):
        self.db.add(
            AppAccount(
                Id=counselor_id,
                Mobile=f"138{counselor_id:08d}"[-11:],
                RealName=name,
                IsActive=True,
            )
        )
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


class PatientContractTests(BackendServiceTestCase):
    def setUp(self):
        super().setUp()
        self.patient = AppAccount(
            Id=1,
            Mobile="13800000001",
            RealName="来访甲",
            IsContractSigned=False,
            IsActive=True,
        )
        self.db.add(self.patient)
        self.add_counselor(10, "咨询师甲")
        self.add_counselor(20, "咨询师乙")
        self.db.add_all(
            [
                AppSchedule(
                    Id=101,
                    CounselorId=10,
                    StartTime=datetime(2026, 1, 1, 9, 0),
                    EndTime=datetime(2026, 1, 1, 10, 0),
                    Status="BOOKED",
                ),
                AppSchedule(
                    Id=102,
                    CounselorId=20,
                    StartTime=datetime(2026, 1, 2, 9, 0),
                    EndTime=datetime(2026, 1, 2, 10, 0),
                    Status="BOOKED",
                ),
            ]
        )
        self.db.flush()

    def add_order(
        self,
        order_id: int,
        schedule_id: int,
        status: str,
        *,
        paid_at: datetime | None = None,
        description: str | None = None,
    ):
        self.db.add(
            AppOrder(
                Id=order_id,
                AccountId=self.patient.Id,
                SlotId=schedule_id,
                OutTradeNo=f"TEST-{order_id}",
                TotalFee=60_000,
                Status=status,
                PaidAt=paid_at,
                Description=description,
            )
        )
        self.db.flush()

    def test_binding_change_resets_signed_even_with_historical_paid_order(self):
        self.add_order(1, 101, "REFUNDED", paid_at=datetime(2025, 12, 30, 12, 0))
        self.add_order(2, 102, "PAID", paid_at=datetime(2025, 12, 31, 12, 0))

        bind_patient_counselor(self.db, self.patient.Id, 10)
        self.assertEqual(self.patient.BoundCounselorId, 10)
        self.assertFalse(self.patient.IsContractSigned)
        first_changed_at = self.patient.BoundCounselorChangedAt
        self.assertIsNotNone(first_changed_at)

        bind_patient_counselor(self.db, self.patient.Id, 10)
        self.assertFalse(self.patient.IsContractSigned)
        self.assertEqual(self.patient.BoundCounselorChangedAt, first_changed_at)

        # A real payment under the current binding signs the visitor.
        self.add_order(3, 101, "PENDING")
        pending_order = self.db.query(AppOrder).filter(AppOrder.Id == 3).one()
        maybe_mark_patient_contract_signed(
            self.db,
            pending_order,
            paid_at=datetime.utcnow(),
        )
        self.assertTrue(self.patient.IsContractSigned)

        # Saving the same counselor is a no-op and preserves both state and time.
        self.db.flush()
        bind_patient_counselor(self.db, self.patient.Id, 10)
        self.assertTrue(self.patient.IsContractSigned)
        self.assertEqual(self.patient.BoundCounselorChangedAt, first_changed_at)

        # Historical payment to counselor B cannot carry the signed state across.
        bind_patient_counselor(self.db, self.patient.Id, 20)
        self.assertEqual(self.patient.BoundCounselorId, 20)
        self.assertFalse(self.patient.IsContractSigned)
        self.assertEqual(backfill_patient_contract_signed_from_orders(self.db), 0)
        self.assertFalse(self.patient.IsContractSigned)
        self.assertIsNone(patient_contract_extras(self.db, self.patient)["contractTag"])
        pricing_row = pricing_breakdown(self.db, self.patient.Id, 20)
        self.assertFalse(pricing_row["isContractSigned"])
        self.assertEqual(pricing_row["boundCounselorName"], "咨询师乙")
        self.assertIsNone(pricing_row["contractTag"])

        bind_patient_counselor(self.db, self.patient.Id, None)
        self.assertIsNone(self.patient.BoundCounselorId)
        self.assertFalse(self.patient.IsContractSigned)

    def test_binding_rejects_inactive_counselor_account(self):
        counselor = self.db.query(AppAccount).filter(AppAccount.Id == 10).one()
        counselor.IsActive = False
        self.db.flush()

        with self.assertRaisesRegex(ValueError, "不存在或已停用"):
            bind_patient_counselor(self.db, self.patient.Id, 10)

        self.assertIsNone(self.patient.BoundCounselorId)

    def test_rebinding_same_counselor_preserves_signed_state(self):
        self.patient.BoundCounselorId = 10
        self.patient.IsContractSigned = True
        self.patient.BoundCounselorChangedAt = datetime(2026, 1, 1, 8, 0)
        self.db.flush()

        bind_patient_counselor(self.db, self.patient.Id, 10)

        self.assertTrue(self.patient.IsContractSigned)
        self.assertEqual(
            self.patient.BoundCounselorChangedAt,
            datetime(2026, 1, 1, 8, 0),
        )

    def test_binding_change_cancels_mismatched_pending_proxy_orders(self):
        schedule_10 = self.db.query(AppSchedule).filter(AppSchedule.Id == 101).one()
        schedule_20 = self.db.query(AppSchedule).filter(AppSchedule.Id == 102).one()
        schedule_10.Status = "AVAILABLE"
        schedule_10.Note = "center:yangpu;room:A"
        schedule_20.Status = "AVAILABLE"
        schedule_20.Note = "center:yangpu;room:B"
        self.add_order(
            10,
            101,
            "PENDING",
            description="proxy:99|center:yangpu|schedule:existing",
        )
        self.add_order(
            11,
            102,
            "PENDING",
            description="proxy:99|center:yangpu|schedule:new",
        )

        bind_patient_counselor(self.db, self.patient.Id, 10)

        matching = self.db.query(AppOrder).filter(AppOrder.Id == 10).one()
        mismatched = self.db.query(AppOrder).filter(AppOrder.Id == 11).one()
        self.assertEqual(matching.Status, "PENDING")
        self.assertEqual(mismatched.Status, "CANCELLED")
        self.assertEqual(schedule_10.Status, "AVAILABLE")
        self.assertEqual(schedule_20.Status, "CANCELLED")

    def test_payment_transition_keeps_marking_current_binding_signed(self):
        self.patient.BoundCounselorId = 10
        self.patient.BoundCounselorChangedAt = datetime(2026, 1, 1, 8, 0)
        self.patient.IsContractSigned = False
        self.add_order(4, 101, "PENDING")
        pending_order = self.db.query(AppOrder).filter(AppOrder.Id == 4).one()

        maybe_mark_patient_contract_signed(
            self.db,
            pending_order,
            paid_at=datetime(2026, 1, 1, 8, 1),
        )

        self.assertTrue(self.patient.IsContractSigned)

    def test_payment_before_current_binding_does_not_mark_signed(self):
        self.patient.BoundCounselorId = 10
        self.patient.BoundCounselorChangedAt = datetime(2026, 1, 1, 8, 0)
        self.patient.IsContractSigned = False
        self.add_order(16, 101, "PENDING")
        pending_order = self.db.query(AppOrder).filter(AppOrder.Id == 16).one()

        maybe_mark_patient_contract_signed(
            self.db,
            pending_order,
            paid_at=datetime(2026, 1, 1, 7, 59),
        )

        self.assertFalse(self.patient.IsContractSigned)

    def test_self_booking_and_counselor_proxy_require_current_signed_binding(self):
        bind_patient_counselor(self.db, self.patient.Id, 10)

        with self.assertRaisesRegex(ValueError, "尚未完成签约绑定"):
            assert_patient_can_self_book(self.db, self.patient.Id, 10)
        with self.assertRaisesRegex(ValueError, "签约且绑定"):
            validate_counselor_proxy_patient(self.db, self.patient, 10)

        self.add_order(7, 101, "PENDING")
        order = self.db.query(AppOrder).filter(AppOrder.Id == 7).one()
        maybe_mark_patient_contract_signed(
            self.db,
            order,
            paid_at=datetime.utcnow(),
        )
        assert_patient_can_self_book(self.db, self.patient.Id, 10)
        validate_counselor_proxy_patient(self.db, self.patient, 10)

        with self.assertRaisesRegex(ValueError, "签约且绑定"):
            validate_counselor_proxy_patient(self.db, self.patient, 20)

    def test_unsigned_order_requires_agreement_before_payment(self):
        bind_patient_counselor(self.db, self.patient.Id, 10)
        self.add_order(8, 101, "PENDING")
        order = self.db.query(AppOrder).filter(AppOrder.Id == 8).one()

        self.assertTrue(needs_contract_agreement_for_order(self.db, self.patient, order))
        with self.assertRaisesRegex(ValueError, "先签署心理咨询协议"):
            assert_order_contract_agreement_ready(self.db, self.patient, order)

        attach_contract_agreement_to_order(
            self.db,
            self.patient,
            order,
            is_adult=True,
            signature_url="https://example.invalid/signature.png",
            emergency_contact="紧急联系人甲",
            emergency_relation="家属",
            emergency_phone="13800000002",
        )
        assert_order_contract_agreement_ready(self.db, self.patient, order)
        self.assertTrue(order.IntakeIsAdult)
        self.assertEqual(order.IntakeSignatureUrl, "https://example.invalid/signature.png")

    def test_proxy_order_agreement_type_cannot_be_changed_by_patient(self):
        bind_patient_counselor(self.db, self.patient.Id, 10)
        self.add_order(9, 101, "PENDING")
        order = self.db.query(AppOrder).filter(AppOrder.Id == 9).one()
        order.ProxyAgreementIsAdult = False

        with self.assertRaisesRegex(ValueError, "协议类型与助理推送的订单不一致"):
            attach_contract_agreement_to_order(
                self.db,
                self.patient,
                order,
                is_adult=True,
                signature_url="https://example.invalid/signature.png",
            )

        attach_contract_agreement_to_order(
            self.db,
            self.patient,
            order,
            is_adult=False,
            signature_url="https://example.invalid/signature.png",
            emergency_contact="紧急联系人甲",
            emergency_relation="家属",
            emergency_phone="13800000002",
        )
        self.assertFalse(order.IntakeIsAdult)

    def test_proxy_payment_revalidates_current_bound_counselor(self):
        self.patient.BoundCounselorId = 10
        self.add_order(
            12,
            102,
            "PENDING",
            description="proxy:99|center:yangpu|schedule:existing",
        )
        order = self.db.query(AppOrder).filter(AppOrder.Id == 12).one()

        with self.assertRaisesRegex(ValueError, "绑定咨询师已变更"):
            _assert_proxy_order_binding_current(self.db, self.patient, order)

    def test_regular_pending_order_also_revalidates_current_bound_counselor(self):
        self.patient.BoundCounselorId = 10
        self.add_order(13, 102, "PENDING")
        order = self.db.query(AppOrder).filter(AppOrder.Id == 13).one()

        with self.assertRaisesRegex(ValueError, "绑定咨询师已变更"):
            _assert_order_binding_current(self.db, self.patient, order)

    def test_payment_rejects_slot_already_booked_before_mutating_order(self):
        self.patient.BoundCounselorId = 10
        self.patient.IsContractSigned = True
        self.add_order(14, 101, "PENDING")
        order = self.db.query(AppOrder).filter(AppOrder.Id == 14).one()

        with self.assertRaisesRegex(ValueError, "预约时段已被占用"):
            complete_paid_order(self.db, order, center_id="video")

        self.assertEqual(order.Status, "PENDING")

    def test_payment_rejects_center_tampering_before_mutating_order(self):
        self.patient.BoundCounselorId = 10
        self.patient.IsContractSigned = True
        schedule = self.db.query(AppSchedule).filter(AppSchedule.Id == 101).one()
        schedule.Status = "AVAILABLE"
        schedule.Note = "center:video"
        self.add_order(15, 101, "PENDING")
        order = self.db.query(AppOrder).filter(AppOrder.Id == 15).one()

        with self.assertRaisesRegex(ValueError, "预约中心与排期不一致"):
            complete_paid_order(self.db, order, center_id="yangpu")

        self.assertEqual(order.Status, "PENDING")

    def test_proxy_push_rejects_counselor_deactivated_after_binding(self):
        self.patient.BoundCounselorId = 10
        counselor = self.db.query(AppAccount).filter(AppAccount.Id == 10).one()
        counselor.IsActive = False
        self.db.flush()

        with self.assertRaisesRegex(ValueError, "咨询师不存在或已停用"):
            push_proxy_order(
                self.db,
                staff_account_id=99,
                patient_id=self.patient.Id,
                counselor_id=10,
                center_id="video",
                start_time=datetime(2026, 12, 1, 9, 0),
                end_time=datetime(2026, 12, 1, 9, 50),
                agreement_is_adult=True,
            )

    def test_proxy_push_revalidates_selected_room_operational_status(self):
        self.patient.BoundCounselorId = 10
        self.patient.IsContractSigned = True
        room = AppConsultationRoom(
            CenterId="yangpu",
            RoomCode="yangpu-disabled",
            Name="停用咨询室",
            Status="DISABLED",
            SortOrder=1,
        )
        self.db.add(room)
        self.db.flush()
        room_payload = {
            "id": room.RoomCode,
            "name": room.Name,
            "status": room.Status,
            "dbId": room.Id,
        }

        with (
            patch("proxy_booking_service.get_consultation_rooms", return_value=[room_payload]),
            patch("proxy_booking_service.validate_slot_in_rolling_window"),
            self.assertRaisesRegex(ValueError, "咨询室在该时段不可用"),
        ):
            push_proxy_order(
                self.db,
                staff_account_id=99,
                patient_id=self.patient.Id,
                counselor_id=10,
                center_id="yangpu",
                start_time=datetime(2099, 12, 1, 9, 0),
                end_time=datetime(2099, 12, 1, 9, 50),
                room_id=room.RoomCode,
            )

        self.assertEqual(
            self.db.query(AppOrder).filter(AppOrder.Description.like("proxy:%")).count(),
            0,
        )

        room.Status = "AVAILABLE"
        room_payload["status"] = room.Status
        self.db.add(
            AppConsultationRoomSlot(
                RoomId=room.Id,
                StartTime=datetime(2099, 12, 1, 9, 0),
                Status="DISABLED",
            )
        )
        self.db.flush()
        with (
            patch("proxy_booking_service.get_consultation_rooms", return_value=[room_payload]),
            patch("proxy_booking_service.validate_slot_in_rolling_window"),
            self.assertRaisesRegex(ValueError, "咨询室在该时段不可用"),
        ):
            push_proxy_order(
                self.db,
                staff_account_id=99,
                patient_id=self.patient.Id,
                counselor_id=10,
                center_id="yangpu",
                start_time=datetime(2099, 12, 1, 9, 0),
                end_time=datetime(2099, 12, 1, 9, 50),
                room_id=room.RoomCode,
            )

    def test_proxy_push_returns_precise_yuan_value_for_cent_price(self):
        self.patient.BoundCounselorId = 10
        self.patient.IsContractSigned = True

        with (
            patch("proxy_booking_service.validate_slot_in_rolling_window"),
            patch("proxy_booking_service.resolve_display_price_cents", return_value=60_001),
            patch("proxy_booking_notify.notify_proxy_order_created"),
            patch("system_setting_service.get_proxy_order_ttl_minutes", return_value=30),
        ):
            result = push_proxy_order(
                self.db,
                staff_account_id=99,
                patient_id=self.patient.Id,
                counselor_id=10,
                center_id="video",
                start_time=datetime(2099, 12, 1, 9, 0),
                end_time=datetime(2099, 12, 1, 9, 50),
            )

        self.assertEqual(result["totalFee"], 60_001)
        self.assertEqual(result["totalFeeYuan"], 600.01)

    def test_staff_proxy_push_notifies_target_counselor(self):
        schedule = self.db.query(AppSchedule).filter(AppSchedule.Id == 101).one()
        self.add_order(16, schedule.Id, "PENDING")
        order = self.db.query(AppOrder).filter(AppOrder.Id == 16).one()

        with (
            patch("patient_message_service.notify_patient_proxy_order_pending") as patient_notify,
            patch("staff_message_service.notify_staff_proxy_order_pushed") as staff_notify,
            patch("counselor_message_service.notify_counselor_proxy_order_pending") as counselor_notify,
        ):
            notify_proxy_order_created(
                self.db,
                order=order,
                schedule=schedule,
                patient=self.patient,
                counselor_id=10,
                staff_account_id=99,
            )

        patient_notify.assert_called_once()
        staff_notify.assert_called_once()
        counselor_notify.assert_called_once_with(
            self.db,
            counselor_id=10,
            schedule=schedule,
            patient_id=self.patient.Id,
            order=order,
        )

    def test_counselor_self_proxy_keeps_existing_notifications_without_duplicate_target_message(self):
        schedule = self.db.query(AppSchedule).filter(AppSchedule.Id == 101).one()
        self.add_order(17, schedule.Id, "PENDING")
        order = self.db.query(AppOrder).filter(AppOrder.Id == 17).one()

        with (
            patch("patient_message_service.notify_patient_proxy_order_pending") as patient_notify,
            patch("staff_message_service.notify_staff_proxy_order_pushed") as staff_notify,
            patch("counselor_message_service.notify_counselor_proxy_order_pending") as counselor_notify,
        ):
            notify_proxy_order_created(
                self.db,
                order=order,
                schedule=schedule,
                patient=self.patient,
                counselor_id=10,
                staff_account_id=10,
                notify_target_counselor=False,
            )

        patient_notify.assert_called_once()
        staff_notify.assert_called_once()
        counselor_notify.assert_not_called()

    def test_counselor_proxy_pending_message_is_idempotent(self):
        self.patient.BoundCounselorId = 10
        self.patient.IsContractSigned = True
        schedule = self.db.query(AppSchedule).filter(AppSchedule.Id == 101).one()
        schedule.Note = "center:video"
        self.add_order(18, schedule.Id, "PENDING")
        order = self.db.query(AppOrder).filter(AppOrder.Id == 18).one()

        notify_counselor_proxy_order_pending(
            self.db,
            counselor_id=10,
            schedule=schedule,
            patient_id=self.patient.Id,
            order=order,
        )
        notify_counselor_proxy_order_pending(
            self.db,
            counselor_id=10,
            schedule=schedule,
            patient_id=self.patient.Id,
            order=order,
        )

        pending_messages = [
            row
            for row in self.db.new
            if isinstance(row, AppMessage)
            and row.RelatedType == "COUNSELOR_PROXY_ORDER_PENDING"
            and row.RelatedId == order.Id
        ]
        self.assertEqual(len(pending_messages), 1)
        self.assertEqual(pending_messages[0].AccountId, 10)
        self.assertEqual(pending_messages[0].Title, "代理预约待支付")

        pending_messages[0].Id = 9001
        self.db.flush()
        notify_counselor_proxy_order_pending(
            self.db,
            counselor_id=10,
            schedule=schedule,
            patient_id=self.patient.Id,
            order=order,
        )
        persisted = (
            self.db.query(AppMessage)
            .filter(
                AppMessage.AccountId == 10,
                AppMessage.RelatedType == "COUNSELOR_PROXY_ORDER_PENDING",
                AppMessage.RelatedId == order.Id,
            )
            .all()
        )
        self.assertEqual(len(persisted), 1)

    def test_backfill_only_promotes_payments_after_current_binding(self):
        matching = AppAccount(
            Id=2,
            Mobile="13800000002",
            RealName="来访乙",
            BoundCounselorId=10,
            BoundCounselorChangedAt=datetime(2026, 1, 1, 8, 0),
            IsContractSigned=False,
            IsActive=True,
        )
        non_matching = AppAccount(
            Id=3,
            Mobile="13800000003",
            RealName="来访丙",
            BoundCounselorId=20,
            BoundCounselorChangedAt=datetime(2026, 1, 1, 8, 0),
            IsContractSigned=False,
            IsActive=True,
        )
        already_signed = AppAccount(
            Id=4,
            Mobile="13800000004",
            RealName="来访丁",
            BoundCounselorId=20,
            BoundCounselorChangedAt=datetime(2026, 1, 1, 8, 0),
            IsContractSigned=True,
            IsActive=True,
        )
        self.db.add_all([matching, non_matching, already_signed])
        self.db.flush()
        self.db.add_all(
            [
                AppOrder(
                    Id=5,
                    AccountId=2,
                    SlotId=101,
                    OutTradeNo="TEST-5",
                    TotalFee=60_000,
                    Status="PAID",
                    PaidAt=datetime(2026, 1, 1, 9, 0),
                ),
                AppOrder(
                    Id=6,
                    AccountId=3,
                    SlotId=101,
                    OutTradeNo="TEST-6",
                    TotalFee=60_000,
                    Status="PAID",
                    PaidAt=datetime(2026, 1, 1, 9, 0),
                ),
            ]
        )
        self.db.flush()

        updated = backfill_patient_contract_signed_from_orders(self.db)

        self.assertEqual(updated, 1)
        self.assertTrue(matching.IsContractSigned)
        self.assertFalse(non_matching.IsContractSigned)
        self.assertTrue(already_signed.IsContractSigned)


class CounselorSafetyTests(BackendServiceTestCase):
    def test_proxy_slot_options_support_half_hour_and_block_cleaning_overlap(self):
        slot_date = datetime(2026, 2, 2).date()
        self.db.add(
            AppSchedule(
                CounselorId=10,
                StartTime=datetime(2026, 2, 2, 10, 0),
                EndTime=datetime(2026, 2, 2, 10, 50),
                Status="AVAILABLE",
                Note="center:video",
            )
        )
        self.db.flush()

        with patch("proxy_booking_service._now", return_value=datetime(2026, 2, 1, 8, 0)):
            options = build_proxy_slot_options(self.db, 10, slot_date, "video")

        by_key = {item["key"]: item for item in options}
        self.assertIn("10:30", by_key)
        self.assertTrue(by_key["10:30"]["counselorOccupied"])
        self.assertFalse(by_key["10:30"]["selectable"])

    def test_leave_review_refund_text_matches_full_refund_workflow(self):
        self.add_counselor(10, "咨询师甲")
        patient = AppAccount(
            Id=1,
            Mobile="13800000001",
            RealName="来访甲",
            IsActive=True,
        )
        schedule = AppSchedule(
            Id=201,
            CounselorId=10,
            StartTime=datetime(2099, 2, 1, 9, 0),
            EndTime=datetime(2099, 2, 1, 9, 50),
            Status="BOOKED",
            Note="center:video",
        )
        order = AppOrder(
            Id=301,
            AccountId=1,
            SlotId=201,
            OutTradeNo="LEAVE-REFUND-301",
            TotalFee=60_000,
            Status="PAID",
        )
        consultation = AppConsultation(
            Id=401,
            OrderId=301,
            PatientId=1,
            CounselorId=10,
            ScheduleId=201,
            Status="CONFIRMED",
        )
        leave = AppLeaveRequest(
            Id=501,
            ScheduleId=201,
            CounselorId=10,
            Reason="临时请假",
            Status="PENDING",
        )
        self.db.add_all([patient, schedule, order, consultation, leave])
        self.db.flush()

        pending = build_leave_request_out(self.db, leave)
        self.assertEqual(
            pending["affectedPatients"][0]["refundText"],
            "审核通过后款项将原路全额退回",
        )

        order.Status = "REFUNDED"
        leave.Status = "APPROVED"
        self.db.flush()
        approved = build_leave_request_out(self.db, leave)
        self.assertEqual(
            approved["affectedPatients"][0]["refundText"],
            "款项已原路全额退回",
        )

    def test_counselor_proxy_search_only_returns_bound_signed_patients_before_limit(self):
        self.add_counselor(10, "咨询师甲")
        eligible = AppAccount(
            Id=1,
            Mobile="13800000001",
            RealName="签约来访",
            BoundCounselorId=10,
            IsContractSigned=True,
            IsActive=True,
        )
        unsigned = AppAccount(
            Id=101,
            Mobile="13800000101",
            RealName="未签约来访",
            BoundCounselorId=10,
            IsContractSigned=False,
            IsActive=True,
        )
        bound_elsewhere = AppAccount(
            Id=102,
            Mobile="13800000102",
            RealName="绑定其他咨询师",
            BoundCounselorId=20,
            IsContractSigned=True,
            IsActive=True,
        )
        self.db.add_all([eligible, unsigned, bound_elsewhere])
        self.db.add_all(
            [
                AppRoleBinding(AccountId=1, RoleType="Patient"),
                AppRoleBinding(AccountId=101, RoleType="Patient"),
                AppRoleBinding(AccountId=102, RoleType="Patient"),
            ]
        )
        self.db.flush()

        items = search_counselor_proxy_patients(self.db, 10, limit=1)

        self.assertEqual([item["id"] for item in items], [1])
        self.assertTrue(items[0]["canProxyPush"])
        self.assertEqual(items[0]["contractTag"], "已签约-【咨询师甲】")

    def test_pending_proxy_schedule_displays_order_patient_and_contract_tag(self):
        self.add_counselor(10, "咨询师甲")
        patient = AppAccount(
            Id=1,
            Mobile="13800000001",
            RealName="签约来访",
            BoundCounselorId=10,
            IsContractSigned=True,
            IsActive=True,
        )
        schedule = AppSchedule(
            Id=201,
            CounselorId=10,
            StartTime=datetime(2099, 2, 1, 9, 0),
            EndTime=datetime(2099, 2, 1, 9, 50),
            Status="AVAILABLE",
            Note="center:video",
        )
        pending_order = AppOrder(
            Id=301,
            AccountId=1,
            SlotId=201,
            OutTradeNo="PROXY-PENDING-301",
            TotalFee=60_000,
            Status="PENDING",
            Description="proxy:10|center:video|schedule:new",
            ExpiresAt=datetime(2099, 2, 1, 8, 0),
        )
        self.db.add_all([patient, schedule, pending_order])
        self.db.flush()

        items = _calendar_items_for_schedules(self.db, [schedule], 10)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].displayStatus, "PENDING_PAYMENT")
        self.assertEqual(items[0].patientName, "签约来访")
        self.assertEqual(items[0].patientContractTag, "已签约-【咨询师甲】")
        self.assertIsNone(items[0].consultationId)

    def test_proxy_patient_search_matches_visitor_management_scope(self):
        legacy_patient = AppAccount(
            Id=1,
            Mobile="13800000001",
            RealName="历史来访",
            IsActive=True,
        )
        staff_patient = AppAccount(
            Id=2,
            Mobile="13800000002",
            RealName="助理账号",
            IsActive=True,
        )
        self.db.add_all([legacy_patient, staff_patient])
        self.db.add_all(
            [
                AppRoleBinding(AccountId=2, RoleType="Patient"),
                AppRoleBinding(AccountId=2, RoleType="Assistant"),
                AppConsultation(
                    Id=101,
                    PatientId=1,
                    CounselorId=10,
                    Status="DONE",
                ),
            ]
        )
        self.db.flush()

        self.assertEqual(
            [item["id"] for item in search_proxy_patients(self.db)],
            [1],
        )

    def test_proxy_patient_search_returns_current_bound_counselor(self):
        self.add_counselor(10, "咨询师甲")
        patient = AppAccount(
            Id=1,
            Mobile="13800000001",
            RealName="来访甲",
            BoundCounselorId=10,
            IsContractSigned=False,
            IsActive=True,
        )
        self.db.add(patient)
        self.db.add(AppRoleBinding(AccountId=1, RoleType="Patient"))
        self.db.flush()

        items = search_proxy_patients(self.db, keyword="13800000001")

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], 1)
        self.assertEqual(items[0]["boundCounselorId"], 10)
        self.assertEqual(items[0]["boundCounselorName"], "咨询师甲")
        self.assertFalse(items[0]["isContractSigned"])

    def test_proxy_counselor_search_only_returns_active_accounts_and_profiles(self):
        self.add_counselor(10, "咨询师甲")
        self.add_counselor(20, "咨询师乙")
        self.add_counselor(30, "咨询师丙")
        self.db.flush()

        self.db.query(AppAccount).filter(AppAccount.Id == 20).one().IsActive = False
        self.db.query(AppCounselorProfile).filter(
            AppCounselorProfile.AccountId == 30,
        ).one().IsActive = False
        self.db.flush()

        self.assertEqual(
            [item["id"] for item in search_proxy_counselors(self.db)],
            [10],
        )

    def test_consultation_cannot_be_cancelled_directly(self):
        counselor = AppAccount(Id=10, Mobile="13800000010", IsActive=True)

        with self.assertRaises(HTTPException) as caught:
            update_consultation(
                1,
                ConsultationUpdate(status="CANCELLED"),
                counselor=counselor,
                db=self.db,
            )

        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("请假申请", caught.exception.detail)

    def test_booked_schedule_without_consultation_still_requires_leave_review(self):
        counselor = AppAccount(Id=10, Mobile="13800000010", IsActive=True)
        schedule = AppSchedule(
            Id=200,
            CounselorId=counselor.Id,
            StartTime=datetime(2027, 2, 1, 9, 0),
            EndTime=datetime(2027, 2, 1, 10, 0),
            Status="BOOKED",
        )
        self.db.add(schedule)
        self.db.flush()

        with self.assertRaises(HTTPException) as caught:
            update_schedule(
                schedule.Id,
                ScheduleUpdate(status="CANCELLED"),
                counselor=counselor,
                db=self.db,
            )

        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("请假申请", caught.exception.detail)
        self.assertEqual(schedule.Status, "BOOKED")

    def test_leave_submission_links_screenshot_to_created_request(self):
        counselor = AppAccount(Id=10, Mobile="13800000010", IsActive=True)
        schedule = AppSchedule(
            Id=205,
            CounselorId=counselor.Id,
            StartTime=datetime(2027, 2, 1, 9, 0),
            EndTime=datetime(2027, 2, 1, 10, 0),
            Status="BOOKED",
            Note="center:video",
        )
        self.db.add(schedule)
        self.db.flush()

        with (
            patch("staff_message_service.notify_staff_counselor_leave"),
            patch("counselor_message_service.notify_counselor_leave_submitted"),
        ):
            result = submit_leave_request(
                schedule.Id,
                LeaveRequestCreate(
                    reason="临时请假",
                    communication_screenshot_url="/static/leave.png",
                ),
                counselor=counselor,
                db=self.db,
            )

        leave_id = result["leaveRequestId"]
        log = self.db.query(AppScheduleCancelLog).one()
        self.assertEqual(log.LeaveRequestId, leave_id)
        self.assertEqual(log.ScreenshotUrl, "/static/leave.png")

    def test_rejected_leave_records_review_and_preserves_original_reason(self):
        schedule = AppSchedule(
            Id=201,
            CounselorId=10,
            StartTime=datetime(2026, 2, 1, 9, 0),
            EndTime=datetime(2026, 2, 1, 10, 0),
            Status="BOOKED",
        )
        leave = AppLeaveRequest(
            Id=301,
            ScheduleId=201,
            CounselorId=10,
            Reason="临时生病",
            Status="PENDING",
        )
        self.db.add_all([schedule, leave])
        self.db.flush()

        with patch("counselor_message_service.notify_counselor_leave_rejected") as notify:
            reject_leave_request(self.db, leave, admin_id=88, reject_reason="材料不完整")

        self.assertEqual(leave.Status, "REJECTED")
        self.assertEqual(leave.RejectReason, "材料不完整")
        self.assertEqual(leave.ReviewedBy, 88)
        self.assertIsNotNone(leave.ReviewedAt)
        notify.assert_called_once()
        kwargs = notify.call_args.kwargs
        self.assertEqual(kwargs["leave_reason"], "临时生病")
        self.assertEqual(kwargs["reject_reason"], "材料不完整")

    def test_leave_review_uses_screenshot_linked_to_exact_request(self):
        schedule = AppSchedule(
            Id=211,
            CounselorId=10,
            StartTime=datetime(2026, 2, 2, 9, 0),
            EndTime=datetime(2026, 2, 2, 10, 0),
            Status="BOOKED",
            Note="center:video",
        )
        first = AppLeaveRequest(
            Id=311,
            ScheduleId=211,
            CounselorId=10,
            Reason="第一次请假",
            Status="REJECTED",
            CreatedAt=datetime(2026, 1, 1, 9, 0),
        )
        second = AppLeaveRequest(
            Id=312,
            ScheduleId=211,
            CounselorId=10,
            Reason="第二次请假",
            Status="PENDING",
            CreatedAt=datetime(2026, 1, 2, 9, 0),
        )
        self.db.add_all([schedule, first, second])
        self.db.flush()
        self.db.add_all(
            [
                AppScheduleCancelLog(
                    ScheduleId=211,
                    CounselorId=10,
                    LeaveRequestId=311,
                    ScreenshotUrl="/static/first.png",
                ),
                AppScheduleCancelLog(
                    ScheduleId=211,
                    CounselorId=10,
                    LeaveRequestId=312,
                    ScreenshotUrl="/static/second.png",
                ),
            ]
        )
        self.db.flush()

        self.assertEqual(
            build_leave_request_out(self.db, first)["screenshotUrl"],
            "/static/first.png",
        )
        self.assertEqual(
            build_leave_request_out(self.db, second)["screenshotUrl"],
            "/static/second.png",
        )

    def test_leave_approval_rejects_schedule_owned_by_other_counselor(self):
        schedule = AppSchedule(
            Id=212,
            CounselorId=10,
            StartTime=datetime(2026, 2, 3, 9, 0),
            EndTime=datetime(2026, 2, 3, 10, 0),
            Status="BOOKED",
        )
        leave = AppLeaveRequest(
            Id=313,
            ScheduleId=212,
            CounselorId=20,
            Reason="请假",
            Status="PENDING",
        )
        self.db.add_all([schedule, leave])
        self.db.flush()

        with self.assertRaisesRegex(ValueError, "不属于该咨询师"):
            approve_leave_request(self.db, leave, admin_id=88)

        self.assertEqual(leave.Status, "PENDING")

    def test_proxy_slot_options_respect_global_and_per_slot_room_status(self):
        room = AppConsultationRoom(
            CenterId="yangpu",
            RoomCode="yangpu-status-test",
            Name="状态测试咨询室",
            Status="DISABLED",
            SortOrder=1,
        )
        self.db.add(room)
        self.db.flush()
        slot_start = datetime(2026, 2, 2, 9, 0)

        def room_payload():
            return [{
                "id": room.RoomCode,
                "name": room.Name,
                "status": room.Status,
                "dbId": room.Id,
            }]

        with (
            patch("proxy_booking_service._now", return_value=datetime(2026, 2, 1, 8, 0)),
            patch(
                "proxy_booking_service.get_consultation_rooms",
                side_effect=lambda *_args, **_kwargs: room_payload(),
            ),
        ):
            globally_disabled = build_proxy_slot_options(
                self.db, 10, slot_start.date(), "yangpu",
            )[0]
        self.assertFalse(globally_disabled["rooms"][0]["available"])
        self.assertTrue(globally_disabled["allRoomsFull"])
        self.assertFalse(globally_disabled["selectable"])

        # 单时段配置覆盖咨询室默认状态：全局停用但明确开放该时段时可选。
        override = AppConsultationRoomSlot(
            RoomId=room.Id,
            StartTime=slot_start,
            Status="AVAILABLE",
        )
        self.db.add_all([
            override,
            AppConsultationRoomSlot(
                RoomId=room.Id,
                StartTime=datetime(2026, 2, 2, 9, 30),
                Status="AVAILABLE",
            ),
        ])
        self.db.flush()
        with (
            patch("proxy_booking_service._now", return_value=datetime(2026, 2, 1, 8, 0)),
            patch(
                "proxy_booking_service.get_consultation_rooms",
                side_effect=lambda *_args, **_kwargs: room_payload(),
            ),
        ):
            explicitly_available = build_proxy_slot_options(
                self.db, 10, slot_start.date(), "yangpu",
            )[0]
        self.assertTrue(explicitly_available["rooms"][0]["available"])
        self.assertFalse(explicitly_available["allRoomsFull"])
        self.assertTrue(explicitly_available["selectable"])

        # 全局开放但单时段停用时仍必须不可选。
        room.Status = "AVAILABLE"
        override.Status = "DISABLED"
        self.db.flush()
        with (
            patch("proxy_booking_service._now", return_value=datetime(2026, 2, 1, 8, 0)),
            patch(
                "proxy_booking_service.get_consultation_rooms",
                side_effect=lambda *_args, **_kwargs: room_payload(),
            ),
        ):
            slot_disabled = build_proxy_slot_options(
                self.db, 10, slot_start.date(), "yangpu",
            )[0]
        self.assertFalse(slot_disabled["rooms"][0]["available"])
        self.assertTrue(slot_disabled["allRoomsFull"])
        self.assertFalse(slot_disabled["selectable"])

    def test_existing_schedule_is_not_selectable_when_no_room_is_operational(self):
        room = AppConsultationRoom(
            CenterId="yangpu",
            RoomCode="yangpu-slot-disabled",
            Name="时段停用咨询室",
            Status="AVAILABLE",
            SortOrder=1,
        )
        self.db.add(room)
        self.db.flush()
        slot_start = datetime(2026, 2, 2, 9, 0)
        self.db.add_all(
            [
                AppConsultationRoomSlot(
                    RoomId=room.Id,
                    StartTime=slot_start,
                    Status="DISABLED",
                ),
                AppSchedule(
                    CounselorId=10,
                    StartTime=slot_start,
                    EndTime=datetime(2026, 2, 2, 9, 50),
                    Status="AVAILABLE",
                    Note="center:yangpu",
                ),
            ]
        )
        self.db.flush()

        with (
            patch("proxy_booking_service._now", return_value=datetime(2026, 2, 1, 8, 0)),
            patch(
                "proxy_booking_service.get_consultation_rooms",
                return_value=[{
                    "id": room.RoomCode,
                    "name": room.Name,
                    "status": room.Status,
                    "dbId": room.Id,
                }],
            ),
        ):
            slot = build_proxy_slot_options(
                self.db, 10, slot_start.date(), "yangpu",
            )[0]

        self.assertIsNotNone(slot["existingAvailableScheduleId"])
        self.assertFalse(slot["rooms"][0]["available"])
        self.assertTrue(slot["allRoomsFull"])
        self.assertFalse(slot["selectable"])

    def test_payment_room_assignment_respects_global_and_per_slot_status(self):
        room = AppConsultationRoom(
            CenterId="yangpu",
            RoomCode="yangpu-payment-test",
            Name="付款状态测试咨询室",
            Status="DISABLED",
            SortOrder=1,
        )
        self.db.add(room)
        self.db.flush()
        schedule = AppSchedule(
            Id=220,
            CounselorId=10,
            StartTime=datetime(2026, 2, 2, 9, 0),
            EndTime=datetime(2026, 2, 2, 9, 50),
            Status="AVAILABLE",
        )
        room_payload = [{
            "id": room.RoomCode,
            "name": room.Name,
            "status": room.Status,
            "dbId": room.Id,
        }]

        with (
            patch("room_assignment.get_consultation_rooms", return_value=room_payload),
            self.assertRaisesRegex(ValueError, "暂无可用咨询室"),
        ):
            assign_room_for_payment(self.db, schedule, "yangpu")

        room.Status = "AVAILABLE"
        self.db.add(
            AppConsultationRoomSlot(
                RoomId=room.Id,
                StartTime=schedule.StartTime,
                Status="DISABLED",
            )
        )
        self.db.flush()
        room_payload[0]["status"] = room.Status
        with (
            patch("room_assignment.get_consultation_rooms", return_value=room_payload),
            self.assertRaisesRegex(ValueError, "暂无可用咨询室"),
        ):
            assign_room_for_payment(self.db, schedule, "yangpu")

    @patch("room_assignment.paid_occupied_rooms_at_center", return_value={"A"})
    @patch("room_assignment.is_booking_window_operational", return_value=True)
    @patch(
        "room_assignment.get_consultation_rooms",
        return_value=[{"id": "A", "dbId": 1}, {"id": "B", "dbId": 2}],
    )
    def test_proxy_payment_never_falls_back_from_required_room(
        self,
        _rooms,
        _operational,
        _occupied,
    ):
        schedule = AppSchedule(
            Id=202,
            CounselorId=10,
            StartTime=datetime(2026, 2, 2, 9, 0),
            EndTime=datetime(2026, 2, 2, 10, 0),
            Status="AVAILABLE",
        )

        with self.assertRaisesRegex(ValueError, "指定的咨询室已被占用"):
            assign_room_for_payment(
                self.db,
                schedule,
                "yangpu",
                required_room_id="A",
            )
        self.assertEqual(
            assign_room_for_payment(
                self.db,
                schedule,
                "yangpu",
                required_room_id="B",
            ),
            "B",
        )

        reserved_schedule = AppSchedule(
            Id=203,
            CounselorId=20,
            StartTime=schedule.StartTime,
            EndTime=schedule.EndTime,
            Status="AVAILABLE",
            Note="center:yangpu;room:B",
        )
        reserved_order = AppOrder(
            Id=204,
            AccountId=2,
            SlotId=203,
            OutTradeNo="PROXY-RESERVED",
            TotalFee=60_000,
            Status="PENDING",
            Description="proxy:99|center:yangpu|schedule:new",
            ExpiresAt=datetime(2027, 1, 1),
        )
        self.db.add_all([reserved_schedule, reserved_order])
        self.db.flush()

        with self.assertRaisesRegex(ValueError, "指定的咨询室已被占用"):
            assign_room_for_payment(
                self.db,
                schedule,
                "yangpu",
                required_room_id="B",
            )

    def test_wechat_callback_returns_fail_when_business_validation_fails(self):
        class FakeHeaders(dict):
            def get(self, key, default=""):
                return dict.get(self, key, default)

        class FakeRequest:
            headers = FakeHeaders()

            async def body(self):
                # 模拟模式：明文 JSON 回调
                return json.dumps(
                    {
                        "trade_state": "SUCCESS",
                        "out_trade_no": "PROXY-FAIL",
                        "transaction_id": "TX-FAIL",
                        "amount": {"total": 60000},
                    }
                ).encode("utf-8")

        class FakeQuery:
            def filter(self, *_args):
                return self

            def first(self):
                return AppOrder(
                    Id=999,
                    AccountId=1,
                    OutTradeNo="PROXY-FAIL",
                    TotalFee=60_000,
                    Status="PENDING",
                    Description="proxy:99|center:yangpu|schedule:existing",
                )

        class FakeDb:
            rolled_back = False
            committed = False

            def query(self, *_args):
                return FakeQuery()

            def rollback(self):
                self.rolled_back = True

            def commit(self):
                self.committed = True

        fake_db = FakeDb()
        with patch("payment.complete_paid_order", side_effect=ValueError("指定咨询室已被占用")):
            response = asyncio.run(payment_callback(FakeRequest(), db=fake_db))

        # 业务校验失败仍应答 204，避免微信无限重推；订单保持 PENDING 供查单/人工处理
        self.assertEqual(response.status_code, 204)
        self.assertTrue(fake_db.rolled_back)
        self.assertFalse(fake_db.committed)

    def test_real_wechat_callback_rejects_invalid_signature(self):
        class FakeHeaders(dict):
            def get(self, key, default=""):
                return dict.get(self, key, default)

        class FakeRequest:
            headers = FakeHeaders(
                {
                    "Wechatpay-Timestamp": "1710000000",
                    "Wechatpay-Nonce": "nonce",
                    "Wechatpay-Signature": "invalid",
                    "Wechatpay-Serial": "PUB_KEY_ID_test",
                }
            )

            async def body(self):
                return b'{"id":"evt"}'

        class FakeClient:
            def verify_notification_signature(self, **_kwargs):
                return False

        with (
            patch("payment.is_real_wechat_pay_configured", return_value=True),
            patch("payment.get_wechat_pay_client", return_value=FakeClient()),
        ):
            response = asyncio.run(payment_callback(FakeRequest(), db=object()))
            self.assertEqual(response.status_code, 401)
            payload = json.loads(response.body.decode("utf-8"))
            self.assertEqual(payload["code"], "FAIL")
            self.assertIn("签名", payload["message"])

    def test_wechat_signtest_probe_is_rejected(self):
        from wechat_pay_v3 import WeChatPayV3Client

        client = WeChatPayV3Client.__new__(WeChatPayV3Client)
        ok = WeChatPayV3Client.verify_notification_signature(
            client,
            timestamp="1",
            nonce="n",
            body="{}",
            signature="WECHATPAY/SIGNTEST/abc",
            serial="PUB_KEY_ID_x",
        )
        self.assertFalse(ok)


class BatchDefaultShareTests(BackendServiceTestCase):
    def setUp(self):
        super().setUp()
        self.add_counselor(10, "咨询师甲")
        self.add_counselor(20, "咨询师乙")
        self.db.flush()
        self.db.add_all(
            [
                AppCounselorPatientPricing(
                    CounselorAccountId=10,
                    PatientAccountId=101,
                    AdjustmentCents=1_000,
                    ShareMode="AMOUNT",
                    RevenueShareCents=20_000,
                ),
                AppCounselorPatientPricing(
                    CounselorAccountId=10,
                    PatientAccountId=102,
                    AdjustmentCents=2_000,
                ),
                AppCounselorPatientPricing(
                    CounselorAccountId=20,
                    PatientAccountId=101,
                    AdjustmentCents=0,
                    ShareMode="PERCENT",
                    RevenueSharePercent=30,
                ),
            ]
        )
        self.db.flush()

    def test_single_counselor_base_update_persists_percent_mode(self):
        profile = (
            self.db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == 10)
            .one()
        )
        profile.DefaultShareMode = "AMOUNT"
        profile.DefaultRevenueShareCents = 30_000
        profile.DefaultRevenueSharePercent = None
        self.db.flush()

        update_counselor_base_pricing_cents(
            self.db,
            10,
            base_price_cents=68_000,
            default_share_percent=60,
        )

        self.assertEqual(profile.Billing, 68_000)
        self.assertEqual(profile.FaceBilling, 40_800)
        self.assertEqual(profile.DefaultShareMode, "PERCENT")
        self.assertIsNone(profile.DefaultRevenueShareCents)
        self.assertEqual(profile.DefaultRevenueSharePercent, 60)
        summary = counselor_pricing_summary(self.db, 10)
        self.assertEqual(summary["defaultShareMode"], "PERCENT")
        self.assertEqual(summary["defaultRevenueSharePercent"], 60)
        self.assertEqual(summary["defaultRevenueShareCents"], 40_800)

    def test_invalid_single_counselor_percent_does_not_mutate_pricing(self):
        profile = (
            self.db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == 10)
            .one()
        )
        before = (
            profile.Billing,
            profile.FaceBilling,
            profile.DefaultShareMode,
            profile.DefaultRevenueShareCents,
            profile.DefaultRevenueSharePercent,
        )

        with self.assertRaisesRegex(ValueError, "0–100"):
            update_counselor_base_pricing_cents(
                self.db,
                10,
                base_price_cents=68_000,
                default_share_percent=101,
            )

        after = (
            profile.Billing,
            profile.FaceBilling,
            profile.DefaultShareMode,
            profile.DefaultRevenueShareCents,
            profile.DefaultRevenueSharePercent,
        )
        self.assertEqual(after, before)

    def test_preview_and_update_clear_patient_overrides_by_default(self):
        second_profile = (
            self.db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == 20)
            .one()
        )
        second_profile.Billing = 68_000
        self.db.flush()
        preview = preview_batch_counselor_default_share_percent(
            self.db,
            [10, 20, 10],
            revenue_share_percent=45,
        )
        self.assertEqual(preview["selectedCount"], 2)
        self.assertEqual(preview["patientShareOverrideCount"], 2)
        self.assertEqual(preview["willClearPatientShareOverrideCount"], 2)

        result = update_batch_counselor_default_share_percent(
            self.db,
            [10, 20],
            revenue_share_percent=45,
        )

        profiles = self.db.query(AppCounselorProfile).order_by(AppCounselorProfile.AccountId).all()
        self.assertTrue(all(profile.DefaultShareMode == "PERCENT" for profile in profiles))
        self.assertTrue(all(profile.DefaultRevenueSharePercent == 45 for profile in profiles))
        self.assertEqual(
            {profile.AccountId: profile.FaceBilling for profile in profiles},
            {10: 27_000, 20: 30_600},
        )
        self.assertEqual(result["clearedPatientShareOverrideCount"], 2)
        override = (
            self.db.query(AppCounselorPatientPricing)
            .filter(
                AppCounselorPatientPricing.CounselorAccountId == 10,
                AppCounselorPatientPricing.PatientAccountId == 101,
            )
            .one()
        )
        self.assertIsNone(override.ShareMode)
        self.assertIsNone(override.RevenueShareCents)

    def test_explicit_preserve_keeps_patient_share_fields(self):
        for profile in self.db.query(AppCounselorProfile).all():
            profile.DefaultShareMode = "PERCENT"
            profile.DefaultRevenueSharePercent = 50
        self.db.flush()

        result = update_batch_counselor_default_share_percent(
            self.db,
            [10, 20],
            revenue_share_percent=50,
            override_patient_shares=False,
        )

        self.assertEqual(result["clearedPatientShareOverrideCount"], 0)
        self.assertEqual(result["changedCount"], 0)
        self.assertTrue(all(not item["defaultShareWillChange"] for item in result["items"]))
        rows = self.db.query(AppCounselorPatientPricing).all()
        amount_override = next(
            row for row in rows
            if row.PatientAccountId == 101 and row.CounselorAccountId == 10
        )
        percent_override = next(
            row for row in rows
            if row.PatientAccountId == 101 and row.CounselorAccountId == 20
        )
        self.assertEqual(amount_override.ShareMode, "AMOUNT")
        self.assertEqual(amount_override.RevenueShareCents, 20_000)
        self.assertEqual(percent_override.ShareMode, "PERCENT")
        self.assertEqual(percent_override.RevenueSharePercent, 30)
        adjusted = next(row for row in rows if row.PatientAccountId == 101 and row.CounselorAccountId == 10)
        self.assertEqual(adjusted.AdjustmentCents, 1_000)

    def test_missing_counselor_fails_before_any_profile_is_changed(self):
        with self.assertRaisesRegex(ValueError, "咨询师不存在"):
            update_batch_counselor_default_share_percent(
                self.db,
                [10, 999],
                revenue_share_percent=66,
            )

        profile = (
            self.db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == 10)
            .one()
        )
        self.assertIsNone(profile.DefaultShareMode)
        self.assertIsNone(profile.DefaultRevenueSharePercent)

    def test_inactive_counselor_fails_before_any_profile_is_changed(self):
        inactive_profile = (
            self.db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == 20)
            .one()
        )
        inactive_profile.IsActive = False
        self.db.flush()

        with self.assertRaisesRegex(ValueError, "咨询师不存在"):
            update_batch_counselor_default_share_percent(
                self.db,
                [10, 20],
                revenue_share_percent=66,
            )

        active_profile = (
            self.db.query(AppCounselorProfile)
            .filter(AppCounselorProfile.AccountId == 10)
            .one()
        )
        self.assertIsNone(active_profile.DefaultShareMode)
        self.assertIsNone(active_profile.DefaultRevenueSharePercent)

    def test_pricing_list_only_exposes_batch_adjustable_counselors(self):
        self.db.query(AppAccount).filter(AppAccount.Id == 20).one().IsActive = False
        self.db.flush()

        rows = list_counselor_pricing_summaries(self.db)

        self.assertEqual([row["counselorId"] for row in rows], [10])


if __name__ == "__main__":
    unittest.main()
