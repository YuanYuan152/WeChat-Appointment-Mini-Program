import { apiRequest } from "@/lib/api";
import type {
  AssessmentEnterprise,
  AssessmentEnterpriseBranding,
  AssessmentEnterpriseHeroSlide,
  CustomEmployeeInfoField,
  EapArticle,
  EapArticleInput,
  EmployeeInfoFieldOption,
  PrivateAssessmentOption,
} from "@/types/api";

const BASE_PATH = "/api/mini/admin/assessment-enterprises";

export function fetchAssessmentEnterprises() {
  return apiRequest<AssessmentEnterprise[]>(BASE_PATH);
}

export function fetchPrivateAssessmentOptions() {
  return apiRequest<PrivateAssessmentOption[]>(`${BASE_PATH}/private-assessments`);
}

export function fetchEmployeeInfoFieldCatalog() {
  return apiRequest<EmployeeInfoFieldOption[]>(`${BASE_PATH}/employee-info-fields`);
}

export function fetchAssessmentEnterpriseDefault() {
  return apiRequest<AssessmentEnterpriseBranding>(`${BASE_PATH}/default`);
}

export function saveAssessmentEnterpriseDefault(input: AssessmentEnterpriseBranding) {
  return apiRequest<AssessmentEnterpriseBranding>(`${BASE_PATH}/default`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function saveAssessmentEnterprise(input: {
  id?: string;
  companyName: string;
  siteName: string;
  logoUrl: string;
  slogan: string;
  url: string;
  assessmentIds: string[];
  assessmentTitles?: Record<string, string>;
  employeeInfoFields?: string[] | null;
  customEmployeeInfoFields?: CustomEmployeeInfoField[];
  heroSlides?: AssessmentEnterpriseHeroSlide[] | null;
  hideConsultation?: boolean;
}) {
  return apiRequest<AssessmentEnterprise>(input.id ? `${BASE_PATH}/${input.id}` : BASE_PATH, {
    method: input.id ? "PUT" : "POST",
    body: JSON.stringify({
      companyName: input.companyName,
      siteName: input.siteName,
      logoUrl: input.logoUrl,
      slogan: input.slogan,
      url: input.url,
      assessmentIds: input.assessmentIds,
      assessmentTitles: input.assessmentTitles || {},
      employeeInfoFields: input.employeeInfoFields ?? null,
      customEmployeeInfoFields: input.customEmployeeInfoFields ?? [],
      heroSlides: input.heroSlides ?? null,
      hideConsultation: Boolean(input.hideConsultation),
    }),
  });
}

export function deleteAssessmentEnterprise(id: string) {
  return apiRequest<{ message: string }>(`${BASE_PATH}/${id}`, { method: "DELETE" });
}

export function generateAssessmentEnterpriseQrCode(id: string) {
  return apiRequest<string>(`${BASE_PATH}/${id}/qrcode`);
}

export function fetchSharedEapArticles() {
  return apiRequest<EapArticle[]>(`${BASE_PATH}/articles`);
}

export function createSharedEapArticle(input: EapArticleInput) {
  return apiRequest<EapArticle>(`${BASE_PATH}/articles`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSharedEapArticle(articleId: string, input: EapArticleInput) {
  return apiRequest<EapArticle>(`${BASE_PATH}/articles/${encodeURIComponent(articleId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteSharedEapArticle(articleId: string) {
  return apiRequest<{ message: string }>(`${BASE_PATH}/articles/${encodeURIComponent(articleId)}`, {
    method: "DELETE",
  });
}

export function fetchEnterpriseEapArticles(enterpriseId: string) {
  return apiRequest<EapArticle[]>(`${BASE_PATH}/${encodeURIComponent(enterpriseId)}/articles`);
}

export function createEnterpriseEapArticle(enterpriseId: string, input: EapArticleInput) {
  return apiRequest<EapArticle>(`${BASE_PATH}/${encodeURIComponent(enterpriseId)}/articles`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateEnterpriseEapArticle(
  enterpriseId: string,
  articleId: string,
  input: EapArticleInput,
) {
  return apiRequest<EapArticle>(
    `${BASE_PATH}/${encodeURIComponent(enterpriseId)}/articles/${encodeURIComponent(articleId)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export function deleteEnterpriseEapArticle(enterpriseId: string, articleId: string) {
  return apiRequest<{ message: string }>(
    `${BASE_PATH}/${encodeURIComponent(enterpriseId)}/articles/${encodeURIComponent(articleId)}`,
    { method: "DELETE" },
  );
}
