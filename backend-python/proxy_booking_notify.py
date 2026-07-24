"""代理预约推送后的消息通知。"""

from sqlalchemy.orm import Session

from models import AppAccount, AppOrder, AppSchedule
from pricing_service import get_counselor_profile


def notify_proxy_order_created(
    db: Session,
    *,
    order: AppOrder,
    schedule: AppSchedule,
    patient: AppAccount,
    counselor_id: int,
    staff_account_id: int,
    notify_target_counselor: bool = True,
) -> None:
    from counselor_message_service import notify_counselor_proxy_order_pending
    from patient_message_service import notify_patient_proxy_order_pending
    from staff_message_service import notify_staff_proxy_order_pushed

    profile = get_counselor_profile(db, counselor_id)
    counselor_name = (profile.Name if profile else None) or f"咨询师#{counselor_id}"

    notify_patient_proxy_order_pending(
        db,
        patient=patient,
        counselor_name=counselor_name,
        schedule=schedule,
        order=order,
    )
    notify_staff_proxy_order_pushed(
        db,
        staff_account_id=staff_account_id,
        order=order,
        schedule=schedule,
        patient=patient,
        counselor_id=counselor_id,
    )
    if notify_target_counselor:
        notify_counselor_proxy_order_pending(
            db,
            counselor_id=counselor_id,
            schedule=schedule,
            patient_id=patient.Id,
            order=order,
        )
