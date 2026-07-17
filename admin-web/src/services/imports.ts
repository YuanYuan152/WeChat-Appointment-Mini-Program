import { apiRequest } from "@/lib/api";
import type { CompletedOrderImportResult } from "@/types/api";

export function importCompletedOrders(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<CompletedOrderImportResult>("/api/web/admin/data-import/completed-orders", {
    method: "POST",
    body: formData,
  });
}
