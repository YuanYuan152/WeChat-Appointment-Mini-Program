from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send


logger = logging.getLogger("uvicorn.error")


def success_payload(payload: Any) -> dict[str, Any]:
    """统一成功响应，同时保留对象原有顶层字段以兼容旧客户端。"""
    if isinstance(payload, dict):
        if "code" in payload and "data" in payload:
            return payload

        original = dict(payload)
        code = payload.get("code", 0)
        if not isinstance(code, int):
            code = 0
        msg = payload.get("msg") or payload.get("message") or "请求成功"

        result = dict(payload)
        result["code"] = code
        result["msg"] = str(msg)
        result["data"] = original
        return result

    return {"code": 0, "msg": "请求成功", "data": payload}


def error_payload(status_code: int, detail: Any, message: str | None = None) -> dict[str, Any]:
    if message:
        msg = message
    elif isinstance(detail, str):
        msg = detail
    else:
        msg = "请求参数错误" if status_code == 422 else f"请求失败：HTTP {status_code}"

    return {
        "code": status_code,
        "msg": msg,
        "data": None,
        # 保留 FastAPI 原有 detail，避免影响仍直接解析该字段的客户端。
        "detail": detail,
    }


async def api_http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=jsonable_encoder(error_payload(exc.status_code, exc.detail)),
        headers=exc.headers,
    )


async def api_validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    details = jsonable_encoder(exc.errors())
    return JSONResponse(
        status_code=422,
        content=error_payload(422, details, "请求参数校验失败"),
    )


async def api_unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # The raw path can contain account IDs, phone numbers or share codes.
    # RequestLogMiddleware already records the sanitized route template.
    logger.error(
        "unhandled_api_error",
        extra={
            "event": "unhandled_api_error",
            "result": type(exc).__name__,
        },
    )
    return JSONResponse(
        status_code=500,
        content=error_payload(500, "服务器内部错误"),
    )


class ApiResponseEnvelopeMiddleware:
    """为 /api 下的 JSON 成功响应补齐 code/msg/data。"""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope.get("path", "").startswith("/api/"):
            await self.app(scope, receive, send)
            return

        messages: list[Message] = []

        async def capture(message: Message) -> None:
            messages.append(message)

        await self.app(scope, receive, capture)

        start = next((item for item in messages if item["type"] == "http.response.start"), None)
        body_messages = [item for item in messages if item["type"] == "http.response.body"]
        if start is None or not body_messages:
            await self._replay(messages, send)
            return

        status_code = int(start["status"])
        headers = list(start.get("headers", []))
        content_type = self._header_value(headers, b"content-type").lower()
        if (
            status_code == 204
            or not (content_type.startswith("application/json") or "+json" in content_type)
        ):
            await self._replay(messages, send)
            return

        raw_body = b"".join(message.get("body", b"") for message in body_messages)
        try:
            payload = json.loads(raw_body)
        except (TypeError, ValueError, UnicodeDecodeError):
            await self._replay(messages, send)
            return

        if isinstance(payload, dict) and "code" in payload and "data" in payload:
            await self._replay(messages, send)
            return

        wrapped = success_payload(payload) if 200 <= status_code < 300 else error_payload(status_code, payload)
        encoded = json.dumps(wrapped, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        new_headers = [
            (key, value)
            for key, value in headers
            if key.lower() not in {b"content-length", b"etag"}
        ]
        new_headers.append((b"content-length", str(len(encoded)).encode("ascii")))

        await send({"type": "http.response.start", "status": status_code, "headers": new_headers})
        await send({"type": "http.response.body", "body": encoded, "more_body": False})

    @staticmethod
    def _header_value(headers: list[tuple[bytes, bytes]], name: bytes) -> str:
        for key, value in headers:
            if key.lower() == name:
                return value.decode("latin-1")
        return ""

    @staticmethod
    async def _replay(messages: list[Message], send: Send) -> None:
        for message in messages:
            await send(message)
