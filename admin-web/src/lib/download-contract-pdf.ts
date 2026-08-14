import type { PatientContractArtifact } from "@/types/api";
import {
  agreementTitleByFlag,
  buildTongxinConsultationAgreement,
  buildYangfanConsultationAgreement,
} from "@/lib/consultationAgreement";
import { imageFromBlob, saveCanvasPdf, type CanvasPdfBlock } from "@/lib/canvas-pdf";

export function buildContractPdfBlocks(
  artifact: PatientContractArtifact,
  signature?: CanvasImageSource & { width: number; height: number },
): CanvasPdfBlock[] {
  const title = agreementTitleByFlag(artifact.isTongxin);
  const agreement = artifact.isTongxin
    ? buildTongxinConsultationAgreement(
        artifact.counselorName,
        artifact.billingYuan,
        artifact.emergencyContact,
        artifact.patientName,
      )
    : buildYangfanConsultationAgreement(
        artifact.counselorName,
        artifact.billingYuan,
        artifact.emergencyContact,
        artifact.patientName,
      );
  const metadata = [
    `协议类型：${artifact.agreementTypeLabel || title}`,
    `来访者：${artifact.patientName || "-"}`,
    `咨询师：${artifact.counselorName || "-"}`,
    `订单号：${artifact.orderId}`,
    `签署时间：${artifact.signedAt || "-"}`,
    `咨询费用：${artifact.billingYuan} 元`,
  ].join("\n");
  const blocks: CanvasPdfBlock[] = [
    { type: "text", text: title, fontSize: 46, bold: true, gapAfter: 24 },
    {
      type: "text",
      text: "文件说明：本文件根据来访者签署时适用的当前协议模板、签约材料元数据及手写签名生成。",
      fontSize: 24,
      color: "#756d64",
      gapAfter: 24,
    },
    { type: "text", text: "签约信息", fontSize: 32, bold: true, gapAfter: 12 },
    { type: "text", text: metadata, fontSize: 26, gapAfter: 28 },
    { type: "text", text: "协议正文", fontSize: 32, bold: true, gapAfter: 14 },
    { type: "text", text: agreement, fontSize: 25, gapAfter: 28 },
    { type: "text", text: "来访者手写签名", fontSize: 32, bold: true, gapAfter: 10 },
  ];
  if (signature) {
    blocks.push({
      type: "image",
      image: signature,
      width: signature.width,
      height: signature.height,
      caption: `签署人：${artifact.patientName || "-"}`,
    });
  } else {
    blocks.push({ type: "text", text: "签名图片未能载入", fontSize: 25, color: "#a33b32" });
  }
  return blocks;
}

export async function downloadContractPdf(
  artifact: PatientContractArtifact,
  signatureBlob: Blob,
): Promise<void> {
  const signature = await imageFromBlob(signatureBlob);
  await saveCanvasPdf({
    filename: `${artifact.patientName || "来访者"}-${agreementTitleByFlag(artifact.isTongxin)}`,
    pageTitle: agreementTitleByFlag(artifact.isTongxin),
    blocks: buildContractPdfBlocks(artifact, signature),
  });
}
