import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import patient_contract_service
from admin_board_routes import register_admin_board_routes
from database import Base
from models import (
    AppAccount,
    AppConsultation,
    AppCounselorProfile,
    AppOrder,
)
from patient_contract_service import (
    contract_signature_file_path,
    current_patient_contract_order,
    patient_contract_material,
)


class AdminContractMaterialTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(
            self.engine,
            tables=[
                AppAccount.__table__,
                AppOrder.__table__,
                AppConsultation.__table__,
                AppCounselorProfile.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()
        self.temporary = tempfile.TemporaryDirectory()
        self.upload_dir = Path(self.temporary.name) / "uploads"
        self.upload_dir.mkdir()
        self.upload_patch = patch.object(
            patient_contract_service,
            "UPLOAD_DIR",
            self.upload_dir,
        )
        self.upload_patch.start()

        self.patient = AppAccount(
            Id=1,
            RealName="来访甲",
            IsActive=True,
            IsContractSigned=True,
            BoundCounselorId=10,
            BoundCounselorChangedAt=datetime(2026, 1, 2, 8, 0),
            EmergencyContact="联系人甲",
            EmergencyRelation="家属",
            EmergencyPhone="13800000002",
        )
        self.counselor = AppAccount(Id=10, RealName="咨询师甲", IsActive=True)
        self.other_counselor = AppAccount(Id=20, RealName="咨询师乙", IsActive=True)
        self.db.add_all(
            [
                self.patient,
                self.counselor,
                self.other_counselor,
                AppCounselorProfile(
                    AccountId=10,
                    Name="咨询师甲",
                    IsActive=True,
                ),
            ]
        )
        self.db.flush()

    def tearDown(self):
        self.upload_patch.stop()
        self.db.close()
        self.engine.dispose()
        self.temporary.cleanup()

    def add_contract_order(
        self,
        order_id,
        paid_at,
        signature_url,
        *,
        counselor_id=10,
        status="PAID",
        is_adult=True,
    ):
        order = AppOrder(
            Id=order_id,
            AccountId=self.patient.Id,
            OutTradeNo=f"CONTRACT-{order_id}",
            TotalFee=60_001,
            Status=status,
            PaidAt=paid_at,
            IntakeIsAdult=is_adult,
            IntakeSignatureUrl=signature_url,
            CreatedAt=paid_at,
        )
        consultation = AppConsultation(
            Id=100 + order_id,
            OrderId=order_id,
            PatientId=self.patient.Id,
            CounselorId=counselor_id,
            Status="CONFIRMED",
        )
        self.db.add_all([order, consultation])
        self.db.flush()
        return order

    def test_current_cycle_excludes_old_binding_and_uses_latest_valid_order(self):
        (self.upload_dir / "old.png").write_bytes(b"old")
        (self.upload_dir / "current.png").write_bytes(b"current")
        (self.upload_dir / "wrong-counselor.png").write_bytes(b"wrong")
        self.add_contract_order(
            1,
            datetime(2026, 1, 1, 9, 0),
            "/static/uploads/old.png",
        )
        self.add_contract_order(
            2,
            datetime(2026, 1, 3, 9, 0),
            "/static/uploads/current.png",
            is_adult=False,
        )
        self.add_contract_order(
            3,
            datetime(2026, 1, 4, 9, 0),
            "/static/uploads/wrong-counselor.png",
            counselor_id=20,
        )

        selected = current_patient_contract_order(self.db, self.patient)
        material = patient_contract_material(
            self.db,
            self.patient,
            signature_download_url="/protected/signature",
        )

        self.assertEqual(selected.Id, 2)
        self.assertEqual(material["agreementType"], "YANGFAN")
        self.assertFalse(material["isTongxin"])
        self.assertEqual(material["signedAt"], datetime(2026, 1, 3, 9, 0))
        self.assertEqual(material["orderId"], 2)
        self.assertEqual(material["patientName"], "来访甲")
        self.assertEqual(material["counselorName"], "咨询师甲")
        self.assertEqual(material["billingYuan"], 600.01)
        self.assertEqual(material["emergencyContact"]["phone"], "13800000002")
        self.assertEqual(material["signatureFileId"], "current.png")
        self.assertEqual(material["signatureDownloadUrl"], "/protected/signature")
        self.assertEqual(material["signatureDownloadPath"], "/protected/signature")

    def test_latest_order_is_chosen_only_among_complete_paid_signatures(self):
        (self.upload_dir / "first.png").write_bytes(b"first")
        (self.upload_dir / "latest.png").write_bytes(b"latest")
        self.add_contract_order(
            4,
            datetime(2026, 1, 3, 9, 0),
            "/static/uploads/first.png",
        )
        self.add_contract_order(
            5,
            datetime(2026, 1, 4, 9, 0),
            "/static/uploads/latest.png",
        )
        self.add_contract_order(
            6,
            datetime(2026, 1, 5, 9, 0),
            "",
        )

        self.assertEqual(current_patient_contract_order(self.db, self.patient).Id, 5)

    def test_material_uses_matching_current_account_signature_time(self):
        (self.upload_dir / "signed.png").write_bytes(b"signed")
        self.add_contract_order(
            9,
            datetime(2026, 1, 3, 9, 0),
            "/static/uploads/signed.png",
        )
        self.patient.IntakeSignatureUrl = "/static/uploads/signed.png"
        self.patient.IntakeAgreementSignedAt = datetime(2026, 1, 3, 8, 30)

        material = patient_contract_material(
            self.db,
            self.patient,
            signature_download_url="/protected/signature",
        )

        self.assertEqual(material["signedAt"], datetime(2026, 1, 3, 8, 30))

    def test_unsigned_unbound_or_missing_signature_has_no_material(self):
        self.add_contract_order(
            7,
            datetime(2026, 1, 3, 9, 0),
            "",
        )
        self.assertIsNone(current_patient_contract_order(self.db, self.patient))

        self.patient.IsContractSigned = False
        self.assertIsNone(current_patient_contract_order(self.db, self.patient))
        self.patient.IsContractSigned = True
        self.patient.BoundCounselorId = None
        self.assertIsNone(current_patient_contract_order(self.db, self.patient))

    def test_signature_path_accepts_absolute_upload_url_and_blocks_traversal(self):
        signature = self.upload_dir / "signature.png"
        signature.write_bytes(b"signature")
        outside = Path(self.temporary.name) / "outside.png"
        outside.write_bytes(b"outside")

        self.assertEqual(
            contract_signature_file_path(
                "https://api.example.test/static/uploads/signature.png",
            ),
            signature.resolve(),
        )
        unsafe_urls = [
            "/static/uploads/../outside.png",
            "/static/uploads/%2e%2e/outside.png",
            "/static/uploads/..\\outside.png",
            "file:///static/uploads/signature.png",
            "/static/uploads/signature.png?download=1",
        ]
        for unsafe_url in unsafe_urls:
            with self.subTest(url=unsafe_url):
                self.assertIsNone(contract_signature_file_path(unsafe_url))

    def test_routes_are_staff_protected_and_return_404_without_valid_signature(self):
        def require_staff():
            return self.counselor

        router = APIRouter(prefix="/api/mini/admin")
        register_admin_board_routes(
            router,
            require_staff_workbench=require_staff,
            visitor_patient_ids=lambda _db: {self.patient.Id},
            counselor_account_ids=lambda _db: [self.counselor.Id],
        )
        material_route = next(
            route
            for route in router.routes
            if route.path.endswith("/{account_id}/contract-material")
        )
        signature_route = next(
            route
            for route in router.routes
            if route.path.endswith("/{account_id}/contract-material/signature")
        )
        for route in (material_route, signature_route):
            self.assertTrue(
                any(dependency.call is require_staff for dependency in route.dependant.dependencies)
            )

        with self.assertRaises(HTTPException) as raised:
            material_route.endpoint(
                self.patient.Id,
                _staff=self.counselor,
                db=self.db,
            )
        self.assertEqual(raised.exception.status_code, 404)

        signature = self.upload_dir / "download.png"
        signature.write_bytes(b"download")
        self.add_contract_order(
            8,
            datetime(2026, 1, 3, 9, 0),
            "http://localhost:8000/static/uploads/download.png",
        )
        response = signature_route.endpoint(
            self.patient.Id,
            _staff=self.counselor,
            db=self.db,
        )
        self.assertIsInstance(response, FileResponse)
        self.assertEqual(Path(response.path), signature.resolve())
        self.assertEqual(response.media_type, "image/png")
        self.assertEqual(response.headers["cache-control"], "private, no-store")


if __name__ == "__main__":
    unittest.main()
