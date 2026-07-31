#!/usr/bin/python3

"""Verify the GitHub Actions OIDC proof used by the fixed test gateway.

The JWT is accepted only on stdin.  This script intentionally has no option
for overriding the issuer, JWKS URL, audience, repository, workflow, or ref.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import ssl
import stat
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any


ISSUER = "https://token.actions.githubusercontent.com"
JWKS_URL = "https://token.actions.githubusercontent.com/.well-known/jwks"
AUDIENCE = "urn:ji-psy:test-deploy:124.221.56.121"
REPOSITORY = "YuanYuan152/WeChat-Appointment-Mini-Program"
OWNER = "YuanYuan152"
REPOSITORY_ID = "1263497354"
OWNER_ID = "202759725"
REF = "refs/heads/dev"
WORKFLOW_REF = (
    "YuanYuan152/WeChat-Appointment-Mini-Program/"
    ".github/workflows/deploy-test.yml@refs/heads/dev"
)
SUBJECT = f"repo:{REPOSITORY}:environment:test"
DEV_REF_URL = (
    "https://api.github.com/repos/"
    "YuanYuan152/WeChat-Appointment-Mini-Program/git/ref/heads/dev"
)
OIDC_STATE = Path("/data/mini_program/deployments/test/oidc-last.json")
MAX_JWT_BYTES = 16_384
MAX_JWKS_BYTES = 1_048_576
MAX_TOKEN_LIFETIME_SECONDS = 600
CLOCK_SKEW_SECONDS = 60


class VerificationError(Exception):
    """Expected authentication failure that is safe to report generically."""


def fail(message: str) -> None:
    print(f"[ERROR] GitHub OIDC 验证失败：{message}", file=sys.stderr)
    raise SystemExit(65)


def no_duplicate_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise VerificationError("JSON 包含重复字段")
        result[key] = value
    return result


def decode_base64url(value: str) -> bytes:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise VerificationError("JWT base64url 格式无效")
    padding = "=" * (-len(value) % 4)
    try:
        return base64.urlsafe_b64decode(value + padding)
    except Exception as exc:  # binascii errors vary between Python releases
        raise VerificationError("JWT base64url 无法解码") from exc


def decode_json_segment(value: str, label: str) -> dict[str, Any]:
    raw = decode_base64url(value)
    try:
        parsed = json.loads(
            raw.decode("utf-8"),
            object_pairs_hook=no_duplicate_object,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError(f"{label} 不是有效 JSON") from exc
    if not isinstance(parsed, dict):
        raise VerificationError(f"{label} 必须是 JSON object")
    return parsed


def der_length(length: int) -> bytes:
    if length < 0:
        raise VerificationError("DER 长度无效")
    if length < 128:
        return bytes([length])
    encoded = length.to_bytes((length.bit_length() + 7) // 8, "big")
    return bytes([0x80 | len(encoded)]) + encoded


def der_item(tag: int, content: bytes) -> bytes:
    return bytes([tag]) + der_length(len(content)) + content


def der_integer(value: int) -> bytes:
    if value <= 0:
        raise VerificationError("RSA 参数无效")
    encoded = value.to_bytes((value.bit_length() + 7) // 8, "big")
    if encoded[0] & 0x80:
        encoded = b"\x00" + encoded
    return der_item(0x02, encoded)


def jwk_to_pem(jwk: dict[str, Any]) -> bytes:
    if (
        jwk.get("kty") != "RSA"
        or jwk.get("alg") != "RS256"
        or jwk.get("use") != "sig"
    ):
        raise VerificationError("JWKS key 类型或用途无效")
    modulus_raw = jwk.get("n")
    exponent_raw = jwk.get("e")
    if not isinstance(modulus_raw, str) or not isinstance(exponent_raw, str):
        raise VerificationError("JWKS RSA 参数缺失")
    modulus = int.from_bytes(decode_base64url(modulus_raw), "big")
    exponent = int.from_bytes(decode_base64url(exponent_raw), "big")
    rsa_public_key = der_item(
        0x30,
        der_integer(modulus) + der_integer(exponent),
    )
    # rsaEncryption OID 1.2.840.113549.1.1.1 plus NULL parameters.
    algorithm_identifier = bytes.fromhex("300d06092a864886f70d0101010500")
    subject_public_key = der_item(0x03, b"\x00" + rsa_public_key)
    spki = der_item(0x30, algorithm_identifier + subject_public_key)
    body = base64.b64encode(spki).decode("ascii")
    wrapped = "\n".join(body[index : index + 64] for index in range(0, len(body), 64))
    return (
        "-----BEGIN PUBLIC KEY-----\n"
        f"{wrapped}\n"
        "-----END PUBLIC KEY-----\n"
    ).encode("ascii")


def fetch_json(url: str, *, maximum_bytes: int, label: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "mini-program-actions-oidc-verifier/1",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(
            request,
            timeout=10,
            context=ssl.create_default_context(),
        ) as response:
            if response.geturl() != url:
                raise VerificationError(f"{label} 不允许重定向")
            if response.status != 200:
                raise VerificationError(f"{label} HTTP 状态无效")
            raw = response.read(maximum_bytes + 1)
    except VerificationError:
        raise
    except Exception as exc:
        raise VerificationError(f"无法通过 HTTPS 获取 {label}") from exc
    if len(raw) > maximum_bytes:
        raise VerificationError(f"{label} 响应过大")
    try:
        parsed = json.loads(
            raw.decode("utf-8"),
            object_pairs_hook=no_duplicate_object,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError(f"{label} JSON 无效") from exc
    if not isinstance(parsed, dict):
        raise VerificationError(f"{label} 顶层格式无效")
    return parsed


def fetch_jwks() -> dict[str, Any]:
    return fetch_json(
        JWKS_URL,
        maximum_bytes=MAX_JWKS_BYTES,
        label="GitHub JWKS",
    )


def verify_current_dev_sha(release_sha: str) -> None:
    payload = fetch_json(
        DEV_REF_URL,
        maximum_bytes=65_536,
        label="GitHub dev ref",
    )
    git_object = payload.get("object")
    if not isinstance(git_object, dict) or git_object.get("sha") != release_sha:
        raise VerificationError("release SHA 已不是远程 dev 当前提交")


def select_jwk(jwks: dict[str, Any], kid: str) -> dict[str, Any]:
    keys = jwks.get("keys")
    if not isinstance(keys, list) or not 1 <= len(keys) <= 32:
        raise VerificationError("JWKS keys 数量无效")
    matches = [
        key
        for key in keys
        if isinstance(key, dict) and key.get("kid") == kid
    ]
    if len(matches) != 1:
        raise VerificationError("JWT kid 在 JWKS 中必须唯一匹配")
    return matches[0]


def verify_signature(
    signing_input: bytes,
    signature: bytes,
    public_key_pem: bytes,
) -> None:
    with tempfile.TemporaryDirectory(prefix="mini-github-oidc-") as directory:
        root = Path(directory)
        public_key = root / "public.pem"
        payload = root / "payload.bin"
        signature_file = root / "signature.bin"
        public_key.write_bytes(public_key_pem)
        payload.write_bytes(signing_input)
        signature_file.write_bytes(signature)
        for path in (public_key, payload, signature_file):
            path.chmod(0o600)
        try:
            completed = subprocess.run(
                [
                    "/usr/bin/openssl",
                    "dgst",
                    "-sha256",
                    "-verify",
                    str(public_key),
                    "-signature",
                    str(signature_file),
                    str(payload),
                ],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env={"PATH": "/usr/bin:/bin", "LANG": "C"},
                check=False,
                timeout=5,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise VerificationError("OpenSSL 签名验证不可用") from exc
        if completed.returncode != 0:
            raise VerificationError("JWT RS256 签名无效")


def require_exact(claims: dict[str, Any], key: str, expected: str) -> None:
    if claims.get(key) != expected:
        raise VerificationError(f"claim {key} 与固定发布上下文不一致")


def require_numeric_date(claims: dict[str, Any], key: str) -> int:
    value = claims.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise VerificationError(f"claim {key} 必须是整数时间")
    return value


def verify_claims(
    claims: dict[str, Any],
    *,
    release_sha: str,
    run_id: str,
    run_attempt: str,
    actor: str,
) -> tuple[str, int]:
    require_exact(claims, "iss", ISSUER)
    require_exact(claims, "aud", AUDIENCE)
    require_exact(claims, "sub", SUBJECT)
    require_exact(claims, "repository", REPOSITORY)
    require_exact(claims, "repository_owner", OWNER)
    require_exact(claims, "repository_id", REPOSITORY_ID)
    require_exact(claims, "repository_owner_id", OWNER_ID)
    require_exact(claims, "repository_visibility", "public")
    require_exact(claims, "ref", REF)
    require_exact(claims, "ref_type", "branch")
    require_exact(claims, "sha", release_sha)
    require_exact(claims, "workflow_sha", release_sha)
    require_exact(claims, "workflow_ref", WORKFLOW_REF)
    require_exact(claims, "event_name", "push")
    require_exact(claims, "environment", "test")
    require_exact(claims, "runner_environment", "github-hosted")
    require_exact(claims, "run_id", run_id)
    require_exact(claims, "run_attempt", run_attempt)
    require_exact(claims, "actor", actor)

    jti = claims.get("jti")
    if not isinstance(jti, str) or not re.fullmatch(
        r"[A-Za-z0-9._:-]{16,200}",
        jti,
    ):
        raise VerificationError("claim jti 格式无效")

    now = int(time.time())
    issued_at = require_numeric_date(claims, "iat")
    not_before = require_numeric_date(claims, "nbf")
    expires_at = require_numeric_date(claims, "exp")
    if issued_at > now + CLOCK_SKEW_SECONDS:
        raise VerificationError("JWT iat 位于未来")
    if not_before > now + CLOCK_SKEW_SECONDS:
        raise VerificationError("JWT 尚未生效")
    if expires_at < now - CLOCK_SKEW_SECONDS:
        raise VerificationError("JWT 已过期")
    if expires_at <= issued_at:
        raise VerificationError("JWT 生命周期无效")
    if not_before > expires_at:
        raise VerificationError("JWT nbf 晚于 exp")
    if expires_at - issued_at > MAX_TOKEN_LIFETIME_SECONDS:
        raise VerificationError("JWT 生命周期超过 10 分钟")
    if now - issued_at > MAX_TOKEN_LIFETIME_SECONDS:
        raise VerificationError("JWT 签发时间过旧")
    return jti, issued_at


def assert_secure_state_directory(path: Path) -> None:
    try:
        metadata = path.lstat()
    except OSError as exc:
        raise VerificationError("OIDC 状态目录不存在") from exc
    if (
        not stat.S_ISDIR(metadata.st_mode)
        or metadata.st_uid != 0
        or metadata.st_mode & 0o022
    ):
        raise VerificationError("OIDC 状态目录权限无效")


def read_previous_oidc_state() -> dict[str, Any] | None:
    try:
        metadata = OIDC_STATE.lstat()
    except FileNotFoundError:
        return None
    except OSError as exc:
        raise VerificationError("无法读取 OIDC 重放状态") from exc
    if (
        not stat.S_ISREG(metadata.st_mode)
        or metadata.st_uid != 0
        or metadata.st_mode & 0o077
    ):
        raise VerificationError("OIDC 重放状态权限无效")
    try:
        state = json.loads(
            OIDC_STATE.read_text(encoding="utf-8"),
            object_pairs_hook=no_duplicate_object,
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError("OIDC 重放状态格式无效") from exc
    if not isinstance(state, dict) or set(state) != {
        "jti",
        "run_id",
        "run_attempt",
        "iat",
    }:
        raise VerificationError("OIDC 重放状态字段无效")
    if (
        not isinstance(state["jti"], str)
        or not isinstance(state["run_id"], int)
        or isinstance(state["run_id"], bool)
        or not isinstance(state["run_attempt"], int)
        or isinstance(state["run_attempt"], bool)
        or not isinstance(state["iat"], int)
        or isinstance(state["iat"], bool)
    ):
        raise VerificationError("OIDC 重放状态值无效")
    return state


def consume_oidc_proof(
    *,
    jti: str,
    issued_at: int,
    run_id: str,
    run_attempt: str,
) -> None:
    assert_secure_state_directory(OIDC_STATE.parent)
    previous = read_previous_oidc_state()
    numeric_run_id = int(run_id)
    numeric_attempt = int(run_attempt)
    if previous is not None:
        if previous["jti"] == jti:
            raise VerificationError("OIDC jti 已使用")
        if numeric_run_id < previous["run_id"] or (
            numeric_run_id == previous["run_id"]
            and numeric_attempt <= previous["run_attempt"]
        ):
            raise VerificationError("GitHub run/attempt 不是新的发布尝试")
        if issued_at < previous["iat"]:
            raise VerificationError("OIDC iat 早于已接受发布")

    state = {
        "jti": jti,
        "run_id": numeric_run_id,
        "run_attempt": numeric_attempt,
        "iat": issued_at,
    }
    temporary = OIDC_STATE.parent / (
        f".oidc-last.{numeric_run_id}.{numeric_attempt}.{time.time_ns()}"
    )
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = -1
    try:
        descriptor = os.open(temporary, flags, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            descriptor = -1
            json.dump(state, output, separators=(",", ":"), sort_keys=True)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.chown(temporary, 0, 0)
        os.chmod(temporary, 0o600)
        os.replace(temporary, OIDC_STATE)
        directory_descriptor = os.open(OIDC_STATE.parent, os.O_RDONLY)
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    except OSError as exc:
        if descriptor >= 0:
            os.close(descriptor)
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass
        raise VerificationError("无法原子记录 OIDC 重放状态") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--release-sha", required=True)
    parser.add_argument("--run-id")
    parser.add_argument("--run-attempt")
    parser.add_argument("--actor")
    parser.add_argument("--current-only", action="store_true")
    arguments = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", arguments.release_sha):
        fail("release SHA 参数无效")
    if arguments.current_only:
        if any(
            value is not None
            for value in (
                arguments.run_id,
                arguments.run_attempt,
                arguments.actor,
            )
        ):
            fail("--current-only 不接受 run/attempt/actor")
        return arguments
    if not isinstance(arguments.run_id, str) or not re.fullmatch(
        r"[0-9]{1,20}",
        arguments.run_id,
    ):
        fail("run id 参数无效")
    if not isinstance(arguments.run_attempt, str) or not re.fullmatch(
        r"[1-9][0-9]{0,5}",
        arguments.run_attempt,
    ):
        fail("run attempt 参数无效")
    if not isinstance(arguments.actor, str) or not re.fullmatch(
        r"[A-Za-z0-9-]{1,39}",
        arguments.actor,
    ):
        fail("actor 参数无效")
    return arguments


def main() -> None:
    arguments = parse_args()
    if arguments.current_only:
        try:
            verify_current_dev_sha(arguments.release_sha)
        except VerificationError as exc:
            fail(str(exc))
        print("[INFO] 远程 dev 当前提交验证通过", file=sys.stderr)
        return

    raw_token = sys.stdin.buffer.readline(MAX_JWT_BYTES + 2)
    if not raw_token.endswith(b"\n"):
        fail("stdin 必须包含一行完整 JWT")
    if sys.stdin.buffer.read(1):
        fail("stdin 只能包含一行 JWT")
    token = raw_token[:-1]
    if not 1 <= len(token) <= MAX_JWT_BYTES:
        fail("JWT 长度无效")
    try:
        token_text = token.decode("ascii")
    except UnicodeDecodeError:
        fail("JWT 必须是 ASCII")
    segments = token_text.split(".")
    if len(segments) != 3:
        fail("JWT 必须包含三个 segment")

    try:
        header = decode_json_segment(segments[0], "JWT header")
        claims = decode_json_segment(segments[1], "JWT payload")
        if header.get("alg") != "RS256" or header.get("typ") != "JWT":
            raise VerificationError("JWT alg/typ 无效")
        kid = header.get("kid")
        if not isinstance(kid, str) or not re.fullmatch(
            r"[A-Za-z0-9._:-]{1,200}",
            kid,
        ):
            raise VerificationError("JWT kid 格式无效")
        jwk = select_jwk(fetch_jwks(), kid)
        public_key = jwk_to_pem(jwk)
        signature = decode_base64url(segments[2])
        verify_signature(
            f"{segments[0]}.{segments[1]}".encode("ascii"),
            signature,
            public_key,
        )
        jti, issued_at = verify_claims(
            claims,
            release_sha=arguments.release_sha,
            run_id=arguments.run_id,
            run_attempt=arguments.run_attempt,
            actor=arguments.actor,
        )
        verify_current_dev_sha(arguments.release_sha)
        consume_oidc_proof(
            jti=jti,
            issued_at=issued_at,
            run_id=arguments.run_id,
            run_attempt=arguments.run_attempt,
        )
    except VerificationError as exc:
        fail(str(exc))

    print("[INFO] GitHub OIDC 发布身份验证通过", file=sys.stderr)


if __name__ == "__main__":
    main()
