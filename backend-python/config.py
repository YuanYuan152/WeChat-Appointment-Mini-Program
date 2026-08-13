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


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Runtime mode and deployment switches.
    APP_ENV: Literal["development", "test", "production"] = "development"
    APP_VERSION: str = "2.0"
    ALLOW_DEV_LOGIN: bool = True
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
    DB_PASSWORD: str = "Aa1!StrongPwd2026"
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

    # WeChat Pay —— 真实值只写在 .env / .env.production，此处默认全部为空
    WECHAT_PAY_MCH_ID: str = ""
    WECHAT_PAY_KEY: str = ""  # 旧 V2 API 密钥，V3 不使用
    WECHAT_PAY_API_V3_KEY: str = ""
    WECHAT_PAY_MCH_CERT_SERIAL: str = ""
    WECHAT_PAY_MCH_PRIVATE_KEY_PATH: str = ""
    WECHAT_PAY_PUBLIC_KEY_ID: str = ""
    WECHAT_PAY_PUBLIC_KEY_PATH: str = ""
    WECHAT_PAY_NOTIFY_URL: str = ""
    WECHAT_PAY_REFUND_NOTIFY_URL: str = ""
    # true：即使已配置真实商户密钥/证书，也强制走本地模拟支付（不调微信下单）
    WECHAT_PAY_FORCE_SIMULATE: bool = False

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
    JWT_SECRET: str = "your-super-secret-key-change-it-in-production"
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
    def dev_login_enabled(self) -> bool:
        return self.APP_ENV != "production" and self.ALLOW_DEV_LOGIN

    @property
    def cors_allowed_origins(self) -> list[str]:
        origins: list[str] = []
        for item in self.CORS_ALLOWED_ORIGINS.split(","):
            normalized = item.strip().rstrip("/")
            if normalized and normalized not in origins:
                origins.append(normalized)
        return origins

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
