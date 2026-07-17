"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StarRating } from "@/components/booking/star-rating";
import { cancelConsultation, fetchConsultations } from "@/lib/booking/api";
import {
  goalScoreHint,
  rhythmScoreHint,
} from "@/lib/booking/consultation-feedback";
import type { ConsultationRecord } from "@/lib/booking/types";
import {
  consultationStatusLabel,
  formatSlotRange,
  formatYuan,
} from "@/lib/booking/utils";
import { resolveCounselorAvatar } from "@/lib/booking/counselor-avatars";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

type RecordTab = "unfinished" | "done" | "feedbacked" | "cancelled";

const TABS: { value: RecordTab; label: string }[] = [
  { value: "unfinished", label: "未完成" },
  { value: "done", label: "已完成" },
  { value: "feedbacked", label: "已反馈" },
  { value: "cancelled", label: "已取消" },
];

const UNFINISHED_STATUSES = new Set(["PENDING", "CONFIRMED", "ONGOING"]);

function filterByTab(list: ConsultationRecord[], tab: RecordTab) {
  if (tab === "done") return list.filter((r) => r.status === "DONE" && !r.hasFeedback);
  if (tab === "feedbacked") return list.filter((r) => r.status === "DONE" && r.hasFeedback);
  if (tab === "cancelled") return list.filter((r) => r.status === "CANCELLED");
  return list.filter((r) => UNFINISHED_STATUSES.has(r.status));
}

function recordStatusLabel(r: ConsultationRecord) {
  if (r.status === "DONE" && r.hasFeedback) return "已反馈";
  if (r.status === "DONE") return "已完成";
  if (r.status === "CANCELLED") return "已取消";
  if (UNFINISHED_STATUSES.has(r.status)) return "未完成";
  return consultationStatusLabel(r.status);
}

function emptyText(tab: RecordTab) {
  if (tab === "cancelled") return "暂无已取消的预约";
  if (tab === "feedbacked") return "暂无已反馈的预约";
  if (tab === "done") return "暂无待反馈的已完成预约";
  return "暂无未完成的预约";
}

