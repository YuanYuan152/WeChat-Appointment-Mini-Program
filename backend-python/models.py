"""
SQLAlchemy ORM 模型。

约定：
- ASCII / 内部代码（OpenId / UnionId / Mobile / Status / Type / URL / IP / UA …）使用 String，
  在 SQL Server 上即 VARCHAR，节省空间。
- 任何会出现中文 / 用户输入的展示字段使用 Unicode / UnicodeText，在 SQL Server 上即 NVARCHAR / NVARCHAR(MAX)，
  避免出现 "???" 乱码。
"""

from sqlalchemy import Column, Integer, String, DateTime, BigInteger, Boolean, Unicode, UnicodeText, UniqueConstraint
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
    IntakeAgreementSignedAt = Column(DateTime, nullable=True)
    IntakeIsAdult = Column(Boolean, nullable=True)
    IntakeSignatureUrl = Column(String(500), nullable=True)
    PasswordHash = Column(String(255), nullable=True)
    PreferenceTagsCompletedAt = Column(DateTime, nullable=True)
    PatientSource = Column(String(50), nullable=True)
    AccessRevokedAt = Column(DateTime, nullable=True)
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
    IntakeIsAdult = Column(Boolean, nullable=True)
    IntakeSignatureUrl = Column(String(500), nullable=True)
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
    RiskAssessment = Column(UnicodeText, nullable=True)
    HeaderInfo = Column(UnicodeText, nullable=True)
    PhotoUrls = Column(UnicodeText, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppCaseRecordRevision(Base):
    """咨询记录每次修改前的版本快照。"""
    __tablename__ = "AppCaseRecordRevision"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    CaseRecordId = Column(Integer, nullable=False, index=True)
    ConsultationId = Column(Integer, nullable=False)
    CounselorId = Column(Integer, nullable=False)
    Subjective = Column(UnicodeText, nullable=True)
    Objective = Column(UnicodeText, nullable=True)
    Assessment = Column(UnicodeText, nullable=True)
    Plan = Column(UnicodeText, nullable=True)
    RiskAssessment = Column(UnicodeText, nullable=True)
    HeaderInfo = Column(UnicodeText, nullable=True)
    PhotoUrls = Column(UnicodeText, nullable=True)
    RevisedAt = Column(DateTime, default=func.now(), nullable=False)
    RevisedBy = Column(Integer, nullable=False)


class AppCaseRecordAmendmentRequest(Base):
    """咨询师提交的咨询记录修改申请，需管理员审核后生效。"""
    __tablename__ = "AppCaseRecordAmendmentRequest"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    CaseRecordId = Column(Integer, nullable=False, index=True)
    ConsultationId = Column(Integer, nullable=False)
    CounselorId = Column(Integer, nullable=False)
    Subjective = Column(UnicodeText, nullable=False)
    Objective = Column(UnicodeText, nullable=False)
    Assessment = Column(UnicodeText, nullable=False)
    Plan = Column(UnicodeText, nullable=False)
    RiskAssessment = Column(UnicodeText, nullable=True)
    HeaderInfo = Column(UnicodeText, nullable=True)
    PhotoUrls = Column(UnicodeText, nullable=True)
    Reason = Column(UnicodeText, nullable=True)
    Status = Column(String(20), nullable=False, default="PENDING")
    RejectReason = Column(UnicodeText, nullable=True)
    ReviewedBy = Column(Integer, nullable=True)
    ReviewedAt = Column(DateTime, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)


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
    TargetGroup = Column(Unicode(500), nullable=True)
    Mode = Column(Unicode(100), nullable=True)
    Billing = Column(Integer, nullable=False, default=60000)
    FaceBilling = Column(Integer, nullable=False, default=30000)
    ConsultHours = Column(Integer, nullable=False, default=0)
    WorkYears = Column(Integer, nullable=False, default=0)
    InfoAuthenticityCommittedAt = Column(DateTime, nullable=True)
    InfoAuthenticitySignerName = Column(Unicode(100), nullable=True)
    CounselorType = Column(String(50), nullable=True)
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
    """咨询师取消已预约排期（距开始≥24h）时留存沟通截图凭证。"""
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
    RejectReason = Column(UnicodeText, nullable=True)
    ReviewedBy = Column(Integer, nullable=True)
    ReviewedAt = Column(DateTime, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime, nullable=True, onupdate=func.now())


class AppConsultationFeedback(Base):
    """来访者对已完成咨询的反馈。"""
    __tablename__ = "AppConsultationFeedback"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ConsultationId = Column(Integer, nullable=False, unique=True, index=True)
    AccountId = Column(Integer, nullable=False, index=True)
    Content = Column(UnicodeText, nullable=False)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)


class AppPsychScaleResult(Base):
    """来访者心理量表测评记录。"""
    __tablename__ = "AppPsychScaleResult"

    Id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False, index=True)
    ScaleType = Column(String(20), nullable=False, index=True)
    Answers = Column(UnicodeText, nullable=False)
    Total = Column(Integer, nullable=False)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)


class AppFeedback(Base):
    __tablename__ = "AppFeedback"

    Id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False)
    Category = Column(String(50), nullable=True)
    Content = Column(UnicodeText, nullable=False)
    Contact = Column(String(50), nullable=True)
    Status = Column(String(20), nullable=False, default="OPEN")
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)


class AppCounselorFavorite(Base):
    """来访者收藏的咨询师。"""
    __tablename__ = "AppCounselorFavorite"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False, index=True)
    CounselorId = Column(Integer, nullable=False, index=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("AccountId", "CounselorId", name="UQ_AppCounselorFavorite_Account_Counselor"),
    )


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


class AppConsultationRoomSlot(Base):
    """咨询室单时段管理状态（覆盖默认状态）。"""
    __tablename__ = "AppConsultationRoomSlot"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    RoomId = Column(Integer, nullable=False, index=True)
    StartTime = Column(DateTime, nullable=False)
    Status = Column(String(20), nullable=False, default="AVAILABLE")
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


class AppSmsVerification(Base):
    """官网/Web 端短信验证码（与小程序微信手机号绑定并存）。"""
    __tablename__ = "AppSmsVerification"

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    Mobile = Column(String(20), nullable=False, index=True)
    Code = Column(String(10), nullable=False)
    Purpose = Column(String(20), nullable=False, default="login")
    ExpiresAt = Column(DateTime, nullable=False)
    UsedAt = Column(DateTime, nullable=True)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)


class AppUserPreferenceTag(Base):
    """用户自选偏好标签（个人人群 / 感兴趣的心理问题）。"""
    __tablename__ = "AppUserPreferenceTag"
    __table_args__ = (
        UniqueConstraint("AccountId", "Category", "Tag", name="UQ_AppUserPreferenceTag_Account_Category_Tag"),
    )

    Id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AccountId = Column(Integer, nullable=False, index=True)
    Category = Column(String(20), nullable=False)  # personal | interest
    Tag = Column(Unicode(50), nullable=False)
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
