"""代理预约推送后的消息通知。"""

from sqlalchemy.orm import Session

from models import AppAccount, AppOrder, AppSchedule
from pricing_service import get_counselor_profile


def _display_name(acc: AppAccount) -> str:
    return acc.RealName or acc.Nickname or f"用户{acc.Id}"


def notify_proxy_order_created(
    db: Session,
    *,
    order: AppOrder,
    schedule: AppSchedule,
    patient: AppAccount,
    counselor_id: int,
) -> None:
    from counselor_message_service import notify_counselor_proxy_order_pending
    from patient_message_service import notify_patient_proxy_order_pending

    profile = get_counselor_profile(db, counselor_id)
    counselor_name = (profile.Name if profile else None) or f"咨询师#{counselor_id}"
    patient_name = _display_name(patient)

    notify_counselor_proxy_order_pending(
        db,
        counselor_id=counselor_id,
        schedule=schedule,
        patient_name=patient_name,
        order=order,
    )
    notify_patient_proxy_order_pending(
        db,
        patient=patient,
        counselor_name=counselor_name,
        schedule=schedule,
        order=order,
    )
