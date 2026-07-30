"""Runtime logging, request correlation, and readiness helpers.

Only allow-listed request metadata is logged.  Request bodies, query strings,
headers, cookies, tokens, and user-provided values are deliberately excluded.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

from sqlalchemy import text
from sqlalchemy.engine import Engine
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from config import settings


REQUEST_ID_HEADER = b"x-request-id"
_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,64}$")
_LOG_RECORD_FIELDS = (
    "event",
    "request_id",
    "method",
    "path",
    "status",
    "duration_ms",
    "check",
    "result",
)


class JsonLogFormatter(logging.Formatter):
    """Render a stable, intentionally small JSON log schema."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "service": "backend",
            "environment": settings.APP_ENV,
            "version": settings.APP_VERSION,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in _LOG_RECORD_FIELDS:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info and record.exc_info[0]:
            # Exception messages can contain driver values or user input.  Keep
            # the type for triage without copying the exception text.
            payload["exception_type"] = record.exc_info[0].__name__
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_structured_logging() -> None:
    """Send application and Uvicorn logs to stdout as structured JSON."""

    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Uvicorn's access formatter includes the raw query string.  The middleware
    # below replaces it with an allow-listed request completion event.
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers.clear()
    access_logger.propagate = False
    access_logger.disabled = True

    for logger_name in ("uvicorn", "uvicorn.error"):
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.propagate = True
        logger.setLevel(level)


def _request_id_from_scope(scope: Scope) -> str:
    for key, value in scope.get("headers", []):
        if key.lower() != REQUEST_ID_HEADER:
            continue
        try:
            supplied = value.decode("ascii")
        except UnicodeDecodeError:
            break
        if _REQUEST_ID_PATTERN.fullmatch(supplied):
            return supplied
        break
    return uuid.uuid4().hex


def _route_template_from_scope(scope: Scope) -> str:
    """Prefer a framework route template so path parameters never reach logs."""

    route = scope.get("route")
    route_path = getattr(route, "path", None)
    if isinstance(route_path, str) and route_path.startswith("/"):
        return route_path[:256]
    # Unmatched requests and mounted static paths may contain arbitrary
    # user-controlled segments, so do not copy the raw path as a fallback.
    return "<unmatched>"


class RequestLogMiddleware:
    """Attach a request id and log one sanitized completion event."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        logger: logging.Logger | None = None,
        clock: Callable[[], float] = time.perf_counter,
    ) -> None:
        self.app = app
        self.logger = logger or logging.getLogger("mini_program.request")
        self.clock = clock

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _request_id_from_scope(scope)
        started_at = self.clock()
        status_code = 500

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                headers = [
                    (key, value)
                    for key, value in message.get("headers", [])
                    if key.lower() != REQUEST_ID_HEADER
                ]
                headers.append((REQUEST_ID_HEADER, request_id.encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            duration_ms = max(0.0, (self.clock() - started_at) * 1000)
            self.logger.info(
                "http_request_completed",
                extra={
                    "event": "http_request_completed",
                    "request_id": request_id,
                    "method": scope.get("method", ""),
                    "path": _route_template_from_scope(scope),
                    "status": status_code,
                    "duration_ms": round(duration_ms, 2),
                },
            )


def directory_is_writable(path: Path) -> bool:
    """Verify real write permission with a short-lived, empty probe file."""

    if not path.is_dir():
        return False
    probe = path / f".readiness-{uuid.uuid4().hex}"
    descriptor: int | None = None
    try:
        descriptor = os.open(
            probe,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL,
            0o600,
        )
        return True
    except OSError:
        return False
    finally:
        if descriptor is not None:
            os.close(descriptor)
        try:
            probe.unlink(missing_ok=True)
        except OSError:
            pass


def readiness_checks(
    engine: Engine,
    directories: Iterable[tuple[str, Path]],
) -> tuple[bool, dict[str, str]]:
    """Check the database and persistent directories without returning details."""

    results: dict[str, str] = {}
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        results["database"] = "ok"
    except Exception:
        results["database"] = "error"

    for name, directory in directories:
        results[name] = "ok" if directory_is_writable(directory) else "error"

    return all(value == "ok" for value in results.values()), results
