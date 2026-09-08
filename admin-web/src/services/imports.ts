import { apiFileRequest, apiRequest } from "@/lib/api";
import type {
  CompletedOrderImportResult,
  CounselorIntroExportCandidate,
  DataTransferImportResult,
  DataTransferKind,
} from "@/types/api";

export function importCompletedOrders(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<CompletedOrderImportResult>("/api/web/admin/data-import/completed-orders", {
    method: "POST",
    body: formData,
  });
}

function dataTransferPath(kind: DataTransferKind, action: "template" | "import" | "export") {
  return `/api/web/admin/data-transfer/${kind}/${action}`;
}

export function downloadDataTransferTemplate(kind: DataTransferKind) {
  return apiFileRequest(dataTransferPath(kind, "template"));
}

export function importDataTransfer(kind: DataTransferKind, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<DataTransferImportResult>(dataTransferPath(kind, "import"), {
    method: "POST",
    body: formData,
  });
}

export function fetchCounselorIntroExportCandidates(keyword = "") {
  const query = keyword.trim()
    ? `?${new URLSearchParams({ keyword: keyword.trim() }).toString()}`
    : "";
  return apiRequest<{ items: CounselorIntroExportCandidate[] }>(
    `/api/web/admin/data-transfer/counselor_intros/candidates${query}`,
  );
}

export function exportDataTransfer(
  kind: DataTransferKind,
  options?: {
    startDate?: string;
    endDate?: string;
    counselorIds?: number[];
  },
) {
  const params = new URLSearchParams();
  if (kind === "orders" && options?.startDate && options?.endDate) {
    params.set("startDate", options.startDate);
    params.set("endDate", options.endDate);
  }
  if (kind === "counselor_intros") {
    for (const id of options?.counselorIds || []) {
      params.append("counselorIds", String(id));
    }
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFileRequest(`${dataTransferPath(kind, "export")}${query}`);
}
