"""
SQLAlchemy ORM 模型。

约定：
- ASCII / 内部代码（OpenId / UnionId / Mobile / Status / Type / URL / IP / UA …）使用 String，
  在 SQL Server 上即 VARCHAR，节省空间。
- 任何会出现中文 / 用户输入的展示字段使用 Unicode / UnicodeText，在 SQL Server 上即 NVARCHAR / NVARCHAR(MAX)，
  避免出现 "???" 乱码。
"""

from sqlalchemy import Column, Integer, String, DateTime, BigInteger, Boolean, Unicode, UnicodeText
from sqlalchemy.sql import func
from database import Base


class AppAccount(Base):
    __tablename__ = "AppAccount"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    UnionId = Column(String(100), nullable=True)
    OpenId = Column(String(100), nullable=True)
    Mobile = Column(String(20), nullable=True)
    Nickname = Column(Unicode(100), nullable=True)
    AvatarUrl = Column(String(500), nullable=True)
    ActiveRole = Column(String(20), nullable=True)
    RealName = Column(Unicode(50), nullable=True)
    Gender = Column(String(10), nullable=True)
    Birthday = Column(DateTime, nullable=True)
    EmergencyContact = Column(Unicode(100), nullable=True)
    EmergencyPhone = Column(String(20), nullable=True)
    IsActive = Column(Boolean, nullable=False, default=True, server_default="1")
    DeletedAt = Column(DateTime, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppRoleBinding(Base):
    __tablename__ = "AppRoleBinding"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    RoleType = Column(String(50), nullable=False)
    TargetId = Column(Integer, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)


class AppOrder(Base):
    __tablename__ = "AppOrder"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    SlotId = Column(Integer, nullable=True)
    OutTradeNo = Column(String(64), nullable=False, unique=True)
    TransactionId = Column(String(64), nullable=True)
    TotalFee = Column(Integer, nullable=False)
    Status = Column(String(20), nullable=False, default="PENDING")
    Description = Column(Unicode(200), nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    PaidAt = Column(DateTime, nullable=True)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppSchedule(Base):
    __tablename__ = "AppSchedule"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    CounselorId = Column(Integer, nullable=False)
    StartTime = Column(DateTime, nullable=False)
    EndTime = Column(DateTime, nullable=False)
    Status = Column(String(20), nullable=False, default="AVAILABLE")
    Note = Column(Unicode(200), nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppConsultation(Base):
    __tablename__ = "AppConsultation"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    OrderId = Column(Integer, nullable=True)
    PatientId = Column(Integer, nullable=False)
    CounselorId = Column(Integer, nullable=False)
    ScheduleId = Column(Integer, nullable=True)
    Status = Column(String(20), nullable=False, default="PENDING")
    StartTime = Column(DateTime, nullable=True)
    EndTime = Column(DateTime, nullable=True)
    Note = Column(Unicode(500), nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppCaseRecord(Base):
    __tablename__ = "AppCaseRecord"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ConsultationId = Column(Integer, nullable=False)
    CounselorId = Column(Integer, nullable=False)
    Subjective = Column(UnicodeText, nullable=True)
    Objective = Column(UnicodeText, nullable=True)
    Assessment = Column(UnicodeText, nullable=True)
    Plan = Column(UnicodeText, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppTask(Base):
    __tablename__ = "AppTask"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AssistantId = Column(Integer, nullable=False)
    Type = Column(String(50), nullable=False)
    Title = Column(Unicode(200), nullable=False)
    Content = Column(UnicodeText, nullable=True)
    RelatedId = Column(Integer, nullable=True)
    Priority = Column(String(20), nullable=False, default="NORMAL")
    Status = Column(String(20), nullable=False, default="OPEN")
    DueAt = Column(DateTime, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppRiskAlert(Base):
    __tablename__ = "AppRiskAlert"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    PatientId = Column(Integer, nullable=False)
    AssistantId = Column(Integer, nullable=False)
    Level = Column(String(20), nullable=False, default="MEDIUM")
    Description = Column(UnicodeText, nullable=True)
    Status = Column(String(20), nullable=False, default="OPEN")
    HandledAt = Column(DateTime, nullable=True)
    HandlerNote = Column(Unicode(500), nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppBanner(Base):
    __tablename__ = "AppBanner"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    Title = Column(Unicode(200), nullable=False)
    ImageUrl = Column(String(500), nullable=False)
    LinkType = Column(String(50), nullable=False, default="PAGE")
    LinkValue = Column(String(500), nullable=True)
    SortOrder = Column(Integer, nullable=False, default=0)
    IsActive = Column(Boolean, nullable=False, default=True)
    StartAt = Column(DateTime, nullable=True)
    EndAt = Column(DateTime, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppActivity(Base):
    __tablename__ = "AppActivity"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    Type = Column(String(50), nullable=False, default="NOTICE")
    Title = Column(Unicode(200), nullable=False)
    Content = Column(UnicodeText, nullable=True)
    CoverUrl = Column(String(500), nullable=True)
    IsActive = Column(Boolean, nullable=False, default=True)
    StartAt = Column(DateTime, nullable=True)
    EndAt = Column(DateTime, nullable=True)
    SortOrder = Column(Integer, nullable=False, default=0)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppRoleSwitchLog(Base):
    __tablename__ = "AppRoleSwitchLog"

    Id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    FromRole = Column(String(20), nullable=True)
    ToRole = Column(String(20), nullable=False)
    SwitchedAt = Column(DateTime, default=func.now(), nullable=False)
    Ip = Column(String(50), nullable=True)
    UserAgent = Column(String(200), nullable=True)


class AppArticle(Base):
    __tablename__ = "AppArticle"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    Title = Column(Unicode(200), nullable=False)
    Category = Column(Unicode(50), nullable=True)
    Summary = Column(Unicode(500), nullable=True)
    Content = Column(UnicodeText, nullable=True)
    CoverUrl = Column(String(500), nullable=True)
    Author = Column(Unicode(100), nullable=True)
    Source = Column(Unicode(100), nullable=True)
    IsTop = Column(Boolean, nullable=False, default=False)
    IsActive = Column(Boolean, nullable=False, default=True)
    Views = Column(Integer, nullable=False, default=0)
    SortOrder = Column(Integer, nullable=False, default=0)
    PublishedAt = Column(DateTime, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppMessage(Base):
    __tablename__ = "AppMessage"

    Id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    Type = Column(String(50), nullable=False)
    Title = Column(Unicode(200), nullable=False)
    Content = Column(UnicodeText, nullable=True)
    RelatedType = Column(String(50), nullable=True)
    RelatedId = Column(Integer, nullable=True)
    IsRead = Column(Boolean, nullable=False, default=False)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    ReadAt = Column(DateTime, nullable=True)


class AppSubscribeTemplate(Base):
    __tablename__ = "AppSubscribeTemplate"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    EventKey = Column(String(80), nullable=False)
    TemplateId = Column(String(120), nullable=False)
    Description = Column(Unicode(200), nullable=True)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppMessageLog(Base):
    __tablename__ = "AppMessageLog"

    Id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    EventKey = Column(String(80), nullable=False)
    TemplateId = Column(String(120), nullable=True)
    Payload = Column(UnicodeText, nullable=True)
    Status = Column(String(20), nullable=False, default="PENDING")
    ErrorMessage = Column(Unicode(500), nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    SentAt = Column(DateTime, nullable=True)


class AppRemindTask(Base):
    __tablename__ = "AppRemindTask"

    Id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    EventKey = Column(String(80), nullable=False)
    Title = Column(Unicode(200), nullable=False)
    Content = Column(UnicodeText, nullable=True)
    RelatedType = Column(String(50), nullable=True)
    RelatedId = Column(Integer, nullable=True)
    ScheduledAt = Column(DateTime, nullable=False)
    Status = Column(String(20), nullable=False, default="PENDING")
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    ProcessedAt = Column(DateTime, nullable=True)
    ErrorMessage = Column(Unicode(500), nullable=True)


class AppRegistrationForm(Base):
    __tablename__ = "AppRegistrationForm"

    Id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    RealName = Column(Unicode(50), nullable=True)
    Gender = Column(String(10), nullable=True)
    Birthday = Column(DateTime, nullable=True)
    Occupation = Column(Unicode(100), nullable=True)
    Education = Column(Unicode(100), nullable=True)
    MaritalStatus = Column(Unicode(50), nullable=True)
    Phone = Column(String(20), nullable=True)
    EmergencyContact = Column(Unicode(100), nullable=True)
    EmergencyPhone = Column(String(20), nullable=True)
    ChiefComplaint = Column(UnicodeText, nullable=True)

    Phq1 = Column(Integer, nullable=True)
    Phq2 = Column(Integer, nullable=True)
    Phq3 = Column(Integer, nullable=True)
    Phq4 = Column(Integer, nullable=True)
    Phq5 = Column(Integer, nullable=True)
    Phq6 = Column(Integer, nullable=True)
    Phq7 = Column(Integer, nullable=True)
    Phq8 = Column(Integer, nullable=True)
    Phq9 = Column(Integer, nullable=True)
    PhqTotal = Column(Integer, nullable=True)

    Gad1 = Column(Integer, nullable=True)
    Gad2 = Column(Integer, nullable=True)
    Gad3 = Column(Integer, nullable=True)
    Gad4 = Column(Integer, nullable=True)
    Gad5 = Column(Integer, nullable=True)
    Gad6 = Column(Integer, nullable=True)
    Gad7 = Column(Integer, nullable=True)
    GadTotal = Column(Integer, nullable=True)

    PastDiagnosis = Column(UnicodeText, nullable=True)
    TreatmentHistory = Column(UnicodeText, nullable=True)
    MedicationHistory = Column(UnicodeText, nullable=True)
    FamilyMentalHistory = Column(UnicodeText, nullable=True)
    FamilyRelationship = Column(UnicodeText, nullable=True)
    SleepStatus = Column(Unicode(200), nullable=True)
    AppetiteStatus = Column(Unicode(200), nullable=True)
    SubstanceUse = Column(UnicodeText, nullable=True)
    SelfHarmRisk = Column(UnicodeText, nullable=True)
    ConsultationGoal = Column(UnicodeText, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppCounselorProfile(Base):
    __tablename__ = "AppCounselorProfile"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    Name = Column(Unicode(100), nullable=True)
    AvatarUrl = Column(String(500), nullable=True)
    Title = Column(Unicode(100), nullable=True)
    Specialty = Column(UnicodeText, nullable=True)
    Field = Column(Unicode(200), nullable=True)
    Introduce = Column(UnicodeText, nullable=True)
    Career = Column(UnicodeText, nullable=True)
    Qualification = Column(UnicodeText, nullable=True)
    Billing = Column(Integer, nullable=False, default=0)
    ConsultHours = Column(Integer, nullable=False, default=0)
    WorkYears = Column(Integer, nullable=False, default=0)
    IsActive = Column(Boolean, nullable=False, default=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppContactRecord(Base):
    __tablename__ = "AppContactRecord"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AssistantId = Column(Integer, nullable=False)
    PatientId = Column(Integer, nullable=False)
    ContactMethod = Column(String(50), nullable=False, default="PHONE")
    Content = Column(UnicodeText, nullable=True)
    NextFollowAt = Column(DateTime, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppLeaveRequest(Base):
    __tablename__ = "AppLeaveRequest"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ScheduleId = Column(Integer, nullable=False)
    CounselorId = Column(Integer, nullable=False)
    Reason = Column(UnicodeText, nullable=False)
    Status = Column(String(20), nullable=False, default="PENDING")
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppScheduleCancelLog(Base):
    """咨询师取消已预约挂课（距开始≥24h）时留存沟通截图凭证。"""
    __tablename__ = "AppScheduleCancelLog"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ScheduleId = Column(Integer, nullable=False)
    CounselorId = Column(Integer, nullable=False)
    ConsultationId = Column(Integer, nullable=True)
    ScreenshotUrl = Column(Unicode(500), nullable=False)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)


class AppRefundExemption(Base):
    __tablename__ = "AppRefundExemption"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ConsultationId = Column(Integer, nullable=False)
    AccountId = Column(Integer, nullable=False)
    Amount = Column(Integer, nullable=False)
    Reason = Column(UnicodeText, nullable=False)
    ScreenshotUrl = Column(Unicode(500), nullable=True)
    Status = Column(String(20), nullable=False, default="PENDING")
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppFeedback(Base):
    __tablename__ = "AppFeedback"

    Id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    Category = Column(String(50), nullable=True)
    Content = Column(UnicodeText, nullable=False)
    Contact = Column(String(50), nullable=True)
    Status = Column(String(20), nullable=False, default="OPEN")
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)


class AppConsultationRoom(Base):
    """咨询室配置（管理员可增删改状态）。"""
    __tablename__ = "AppConsultationRoom"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    CenterId = Column(String(50), nullable=False)
    RoomCode = Column(String(50), nullable=False)
    Name = Column(Unicode(100), nullable=False)
    Status = Column(String(20), nullable=False, default="AVAILABLE")
    SortOrder = Column(Integer, nullable=False, default=0)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppLoginSession(Base):
    __tablename__ = "AppLoginSession"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    Token = Column(String(500), nullable=False)
    SessionKey = Column(String(100), nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    ExpiresAt = Column(DateTime, nullable=False)
