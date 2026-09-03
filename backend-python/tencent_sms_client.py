"""腾讯云短信 SendSms（API 3.0）封装。"""

from __future__ import annotations

import json
import logging
from typing import Optional, Sequence

from fastapi import HTTPException

from config import settings

logger = logging.getLogger(__name__)


def _require_sdk():
    try:
        from tencentcloud.common import credential
        from tencentcloud.common.exception.tencent_cloud_sdk_exception import (
            TencentCloudSDKException,
        )
        from tencentcloud.common.profile.client_profile import ClientProfile
        from tencentcloud.common.profile.http_profile import HttpProfile
        from tencentcloud.sms.v20210111 import models, sms_client

        return (
            credential,
            TencentCloudSDKException,
            ClientProfile,
            HttpProfile,
            models,
            sms_client,
        )
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="未安装腾讯云短信 SDK，请执行 pip install tencentcloud-sdk-python",
        ) from exc


def _parse_template_param_json(raw: str, code: str) -> Sequence[str]:
    text = (raw or "").strip()
    if text:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="短信模板参数 JSON 配置无效",
            ) from exc
        if isinstance(parsed, list):
            return [str(item).replace("{code}", code) for item in parsed]
        if isinstance(parsed, dict):
            return [str(parsed.get("code", code))]
        raise HTTPException(status_code=500, detail="短信模板参数 JSON 需为数组或对象")
    expire_minutes = str(settings.SMS_CODE_TTL_MINUTES)
    return [code, expire_minutes]


def send_sms_code(
    mobile: str,
    code: str,
    *,
    template_id: str,
    template_param_json: str = "",
) -> None:
    """向中国大陆手机号发送验证码短信。"""
    if not settings.tencent_sms_base_configured:
        raise HTTPException(status_code=503, detail="短信服务未配置")
    if not (template_id or "").strip():
        raise HTTPException(status_code=503, detail="短信模板未配置")

    (
        credential,
        TencentCloudSDKException,
        ClientProfile,
        HttpProfile,
        models,
        sms_client,
    ) = _require_sdk()

    cred = credential.Credential(
        settings.TENCENT_SMS_SECRET_ID,
        settings.TENCENT_SMS_SECRET_KEY,
    )
    http_profile = HttpProfile()
    http_profile.endpoint = "sms.tencentcloudapi.com"
    client_profile = ClientProfile()
    client_profile.httpProfile = http_profile
    client = sms_client.SmsClient(
        cred,
        settings.TENCENT_SMS_REGION,
        client_profile,
    )

    request = models.SendSmsRequest()
    request.SmsSdkAppId = settings.TENCENT_SMS_SDK_APP_ID
    request.SignName = settings.TENCENT_SMS_SIGN_NAME
    request.TemplateId = template_id.strip()
    request.PhoneNumberSet = [f"+86{mobile}"]
    request.TemplateParamSet = _parse_template_param_json(template_param_json, code)

    try:
        response = client.SendSms(request)
    except TencentCloudSDKException as exc:
        logger.error(
            "tencent_sms_send_failed",
            extra={"event": "tencent_sms_send_failed", "error": str(exc)},
        )
        raise HTTPException(status_code=502, detail="短信发送失败，请稍后重试") from exc

    statuses = getattr(getattr(response, "SendStatusSet", None), "__iter__", lambda: [])()
    status_list = list(statuses) if statuses else []
    if not status_list:
        raise HTTPException(status_code=502, detail="短信发送失败，请稍后重试")

    first = status_list[0]
    serial = getattr(first, "SerialNo", None) or getattr(first, "serialNo", None)
    sdk_code = getattr(first, "Code", None) or getattr(first, "code", None)
    if sdk_code != "Ok":
        message = getattr(first, "Message", None) or getattr(first, "message", None) or "未知错误"
        logger.error(
            "tencent_sms_rejected",
            extra={
                "event": "tencent_sms_rejected",
                "code": sdk_code,
                "message": message,
            },
        )
        raise HTTPException(status_code=502, detail="短信发送失败，请稍后重试")

    logger.info(
        "tencent_sms_sent",
        extra={
            "event": "tencent_sms_sent",
            "serial_no": serial,
            "mobile_tail": mobile[-4:],
            "template_id": template_id.strip(),
        },
    )


def send_login_code(mobile: str, code: str) -> None:
    send_sms_code(
        mobile,
        code,
        template_id=settings.TENCENT_SMS_TEMPLATE_ID,
        template_param_json=settings.TENCENT_SMS_TEMPLATE_PARAM_JSON,
    )


def send_reset_password_code(mobile: str, code: str) -> None:
    template_id = (
        settings.TENCENT_SMS_RESET_PASSWORD_TEMPLATE_ID.strip()
        or settings.TENCENT_SMS_TEMPLATE_ID
    )
    param_json = (
        settings.TENCENT_SMS_RESET_PASSWORD_TEMPLATE_PARAM_JSON.strip()
        or settings.TENCENT_SMS_TEMPLATE_PARAM_JSON
    )
    send_sms_code(
        mobile,
        code,
        template_id=template_id,
        template_param_json=param_json,
    )
