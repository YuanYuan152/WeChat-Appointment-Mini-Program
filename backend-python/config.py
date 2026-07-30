import urllib.parse
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


_DEVELOPMENT_CORS_ORIGINS = ",".join(
    (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    )
)
_UNSAFE_JWT_SECRETS = frozenset(
    {
        "",
        "your-super-secret-key-change-it-in-production",
        "change_this_to_a_long_random_secret_in_production",
        "development-only-secret-do-not-use-outside-local",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Runtime mode and deployment safety switches.
    APP_ENV: Literal["development", "test", "production"] = "development"
    APP_VERSION: str = "2.0"
    ALLOW_DEV_LOGIN: bool = True
    ALLOW_SIMULATED_PAYMENT: bool = True
    AUTO_MIGRATE_SCHEMA: bool = True
    CORS_ALLOWED_ORIGINS: str = _DEVELOPMENT_CORS_ORIGINS
    ENABLE_API_DOCS: bool = True
    LOG_LEVEL: str = "INFO"

    # Database configuration
    # 默认使用 Windows 集成认证连接本机 SQLEXPRESS。
    # 如果要使用 SQL Server 用户名密码认证：
    #   DB_TRUSTED_CONNECTION=false
    #   DB_SERVER=192.168.1.100
    #   DB_PORT=1433
    #   DB_USER=sa
    #   DB_PASSWORD=your_password
    DB_SERVER: str = "localhost"
    DB_PORT: str = "1433"
    DB_NAME: str = "lxxlBuild"
    DB_USER: str = "sa"
    # Passwords must come from an environment file or secret store.  Keeping
    # this empty preserves local trusted-connection setups without shipping a
    # reusable credential in source control.
    DB_PASSWORD: str = ""
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    DB_TRUSTED_CONNECTION: bool = False
    DB_TRUST_SERVER_CERTIFICATE: bool = True
    DB_CONNECT_TIMEOUT: int = 5
    # 开发环境建议 true：跳过 T_Doctor 等旧表查询，避免连接超时拖慢接口
    SKIP_LEGACY_QUERIES: bool = True
    
    # Wechat configuration (placeholders for now)
    WECHAT_APPID: str = ""
    WECHAT_SECRET: str = ""
    # 订阅消息跳转环境：developer | trial | formal
    WECHAT_MINIPROGRAM_STATE: str = "developer"

    # WeChat Pay configuration (placeholders)
    WECHAT_PAY_MCH_ID: str = ""
    WECHAT_PAY_KEY: str = ""
    WECHAT_PAY_NOTIFY_URL: str = "https://your-domain.com/api/payment/wechat/callback"

    # Server base URL (used for building absolute file URLs)
    BASE_URL: str = "http://localhost:8000"
    # 通用上传与量表图片使用独立的可持久化目录；留空时使用仓库内开发目录。
    UPLOAD_DIR: str = ""
    ASSESSMENT_ASSET_DIR: str = ""

    # EAP 量表运行时 JSON。留空时使用 backend-python/runtime/assessment-data；
    # 测试/生产环境应通过环境变量指向独立持久化目录。
    ASSESSMENT_DATA_DIR: str = ""
    # 首次初始化时读取的旧 EAP JSON 目录。留空时自动定位仓库内 EAP_front_site/src/data。
    ASSESSMENT_SEED_DATA_DIR: str = ""
    # 专业量表提交时必须声明当前隐私协议版本；协议实质变更时同步提升。
    ASSESSMENT_CONSENT_VERSION: str = "2026-01"
    # EAP 静态分享码独立签名密钥。测试/生产必须配置至少 32 个字符，禁止复用 JWT 密钥。
    ASSESSMENT_SHARE_SECRET: str = ""
    # 扫码成功后跳转到 EAP 量表页；各环境显式配置为对应 EAP 站点根地址。
    ASSESSMENT_FRONTEND_BASE_URL: str = "http://localhost:3000"
    
    # JWT configuration
    # This source-known value is development-only.  Production validation below
    # rejects it and requires a deployment-specific secret.
    JWT_SECRET: str = "development-only-secret-do-not-use-outside-local"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24 * 7

    # 内部消息/提醒定时任务调用密钥；空值表示仅允许已登录后台工作人员。
    MESSAGE_INTERNAL_TOKEN: str = ""

    # Web SMS (官网注册登录)
    SMS_MOCK: bool = True
    SMS_CODE_LENGTH: int = 6
    SMS_CODE_TTL_MINUTES: int = 5
    SMS_RESEND_INTERVAL_SECONDS: int = 1

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_deployed(self) -> bool:
        return self.APP_ENV in {"test", "production"}

    @property
    def dev_login_enabled(self) -> bool:
        return self.APP_ENV != "production" and self.ALLOW_DEV_LOGIN

    @property
    def simulated_payment_enabled(self) -> bool:
        return self.APP_ENV != "production" and self.ALLOW_SIMULATED_PAYMENT

    @property
    def cors_allowed_origins(self) -> list[str]:
        origins: list[str] = []
        for item in self.CORS_ALLOWED_ORIGINS.split(","):
            normalized = item.strip().rstrip("/")
            if normalized and normalized not in origins:
                origins.append(normalized)
        return origins

    def model_post_init(self, _context: object) -> None:
        """Fail fast without letting Pydantic echo secret-bearing inputs."""

        if not self.is_deployed:
            return

        unsafe: list[str] = []
        if self.AUTO_MIGRATE_SCHEMA:
            unsafe.append("AUTO_MIGRATE_SCHEMA must be false")
        if self.is_production:
            if self.ALLOW_DEV_LOGIN:
                unsafe.append("ALLOW_DEV_LOGIN must be false")
            if self.ALLOW_SIMULATED_PAYMENT:
                unsafe.append("ALLOW_SIMULATED_PAYMENT must be false")
            if self.SMS_MOCK:
                unsafe.append("SMS_MOCK must be false")
            if self.ENABLE_API_DOCS:
                unsafe.append("ENABLE_API_DOCS must be false")

        jwt_secret = (self.JWT_SECRET or "").strip()
        if len(jwt_secret) < 32 or jwt_secret in _UNSAFE_JWT_SECRETS:
            unsafe.append(
                "JWT_SECRET must be a deployment-specific secret of at least 32 characters"
            )

        if not (self.DB_USER or "").strip() or not (self.DB_PASSWORD or "").strip():
            unsafe.append("DB_USER and DB_PASSWORD are required")

        origins = self.cors_allowed_origins
        if (
            not origins
            or "*" in origins
            or self.CORS_ALLOWED_ORIGINS == _DEVELOPMENT_CORS_ORIGINS
            or any(not self._is_https_origin(origin) for origin in origins)
        ):
            unsafe.append(
                "CORS_ALLOWED_ORIGINS must contain explicit HTTPS origins"
            )

        for setting_name, value in (
            ("BASE_URL", self.BASE_URL),
            ("ASSESSMENT_FRONTEND_BASE_URL", self.ASSESSMENT_FRONTEND_BASE_URL),
        ):
            if not self._is_https_url(value):
                unsafe.append(f"{setting_name} must be an HTTPS URL")

        share_secret = (self.ASSESSMENT_SHARE_SECRET or "").strip()
        if len(share_secret) < 32:
            unsafe.append("ASSESSMENT_SHARE_SECRET must contain at least 32 characters")
        elif share_secret == jwt_secret:
            unsafe.append("ASSESSMENT_SHARE_SECRET must not reuse JWT_SECRET")

        if unsafe:
            raise RuntimeError(
                "unsafe deployed configuration: " + "; ".join(unsafe)
            )

    @staticmethod
    def _is_https_url(value: str) -> bool:
        try:
            parsed = urllib.parse.urlsplit((value or "").strip())
        except ValueError:
            return False
        return bool(
            parsed.scheme == "https"
            and parsed.hostname
            and not parsed.username
            and not parsed.password
            and not parsed.query
            and not parsed.fragment
        )

    @classmethod
    def _is_https_origin(cls, value: str) -> bool:
        if not cls._is_https_url(value):
            return False
        parsed = urllib.parse.urlsplit(value)
        return parsed.path in {"", "/"}

    @property
    def database_url(self) -> str:
        server = self.DB_SERVER
        if not self.DB_TRUSTED_CONNECTION and self.DB_PORT:
            server = f"{self.DB_SERVER},{self.DB_PORT}"

        conn = (
            f"DRIVER={{{self.DB_DRIVER}}};"
            f"SERVER={server};"
            f"DATABASE={self.DB_NAME};"
        )

        if self.DB_TRUSTED_CONNECTION:
            conn += "Trusted_Connection=yes;"
        else:
            conn += (
                f"UID={self.DB_USER};"
                f"PWD={self.DB_PASSWORD};"
            )

        if self.DB_TRUST_SERVER_CERTIFICATE:
            conn += "TrustServerCertificate=yes;"

        conn += f"Connection Timeout={self.DB_CONNECT_TIMEOUT};"

        params = urllib.parse.quote_plus(conn)
        return f"mssql+pyodbc:///?odbc_connect={params}"

settings = Settings()
