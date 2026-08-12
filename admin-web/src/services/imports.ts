import { apiFileRequest, apiRequest } from "@/lib/api";
import type {
  CompletedOrderImportResult,
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

export function exportDataTransfer(
  kind: DataTransferKind,
  dateRange?: { startDate: string; endDate: string },
) {
  const query =
    kind === "orders" && dateRange
      ? `?${new URLSearchParams({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }).toString()}`
      : "";
  return apiFileRequest(`${dataTransferPath(kind, "export")}${query}`);
}
