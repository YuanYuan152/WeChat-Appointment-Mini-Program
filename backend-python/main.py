from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from starlette.exceptions import HTTPException as StarletteHTTPException
from api_response import (
    ApiResponseEnvelopeMiddleware,
    api_http_exception_handler,
    api_unhandled_exception_handler,
    api_validation_exception_handler,
)
from auth import router as auth_router
from payment import router as payment_router
from upload import router as upload_router
from patient import router as patient_router
from counselor import router as counselor_router
from assistant import router as assistant_router
from ops import router as ops_router
from common import router as common_router
from message import router as message_router
from admin import router as admin_router
from feedback import router as feedback_router
from web_admin import router as web_admin_router
from web_auth import router as web_auth_router

app = FastAPI(title="LXXL API", version="2.0")

app.add_exception_handler(StarletteHTTPException, api_http_exception_handler)
app.add_exception_handler(RequestValidationError, api_validation_exception_handler)
app.add_exception_handler(Exception, api_unhandled_exception_handler)


@app.on_event("startup")
def _ensure_db_schema():
    """启动时补齐 AppOrder 等表缺失列（如 ExpiresAt、ProxyCreatedByAccountId）。"""
    try:
        from ensure_schema import (
            ensure_app_order_columns,
            ensure_app_account_columns,
            ensure_counselor_profile_columns,
            ensure_leave_request_columns,
            ensure_schedule_cancel_log_columns,
            ensure_tables,
        )
        ensure_tables()
        ensure_app_account_columns()
        ensure_app_order_columns()
        ensure_leave_request_columns()
        ensure_schedule_cancel_log_columns()
        ensure_counselor_profile_columns()
        from database import SessionLocal
        from charity_milestone_service import backfill_charity_negotiation_state
        from patient_contract_service import backfill_patient_contract_signed_from_orders

        db = SessionLocal()
        try:
            backfill_charity_negotiation_state(db)
            backfill_patient_contract_signed_from_orders(db)
            db.commit()
        finally:
            db.close()
    except Exception as exc:
        import logging
        logging.getLogger("uvicorn.error").warning("ensure_schema skipped: %s", exc)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ApiResponseEnvelopeMiddleware)

# Serve uploaded static files
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

app.include_router(auth_router)
app.include_router(payment_router)
app.include_router(upload_router)
app.include_router(patient_router)
app.include_router(counselor_router)
app.include_router(assistant_router)
app.include_router(ops_router)
app.include_router(common_router)
app.include_router(message_router)
app.include_router(admin_router)
app.include_router(feedback_router)
app.include_router(web_admin_router)
app.include_router(web_auth_router)

@app.get("/")
def read_root():
    return {"message": "Welcome to LXXL API v2"}
