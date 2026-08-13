import { RISK_ASSESSMENT_ITEMS, formatRiskChoiceDisplay, normalizeRiskAssessment, normalizeRiskChoice } from "@/constants/caseRecordRiskAssessment";
import { apiFileRequest } from "@/lib/api";
import { imageFromBlob, saveCanvasPdf, type CanvasPdfBlock } from "@/lib/canvas-pdf";
import { formatDateTime } from "@/lib/format";
import type { AdminCaseRecordDetail } from "@/types/api";

const HEADER_LABELS: Record<string, string> = {
  code: "代码",
  gender: "性别",
  consult_method: "咨询方式",
  session_number: "咨询次数",
  start_year: "咨询开始年份",
  start_month: "咨询开始月份",
  start_day: "咨询开始日期",
  start_hour: "咨询开始小时",
  start_minute: "咨询开始分钟",
  end_hour: "咨询结束小时",
  end_minute: "咨询结束分钟",
};

export function formatCaseRecordHeaderInfo(header?: Record<string, unknown> | null): string {
  if (!header) return "暂无表头信息";
  const known = Object.entries(HEADER_LABELS).map(
    ([key, label]) => `${label}：${String(header[key] ?? "").trim() || "-"}`,
  );
  const extra = Object.entries(header)
    .filter(([key]) => !(key in HEADER_LABELS))
    .map(([key, value]) => `${key}：${formatUnknown(value)}`);
  return [...known, ...extra].join("\n");
}

export function buildCaseRecordPdfBlocks(
  record: AdminCaseRecordDetail,
  photos: Array<{ image?: CanvasImageSource & { width: number; height: number }; error?: string }> = [],
): CanvasPdfBlock[] {
  const risk = record.RiskAssessment ? normalizeRiskAssessment(record.RiskAssessment) : null;
  const blocks: CanvasPdfBlock[] = [
    { type: "text", text: "心理咨询个案记录表", fontSize: 44, bold: true, gapAfter: 22 },
    {
      type: "text",
      text: [
        `来访者：${record.PatientName || "-"}`,
        `咨询师：${record.CounselorName || "-"}`,
        `咨询时间：${formatDateTime(record.StartTime)} 至 ${formatDateTime(record.EndTime)}`,
        `记录编号：${record.Id}　预约编号：${record.ConsultationId}`,
        `创建时间：${formatDateTime(record.CreatedAt)}　更新时间：${formatDateTime(record.UpdatedAt)}`,
      ].join("\n"),
      fontSize: 25,
      gapAfter: 24,
    },
    section("表头信息", formatCaseRecordHeaderInfo(record.HeaderInfo)),
    section("S｜患者情况记录（主观陈述）", record.Subjective),
    section("O｜客观观察", record.Objective),
    section("A｜评估分析", record.Assessment),
    section("P｜计划方向", record.Plan),
    { type: "text", text: "完整风险/危机评估", fontSize: 32, bold: true, gapBefore: 12, gapAfter: 12 },
  ];
  if (!risk) {
    blocks.push({ type: "text", text: "暂无风险评估", fontSize: 25, gapAfter: 22 });
  } else {
    for (const item of RISK_ASSESSMENT_ITEMS) {
      const entry = risk.items[item.id];
      blocks.push({
        type: "text",
        text: `${item.index}. ${item.label}\n${formatRiskChoiceDisplay(item.id, normalizeRiskChoice(entry?.choice, item.id), entry?.note)}`,
        fontSize: 25,
        gapAfter: 10,
      });
    }
  }
  blocks.push({ type: "text", text: "相关照片", fontSize: 32, bold: true, gapBefore: 12, gapAfter: 10 });
  if (record.PhotoUrls.length === 0) {
    blocks.push({ type: "text", text: "无照片", fontSize: 25 });
  } else {
    record.PhotoUrls.forEach((_, index) => {
      const photo = photos[index];
      if (photo?.image) {
        blocks.push({
          type: "image",
          image: photo.image,
          width: photo.image.width,
          height: photo.image.height,
          caption: `咨询记录照片 ${index + 1}`,
        });
      } else {
        blocks.push({
          type: "text",
          text: `咨询记录照片 ${index + 1} 加载失败${photo?.error ? `：${photo.error}` : ""}`,
          fontSize: 24,
          color: "#a33b32",
          gapAfter: 10,
        });
      }
    });
  }
  return blocks;
}

export async function downloadCaseRecordPdf(record: AdminCaseRecordDetail): Promise<void> {
  const photos = await Promise.all(
    record.PhotoUrls.map(async (url) => {
      try {
        const blob = await downloadPhoto(url);
        return { image: await imageFromBlob(blob) };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "未知错误" };
      }
    }),
  );
  await saveCanvasPdf({
    filename: `${record.PatientName || "来访者"}-咨询记录-${record.Id}`,
    pageTitle: "心理咨询个案记录表",
    blocks: buildCaseRecordPdfBlocks(record, photos),
  });
}

function section(title: string, value?: string | null): CanvasPdfBlock {
  return {
    type: "text",
    text: `${title}\n${value?.trim() || "-"}`,
    fontSize: 25,
    bold: false,
    gapBefore: 12,
    gapAfter: 18,
  };
}

function formatUnknown(value: unknown): string {
  if (value == null || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function downloadPhoto(url: string): Promise<Blob> {
  const value = url.trim();
  if (!value) throw new Error("地址为空");
  if (!/^https?:/i.test(value)) return (await apiFileRequest(value.startsWith("/") ? value : `/${value}`)).blob;
  const response = await fetch(value);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}
