const PROFESSIONAL_PRIVACY_KEY = "assessment-professional-privacy-accepted";
export const ASSESSMENT_PRIVACY_VERSION = "2026-01";

export const privacyAgreementSections = [
  {
    title: "一、信息收集与使用",
    content:
      "专业心理测评可能收集您的答题结果及相关自评信息，用于生成测评报告与心理健康参考分析。相关信息仅用于测评服务本身，不会用于与测评无关的商业用途。",
  },
  {
    title: "二、测评结果说明",
    content:
      "专业测评结果仅供参考，不能替代专业医学诊断或心理咨询。若测评结果显示您可能存在心理困扰，建议寻求持证心理咨询师或医疗机构的专业帮助。",
  },
  {
    title: "三、信息保护与保密",
    content:
      "我们采用合理的技术与管理措施保护您的测评数据安全，防止未经授权的访问、泄露或篡改。您的答题记录将在实现服务目的所需的期限内保存，之后依法删除或匿名化处理。",
  },
  {
    title: "四、数据存储与访问",
    content:
      "测评过程中的未完成答题进度会保存在您的浏览器本地，以便关闭页面后继续作答；提交后的正式答案、人口学信息和报告会同步到您的平台账号。经授权的咨询助理、运营人员和管理员可按工作职责查看报告，其中原始答案和人口学信息仅限运营及管理员访问。我们不会将测评数据共享给无关第三方。",
  },
  {
    title: "五、您的权利",
    content:
      "您有权了解、更正或删除您的个人信息，也有权撤回授权同意。如需行使上述权利，请通过本平台公布的联系方式与我们取得联系。",
  },
  {
    title: "六、未成年人保护",
    content:
      "若您为未成年人，请在监护人知情并同意的前提下参与专业测评。我们将按照相关法律法规要求，采取额外措施保护未成年人的个人信息安全。",
  },
  {
    title: "七、协议更新",
    content:
      "我们可能适时更新本隐私保护协议。更新后的协议将在平台公布，继续使用专业测评服务即视为您已阅读并同意更新后的协议内容。",
  },
];

export const privacyAgreementIntro =
  "欢迎使用连心心理专业测评服务。在您开始专业量表测评前，请仔细阅读以下《隐私保护协议》。我们重视您的隐私，并提醒您测评结果仅供参考。";

/** 专业测评隐私协议：全站只需同意一次（localStorage 持久化） */
export function isProfessionalAssessmentPrivacyAccepted(
  _assessmentId?: string
): boolean {
  void _assessmentId;
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(PROFESSIONAL_PRIVACY_KEY);
    if (!raw) return false;
    const accepted = JSON.parse(raw) as { version?: string; acceptedAt?: string };
    return (
      accepted.version === ASSESSMENT_PRIVACY_VERSION &&
      typeof accepted.acceptedAt === "string"
    );
  } catch {
    return false;
  }
}

export function acceptProfessionalAssessmentPrivacy(
  _assessmentId?: string
): void {
  void _assessmentId;
  localStorage.setItem(
    PROFESSIONAL_PRIVACY_KEY,
    JSON.stringify({
      version: ASSESSMENT_PRIVACY_VERSION,
      acceptedAt: new Date().toISOString(),
    })
  );
}