export function ConsultationRecordsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const initialTab = (searchParams.get("tab") as RecordTab) || "unfinished";
  const [activeTab, setActiveTab] = useState<RecordTab>(
    TABS.some((t) => t.value === initialTab) ? initialTab : "unfinished"
  );
  const [allRecords, setAllRecords] = useState<ConsultationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<ConsultationRecord | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const records = useMemo(
    () => filterByTab(allRecords, activeTab),
    [allRecords, activeTab]
  );

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchConsultations(token);
      setAllRecords(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      router.replace("/login?redirect=/consultation/records");
      return;
    }
    load();
  }, [token, load, router]);

  const handleCancel = async () => {
    if (!token || !cancelTarget) return;
    setCancelling(true);
    try {
      const res = await cancelConsultation(token, cancelTarget.id);
      setCancelTarget(null);
      alert(res.message);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "取消失败");
    } finally {
      setCancelling(false);
    }
  };

  if (!token) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors",
              activeTab === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link href="/consultation/messages" className="text-primary hover:underline">
          我的消息 →
        </Link>
        <Link href="/consultation/contact" className="text-primary hover:underline">
          联系助理 →
        </Link>
      </div>

      {loading && <p className="py-12 text-center text-muted-foreground">加载中…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && records.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">{emptyText(activeTab)}</p>
          <Link href="/consultation" className="mt-4 inline-block text-primary hover:underline">
            去预约咨询
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {records.map((r) => (
          <article
            key={r.id}
            className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex gap-4">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={resolveCounselorAvatar(r.counselorName, r.counselorId)}
                  alt={r.counselorName}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{r.counselorName}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatSlotRange(r.startTime, r.endTime)}
                    </p>
                    {r.centerName && (
                      <p className="text-sm text-muted-foreground">{r.centerName}</p>
                    )}
                  </div>
                  <Badge variant={r.status === "CANCELLED" ? "outline" : "secondary"}>
                    {recordStatusLabel(r)}
                  </Badge>
                </div>

                {r.exemptionStatus === "PENDING" && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    退款豁免审核中。审核通过前预约与订单维持不变。
                  </p>
                )}
                {r.exemptionStatus === "REJECTED" && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                    退款豁免未通过
                    {r.exemptionRejectReason ? `：${r.exemptionRejectReason}` : ""}
                  </p>
                )}
                {r.exemptionStatus === "APPROVED" && (
                  <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
                    退款豁免已通过，预约已取消，款项将原路退回
                  </p>
                )}

                {r.status === "CANCELLED" && r.cancelSummary && (
                  <p className="mt-3 text-xs text-muted-foreground">{r.cancelSummary}</p>
                )}

                {r.status === "DONE" && r.hasFeedback && (
                  <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm">
                    <p className="mb-3 font-medium">我的反馈</p>
                    {r.feedbackGoalScore != null && r.feedbackGoalScore > 0 && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">目标达成</span>
                        <StarRating value={r.feedbackGoalScore} readonly size="sm" />
                        <span className="text-xs text-muted-foreground">
                          {goalScoreHint(r.feedbackGoalScore)}
                        </span>
                      </div>
                    )}
                    {r.feedbackRhythmScore != null && r.feedbackRhythmScore > 0 && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">议题节奏</span>
                        <StarRating value={r.feedbackRhythmScore} readonly size="sm" />
                        <span className="text-xs text-muted-foreground">
                          {rhythmScoreHint(r.feedbackRhythmScore)}
                        </span>
                      </div>
                    )}
                    {r.feedbackImprovements?.length ? (
                      <p className="text-muted-foreground">
                        改进方面：{r.feedbackImprovements.join("、")}
                      </p>
                    ) : r.feedbackContent ? (
                      <p className="text-muted-foreground">{r.feedbackContent}</p>
                    ) : null}
                  </div>
                )}

                {r.canCancel && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {r.refundEligible
                        ? "距咨询超过 24 小时，取消可退款"
                        : "距咨询不足 24 小时，取消不退款"}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setCancelTarget(r)}>
                      取消预约
                    </Button>
                  </div>
                )}

                {r.status === "DONE" && !r.hasFeedback && (
                  <div className="mt-4">
                    <Link href={`/consultation/records/feedback?consultationId=${r.id}`}>
                      <Button size="sm">去反馈</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消预约</DialogTitle>
            <DialogDescription>请确认以下咨询信息</DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">咨询师</span>
                <span>{cancelTarget.counselorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">咨询时段</span>
                <span className="font-medium text-primary">
                  {formatSlotRange(cancelTarget.startTime, cancelTarget.endTime)}
                </span>
              </div>
              {cancelTarget.centerName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">预约中心</span>
                  <span>{cancelTarget.centerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">是否全额退款</span>
                <span className={cancelTarget.refundEligible ? "text-green-600" : "text-red-500"}>
                  {cancelTarget.refundEligible ? "是，取消后原路全额退款" : "否"}
                </span>
              </div>
              {!cancelTarget.refundEligible && cancelTarget.refundReason && (
                <p className="rounded-lg bg-muted p-3 text-xs">{cancelTarget.refundReason}</p>
              )}
              {cancelTarget.orderAmount != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">订单金额</span>
                  <span>￥{formatYuan(cancelTarget.orderAmount)}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCancelTarget(null)}>
                返回
              </Button>
              <Button className="flex-1" disabled={cancelling} onClick={handleCancel}>
                {cancelling ? "取消中..." : "确认取消"}
              </Button>
            </div>
            {cancelTarget && !cancelTarget.refundEligible && cancelTarget.exemptionStatus !== "PENDING" && (
              <Link
                href={`/consultation/records/exemption?consultationId=${cancelTarget.id}`}
                className="w-full"
                onClick={() => setCancelTarget(null)}
              >
                <Button variant="secondary" className="w-full">
                  申请退款豁免
                </Button>
              </Link>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
