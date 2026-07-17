"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchConsultations, submitRefundExemption } from "@/lib/booking/api";
import type { ConsultationRecord } from "@/lib/booking/types";
import { formatSlotRange, formatYuan } from "@/lib/booking/utils";
import { useAuthStore } from "@/lib/stores/auth-store";

export function RefundExemptionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const consultationId = Number(searchParams.get("consultationId") || 0);

  const [record, setRecord] = useState<ConsultationRecord | null>(null);
  const [amountYuan, setAmountYuan] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      router.replace(
        `/login?redirect=${encodeURIComponent(`/consultation/records/exemption?consultationId=${consultationId}`)}`
      );
      return;
    }
    if (!consultationId) {
      setLoading(false);
      setError("缺少预约信息");
      return;
    }
    fetchConsultations(token)
      .then((rows) => {
        const found = rows.find((r) => r.id === consultationId) ?? null;
        setRecord(found);
        if (!found) setError("预约记录不存在");
        else if (found.exemptionStatus === "PENDING") setError("已有审核中的豁免申请");
        else if (found.refundEligible) setError("当前预约可直接取消并退款，无需申请豁免");
        else if (found.orderAmount) {
          setAmountYuan(formatYuan(found.orderAmount));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [token, consultationId, router]);

  const handleSubmit = async () => {
    if (!token || !consultationId) return;
    const amount = Math.round(Number(amountYuan) * 100);
    if (!amount || amount <= 0) {
      setError("请输入有效的豁免金额");
      return;
    }
    if (!reason.trim()) {
      setError("请填写无法前来咨询的原因");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitRefundExemption(token, consultationId, {
        amount,
        reason: reason.trim(),
      });
      router.push("/consultation/records");
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return null;

  return (
    <div>
      <Link
        href="/consultation/records"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        返回预约记录
      </Link>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">申请退款豁免</p>
        <p className="mt-1 text-amber-800/90">
          距咨询开始不足 24 小时时，可提交豁免申请由管理员审核。审核通过前预约与订单维持不变。
        </p>
      </div>

      {loading && <p className="py-12 text-center text-muted-foreground">加载中…</p>}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {record && !loading && !error && (
        <div className="space-y-6">
          <div className="rounded-[var(--radius)] border border-border bg-card p-5 text-sm">
            <p className="font-medium">关联预约</p>
            <p className="mt-2">咨询师：{record.counselorName}</p>
            <p className="mt-1">咨询时段：{formatSlotRange(record.startTime, record.endTime)}</p>
            {record.orderAmount != null && (
              <p className="mt-1">订单金额：￥{formatYuan(record.orderAmount)}</p>
            )}
          </div>

          <div className="space-y-4 rounded-[var(--radius)] border border-border bg-card p-6">
            <div>
              <label className="text-sm font-medium">申请豁免金额（元）</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountYuan}
                onChange={(e) => setAmountYuan(e.target.value)}
                placeholder="请输入申请豁免退款的金额"
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">无法前来咨询的原因</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请详细说明无法前来咨询的原因，便于人工审核"
                maxLength={1000}
                className="mt-2 min-h-[120px]"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{reason.length}/1000</p>
            </div>
          </div>

          <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "提交中…" : "提交申请"}
          </Button>
        </div>
      )}
    </div>
  );
}
