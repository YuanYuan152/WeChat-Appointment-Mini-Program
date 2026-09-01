from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from starlette.exceptions import HTTPException as StarletteHTTPException
from api_response import (
    ApiResponseEnvelopeMiddleware,
    api_http_exception_handler,
    api_unhandled_exception_handler,
    api_validation_exception_handler,
)
from assessment_asset_service import ASSESSMENT_ASSET_DIR, UPLOAD_DIR
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
from assessment_routes import (
    ensure_assessment_definitions,
    public_router as assessment_public_router,
)
from assessment_report_routes import web_report_router as assessment_report_router
from assessment_share_routes import router as assessment_share_router
from config import settings
from database import engine
from runtime_safety import (
    RequestLogMiddleware,
    configure_structured_logging,
    readiness_checks,
)


configure_structured_logging()

app = FastAPI(
    title="LXXL API",
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.ENABLE_API_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_API_DOCS else None,
)

app.add_exception_handler(StarletteHTTPException, api_http_exception_handler)
app.add_exception_handler(RequestValidationError, api_validation_exception_handler)
app.add_exception_handler(Exception, api_unhandled_exception_handler)


@app.on_event("startup")
def _ensure_db_schema():
    """启动时补齐 AppOrder 等表缺失列（如 ExpiresAt、ProxyCreatedByAccountId）。"""
    if not settings.AUTO_MIGRATE_SCHEMA:
        return
    try:
        from ensure_schema import (
            ensure_app_order_columns,
            ensure_app_account_columns,
            ensure_app_site_page_columns,
            ensure_counselor_profile_columns,
            ensure_leave_request_columns,
            ensure_schedule_cancel_log_columns,
            ensure_subscribe_template_columns,
            ensure_tables,
            ensure_unicode_gender_columns,
        )
        ensure_tables()
        ensure_app_account_columns()
        ensure_unicode_gender_columns()
        ensure_subscribe_template_columns()
        ensure_app_order_columns()
        ensure_leave_request_columns()
        ensure_schedule_cancel_log_columns()
        ensure_counselor_profile_columns()
        ensure_app_site_page_columns()
        from database import SessionLocal
        from charity_milestone_service import backfill_charity_negotiation_state
        db = SessionLocal()
        try:
            backfill_charity_negotiation_state(db)
            db.commit()
        finally:
            db.close()
    except Exception as exc:
        import logging

        logging.getLogger("uvicorn.error").warning(
            "schema_initialization_failed",
            extra={
                "event": "schema_initialization_failed",
                "result": type(exc).__name__,
            },
        )


@app.on_event("startup")
def _ensure_assessment_definition_files():
    """首次启动时把旧 EAP JSON 初始化为可版本化的运行时定义。"""
    try:
        ensure_assessment_definitions()
    except Exception as exc:
        import logging

        logging.getLogger("uvicorn.error").warning(
            "assessment_definition_initialization_failed",
            extra={
                "event": "assessment_definition_initialization_failed",
                "result": type(exc).__name__,
            },
        )

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ApiResponseEnvelopeMiddleware)
app.add_middleware(RequestLogMiddleware)


@app.middleware("http")
async def add_static_upload_security_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith(
        ("/static/uploads/", "/static/assessment-assets/")
    ):
        response.headers["X-Content-Type-Options"] = "nosniff"
    return response


# 上传目录必须独立持久化，并在通用 /static 之前挂载。
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ASSESSMENT_ASSET_DIR.mkdir(parents=True, exist_ok=True)
ASSESSMENT_DATA_DIR = (
    Path(settings.ASSESSMENT_DATA_DIR).expanduser()
    if settings.ASSESSMENT_DATA_DIR.strip()
    else Path(__file__).parent / "runtime" / "assessment-data"
)
app.mount(
    "/static/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
)
app.mount(
    "/static/assessment-assets",
    StaticFiles(directory=str(ASSESSMENT_ASSET_DIR)),
    name="assessment-assets",
)

# Serve bundled static files.
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
app.include_router(assessment_public_router)
app.include_router(assessment_report_router)
app.include_router(assessment_share_router)


@app.get("/health/live", include_in_schema=False)
def health_live():
    return {
        "status": "ok",
        "service": "backend",
        "environment": settings.APP_ENV,
        "version": settings.APP_VERSION,
    }


@app.get("/health/ready", include_in_schema=False)
def health_ready():
    ready, checks = readiness_checks(
        engine,
        (
            ("upload_dir", UPLOAD_DIR),
            ("assessment_data_dir", ASSESSMENT_DATA_DIR),
            ("assessment_asset_dir", ASSESSMENT_ASSET_DIR),
        ),
    )
    payload = {
        "status": "ok" if ready else "not_ready",
        "service": "backend",
        "environment": settings.APP_ENV,
        "version": settings.APP_VERSION,
        "checks": checks,
    }
    if ready:
        return payload
    return JSONResponse(status_code=503, content=payload)


@app.get("/")
def read_root():
    return {"message": "Welcome to LXXL API v2"}
