import urllib.parse
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

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

    # WeChat Pay configuration (placeholders)
    WECHAT_PAY_MCH_ID: str = ""
    WECHAT_PAY_KEY: str = ""
    WECHAT_PAY_NOTIFY_URL: str = "https://your-domain.com/api/payment/wechat/callback"

    # Server base URL (used for building absolute file URLs)
    BASE_URL: str = "http://localhost:8000"

    # EAP 量表运行时 JSON。留空时使用 backend-python/runtime/assessment-data；
    # 测试/生产环境应通过环境变量指向独立持久化目录。
    ASSESSMENT_DATA_DIR: str = ""
    # 首次初始化时读取的旧 EAP JSON 目录。留空时自动定位仓库内 EAP_front_site/src/data。
    ASSESSMENT_SEED_DATA_DIR: str = ""
    # 专业量表提交时必须声明当前隐私协议版本；协议实质变更时同步提升。
    ASSESSMENT_CONSENT_VERSION: str = "2026-01"
    
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
