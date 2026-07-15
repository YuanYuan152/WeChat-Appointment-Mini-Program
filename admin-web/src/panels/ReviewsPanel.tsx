import { useMemo, useState } from "react";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import {
  Badge,
  EmptyState,
  Pagination,
  PanelHeader,
  TableActionButton,
} from "@/components/ui";
import { API_BASE_URL } from "@/lib/api";
import { formatFullDateTime, formatMoneyFromCents } from "@/lib/format";
import { formatPatientNameWithContractTag } from "@/lib/patientContract";
import type { AdminLeaveRequestDetail, RefundExemption } from "@/types/api";
import type { ReviewStatus } from "@/services/reviews";

export type ReviewCategory = "ALL" | "EXEMPTION" | "LEAVE";

export type ReviewItem =
  | { kind: "EXEMPTION"; id: number; data: RefundExemption }
  | { kind: "LEAVE"; id: number; data: AdminLeaveRequestDetail };

const categories: Array<{ value: ReviewCategory; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "EXEMPTION", label: "用户豁免" },
  { value: "LEAVE", label: "请假审核" },
];

const statuses: Array<{ value: ReviewStatus; label: string }> = [
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已拒绝" },
  { value: "ALL", label: "全部" },
];

export function ReviewsPanel({
  items,
  category,
  status,
  page,
  pageSize,
  listLoading,
  processing,
  selectedItem,
  onCategoryChange,
  onStatusChange,
  onPageChange,
  onPageSizeChange,
  onOpen,
  onClose,
  onApprove,
  onRejectExemption,
  onRejectLeave,
}: {
  items: ReviewItem[];
  category: ReviewCategory;
  status: ReviewStatus;
  page: number;
  pageSize: number;
  listLoading: boolean;
  processing: boolean;
  selectedItem: ReviewItem | null;
  onCategoryChange: (category: ReviewCategory) => void;
  onStatusChange: (status: ReviewStatus) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (item: ReviewItem) => void;
  onClose: () => void;
  onApprove: (item: ReviewItem) => void;
  onRejectExemption: (item: Extract<ReviewItem, { kind: "EXEMPTION" }>, reason: string) => void;
  onRejectLeave: (item: Extract<ReviewItem, { kind: "LEAVE" }>, reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, items, pageSize],
  );

  const closeDetail = () => {
    setRejecting(false);
    setRejectReason("");
    onClose();
  };

  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <PanelHeader
        title="审核管理"
        description="咨询助理、咨询主任、管理员可审批用户退款豁免与咨询师请假。"
        action={
          status === "PENDING" && items.length > 0 ? (
            <span className="rounded-full bg-[#FBE8E6] px-3 py-1 text-xs font-medium text-[#A13F37]">
              待审核 {items.length}
            </span>
          ) : null
        }
      />

      <div className="space-y-5 border-b border-[var(--lxxl-border)] px-6 py-5">
        <FilterTabs
          label="审核类型"
          options={categories}
          value={category}
          onChange={onCategoryChange}
        />
        <FilterTabs
          label="审核状态"
          options={statuses}
          value={status}
          onChange={onStatusChange}
        />
      </div>

      <div className="relative overflow-x-auto">
        {listLoading && items.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载审核记录...
          </div>
        )}
        {items.length === 0 ? (
          <EmptyState text={listLoading ? "正在加载审核记录..." : "暂无符合条件的审核记录。"} />
        ) : (
          <>
            <table className="w-full min-w-[1040px] border-collapse text-sm">
              <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">审核类型</th>
                  <th className="px-5 py-3 font-medium">提交时间</th>
                  <th className="px-5 py-3 font-medium">申请人</th>
                  <th className="px-5 py-3 font-medium">关联信息</th>
                  <th className="px-5 py-3 font-medium">申请原因</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => {
                  const summary = reviewSummary(item);
                  return (
                    <tr key={`${item.kind}-${item.id}`} className="border-t border-[var(--lxxl-border)] align-top">
                      <td className="px-5 py-4">
                        <Badge tone={item.kind === "EXEMPTION" ? "gold" : "green"}>
                          {reviewKindLabel(item.kind)}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">{formatFullDateTime(summary.createdAt)}</td>
                      <td className="px-5 py-4 font-medium">{summary.applicant}</td>
                      <td className="max-w-xs px-5 py-4 text-[var(--lxxl-muted)]">{summary.related}</td>
                      <td className="max-w-xs px-5 py-4">
                        <div className="line-clamp-2 break-words">{summary.reason || "-"}</div>
                      </td>
                      <td className="px-5 py-4">
                        <ReviewStatusBadge status={summary.status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <TableActionButton onClick={() => onOpen(item)}>查看详情</TableActionButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={items.length}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </div>

      {selectedItem && (
        <DetailDrawer
          title={selectedItem.kind === "EXEMPTION" ? "用户豁免详情" : "咨询师请假审核"}
          onClose={closeDetail}
          footer={
            <ReviewDrawerFooter
              item={selectedItem}
              processing={processing}
              rejecting={rejecting}
              rejectReason={rejectReason}
              setRejecting={setRejecting}
              setRejectReason={setRejectReason}
              onClose={closeDetail}
              onApprove={onApprove}
              onRejectExemption={onRejectExemption}
              onRejectLeave={onRejectLeave}
            />
          }
        >
          {selectedItem.kind === "EXEMPTION" ? (
            <ExemptionDetail item={selectedItem.data} />
          ) : (
            <LeaveDetail item={selectedItem.data} />
          )}
        </DetailDrawer>
      )}
    </section>
  );
}

function FilterTabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-[var(--lxxl-muted)]">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                selected
                  ? "border-[var(--lxxl-green)] bg-[var(--lxxl-green)] text-white"
                  : "border-[var(--lxxl-border)] bg-white text-[var(--lxxl-muted)] hover:border-[var(--lxxl-green)] hover:text-[var(--lxxl-green)]"
              }`}
              type="button"
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExemptionDetail({ item }: { item: RefundExemption }) {
  return (
    <div className="space-y-6">
      <DetailSection
        title="申请信息"
        rows={[
          [
            "来访者",
            [
              formatPatientNameWithContractTag(item.patientName, item.patientContractTag),
              item.patientMobile,
            ].filter(Boolean).join(" · "),
          ],
          ["咨询师", item.counselorName],
          ["咨询时间", formatFullDateTime(item.consultationStartTime)],
          ["申请金额", formatMoneyFromCents(item.amount)],
          ["审核状态", reviewStatusLabel(item.status)],
          ["提交时间", formatFullDateTime(item.createdAt)],
          ["处理时间", formatFullDateTime(item.reviewedAt)],
        ]}
      />
      <TextBlock title="申请原因" text={item.reason} />
      {item.status === "REJECTED" && item.rejectReason && (
        <TextBlock tone="danger" title="拒绝理由" text={item.rejectReason} />
      )}
      {item.screenshotUrl && <ReviewScreenshot title="申请截图" url={item.screenshotUrl} />}
    </div>
  );
}

function LeaveDetail({ item }: { item: AdminLeaveRequestDetail }) {
  return (
    <div className="space-y-6">
      <DetailSection
        title="请假信息"
        rows={[
          ["咨询师", item.counselorName],
          ["请假时段", timeRange(item.startTime, item.endTime)],
          ["预约地点", item.location || "-"],
          ["审批状态", reviewStatusLabel(item.status)],
          ...(item.reviewedBy
            ? ([["审核人", `账号 #${item.reviewedBy}`]] as Array<[string, string]>)
            : []),
          ["提交时间", formatFullDateTime(item.createdAt)],
          ["处理时间", formatFullDateTime(item.reviewedAt)],
        ]}
      />
      <LeaveReviewOutcome status={item.status} />
      <TextBlock title="请假原因" text={item.reason || "-"} />
      {item.status === "REJECTED" && item.rejectReason && (
        <TextBlock tone="danger" title="拒绝理由" text={item.rejectReason} />
      )}
      {item.screenshotUrl && <ReviewScreenshot title="沟通截图" url={item.screenshotUrl} />}
      <section>
        <h4 className="text-sm font-semibold">涉及预约与来访联系方式</h4>
        {item.affectedPatients.length === 0 ? (
          <div className="mt-3 rounded-xl bg-[#FAF8F4] px-4 py-5 text-sm text-[var(--lxxl-muted)]">
            本次请假未影响已预约来访。
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {item.affectedPatients.map((patient, index) => (
              <div
                key={`${patient.consultationId || index}-${patient.startTime || ""}`}
                className="rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-4"
              >
                <div className="font-medium">
                  {formatPatientNameWithContractTag(
                    patient.patientName || `来访者 ${index + 1}`,
                    patient.patientContractTag,
                  )}
                </div>
                <div className="mt-2 space-y-1 text-sm leading-6 text-[var(--lxxl-muted)]">
                  <div>联系电话：{patient.patientPhone || "未填写"}</div>
                  {(patient.emergencyContact || patient.emergencyPhone) && (
                    <div>
                      紧急联系人：{patient.emergencyContact || "-"} {patient.emergencyPhone || ""}
                    </div>
                  )}
                  <div>预约时间：{timeRange(patient.startTime, patient.endTime)}</div>
                  <div>地点：{patient.location || item.location || "-"}</div>
                  <div>退款安排：{leaveRefundText(item.status, patient.refundText)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LeaveReviewOutcome({ status }: { status: string }) {
  const copy =
    status === "APPROVED"
      ? "请假已通过，受影响预约已取消；已支付订单按原支付路径全额退款。"
      : status === "REJECTED"
        ? "请假未通过，预约与原支付状态保持不变。"
        : "审核通过后将取消受影响预约，已支付订单将按原支付路径全额退款。";
  const tone = status === "REJECTED" ? "bg-[#FFF4F2] text-[#A13F37]" : "bg-[#EDF6F1] text-[#315D4B]";
  return <div className={`rounded-xl px-4 py-3 text-sm leading-6 ${tone}`}>{copy}</div>;
}

function ReviewDrawerFooter({
  item,
  processing,
  rejecting,
  rejectReason,
  setRejecting,
  setRejectReason,
  onClose,
  onApprove,
  onRejectExemption,
  onRejectLeave,
}: {
  item: ReviewItem;
  processing: boolean;
  rejecting: boolean;
  rejectReason: string;
  setRejecting: (value: boolean) => void;
  setRejectReason: (value: string) => void;
  onClose: () => void;
  onApprove: (item: ReviewItem) => void;
  onRejectExemption: (item: Extract<ReviewItem, { kind: "EXEMPTION" }>, reason: string) => void;
  onRejectLeave: (item: Extract<ReviewItem, { kind: "LEAVE" }>, reason: string) => void;
}) {
  const status = item.data.status;
  if (status !== "PENDING") {
    return (
      <button className="rounded-xl border border-[var(--lxxl-border)] px-5 py-2 text-sm font-medium" type="button" onClick={onClose}>
        关闭
      </button>
    );
  }

  if (rejecting) {
    return (
      <div className="w-full space-y-3">
        <label className="block text-sm font-medium">
          拒绝理由（申请人可见）
          <textarea
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[var(--lxxl-border)] px-3 py-3 text-sm outline-none focus:border-[var(--lxxl-green)]"
            maxLength={500}
            placeholder={item.kind === "EXEMPTION" ? "请说明不予豁免的原因" : "请说明请假未通过的原因"}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-3">
          <button
            className="rounded-xl border border-[var(--lxxl-border)] px-5 py-2 text-sm font-medium"
            type="button"
            disabled={processing}
            onClick={() => {
              setRejecting(false);
              setRejectReason("");
            }}
          >
            取消
          </button>
          <button
            className="rounded-xl bg-[#A13F37] px-5 py-2 text-sm font-medium text-white disabled:opacity-45"
            type="button"
            disabled={processing || !rejectReason.trim()}
            onClick={() => {
              const reason = rejectReason.trim();
              if (item.kind === "EXEMPTION") {
                onRejectExemption(item, reason);
              } else {
                onRejectLeave(item, reason);
              }
            }}
          >
            {processing ? "正在处理..." : "确认拒绝"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-wrap justify-end gap-3">
      <button
        className="rounded-xl border border-[#E8C5C1] px-5 py-2 text-sm font-medium text-[#A13F37] disabled:opacity-45"
        type="button"
        disabled={processing}
        onClick={() => setRejecting(true)}
      >
        拒绝
      </button>
      <button
        className="rounded-xl bg-[var(--lxxl-green)] px-5 py-2 text-sm font-medium text-white disabled:opacity-45"
        type="button"
        disabled={processing}
        onClick={() => onApprove(item)}
      >
        {processing ? "正在处理..." : item.kind === "EXEMPTION" ? "同意豁免" : "通过请假并全额退款"}
      </button>
    </div>
  );
}

function DetailSection({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section>
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-3 divide-y divide-[var(--lxxl-border)]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-2 text-sm">
            <span className="text-[var(--lxxl-muted)]">{label}</span>
            <span className="break-words">{value || "-"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TextBlock({ title, text, tone = "neutral" }: { title: string; text: string; tone?: "neutral" | "danger" }) {
  return (
    <section className={`rounded-xl p-4 ${tone === "danger" ? "bg-[#FFF4F2]" : "bg-[#FAF8F4]"}`}>
      <h4 className={`text-sm font-semibold ${tone === "danger" ? "text-[#A13F37]" : ""}`}>{title}</h4>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--lxxl-muted)]">{text}</p>
    </section>
  );
}

function ReviewScreenshot({ title, url }: { title: string; url: string }) {
  const resolvedUrl = resolveAssetUrl(url);
  return (
    <section>
      <h4 className="text-sm font-semibold">{title}</h4>
      <a className="mt-3 block" href={resolvedUrl} rel="noreferrer" target="_blank">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="max-h-80 w-full rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] object-contain" src={resolvedUrl} alt={title} />
      </a>
    </section>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={status === "PENDING" ? "gold" : status === "APPROVED" ? "green" : status === "REJECTED" ? "red" : "neutral"}>
      {reviewStatusLabel(status)}
    </Badge>
  );
}

function reviewSummary(item: ReviewItem) {
  if (item.kind === "EXEMPTION") {
    return {
      applicant: formatPatientNameWithContractTag(
        item.data.patientName,
        item.data.patientContractTag,
      ),
      related: `${item.data.counselorName} · ${formatMoneyFromCents(item.data.amount)} · ${formatFullDateTime(item.data.consultationStartTime)}`,
      reason: item.data.reason,
      status: item.data.status,
      createdAt: item.data.createdAt,
    };
  }
  return {
    applicant: item.data.counselorName,
    related: `${timeRange(item.data.startTime, item.data.endTime)} · ${item.data.location || "地点未填写"}`,
    reason: item.data.reason || "",
    status: item.data.status,
    createdAt: item.data.createdAt || "",
  };
}

function reviewKindLabel(kind: ReviewItem["kind"]) {
  return kind === "EXEMPTION" ? "用户豁免" : "咨询师请假";
}

function reviewStatusLabel(status: string) {
  if (status === "PENDING") return "待审核";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "已拒绝";
  return status || "-";
}

function timeRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "-";
  return `${formatFullDateTime(start)} 至 ${formatFullDateTime(end)}`;
}

function leaveRefundText(status: string, backendText?: string | null) {
  if (status === "PENDING") {
    return "审核通过后，已支付款项将按原支付路径全额退回";
  }
  if (status === "REJECTED") {
    return "请假未通过，预约与原支付状态保持不变";
  }
  if (status === "APPROVED") {
    return backendText?.includes("原路")
      ? "已支付款项已按原支付路径全额退回"
      : "本次预约无可退支付款项";
  }
  return backendText || "-";
}

function resolveAssetUrl(url: string) {
  const value = url.trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}
