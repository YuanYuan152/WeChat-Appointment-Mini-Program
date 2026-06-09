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
    
    # Wechat configuration (placeholders for now)
    WECHAT_APPID: str = ""
    WECHAT_SECRET: str = ""

    # WeChat Pay configuration (placeholders)
    WECHAT_PAY_MCH_ID: str = ""
    WECHAT_PAY_KEY: str = ""
    WECHAT_PAY_NOTIFY_URL: str = "https://your-domain.com/api/payment/wechat/callback"

    # Server base URL (used for building absolute file URLs)
    BASE_URL: str = "http://localhost:8000"
    
    # JWT configuration
    JWT_SECRET: str = "your-super-secret-key-change-it-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24 * 7

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

        params = urllib.parse.quote_plus(conn)
        return f"mssql+pyodbc:///?odbc_connect={params}"

settings = Settings()
