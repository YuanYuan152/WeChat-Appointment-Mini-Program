"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/booking/signature-pad";
import { APPOINTMENT_CENTER_MAP } from "@/lib/booking/constants";
import {
  TONGXIN_AGREEMENT_TITLE,
  YANGFAN_AGREEMENT_TITLE,
  type AgreementEmergencyContact,
  getAdultAgreement,
  getMinorAgreement,
  validateAgreementEmergencyContact,
} from "@/lib/booking/intake-agreement";
import type { BookingTimeSlot } from "@/lib/booking/slots";
import { currentDateLabel } from "@/lib/booking/utils";
import { cn } from "@/lib/utils";

interface BookingModalsProps {
  counselorName: string;
  selectedSlot: BookingTimeSlot | null;
  centerId: string | null;
  showAge: boolean;
  showAgreement: boolean;
  showPayment: boolean;
  agreementText: string;
  emergencyContact: AgreementEmergencyContact;
  onEmergencyContactChange: (patch: Partial<AgreementEmergencyContact>) => void;
  signaturePreview: string | null;
  showSignaturePad: boolean;
  payRulesAgreed: boolean;
  paying: boolean;
  onCloseAge: () => void;
  onConfirmAge: (isAdult: boolean) => void;
  onCloseAgreement: () => void;
  onStartSignature: () => void;
  onSignatureConfirm: (blob: Blob) => void;
  onSignatureCancel: () => void;
  onConfirmAgreement: () => void;
  onClosePayment: () => void;
  onTogglePayRules: () => void;
  onConfirmPayment: () => void;
}

export function BookingModals({
  counselorName,
  selectedSlot,
  centerId,
  showAge,
  showAgreement,
  showPayment,
  agreementText,
  emergencyContact,
  onEmergencyContactChange,
  signaturePreview,
  showSignaturePad,
  payRulesAgreed,
  paying,
  onCloseAge,
  onConfirmAge,
  onCloseAgreement,
  onStartSignature,
  onSignatureConfirm,
  onSignatureCancel,
  onConfirmAgreement,
  onClosePayment,
  onTogglePayRules,
  onConfirmPayment,
}: BookingModalsProps) {
  const emergencyError = validateAgreementEmergencyContact(emergencyContact);
  return (
    <>
      <Dialog open={showAge} onOpenChange={(open) => !open && onCloseAge()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择签署协议</DialogTitle>
            <DialogDescription>
              请选择需要签署的心理咨询协议
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button className="flex-1" onClick={() => onConfirmAge(true)}>
              {TONGXIN_AGREEMENT_TITLE}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => onConfirmAge(false)}>
              {YANGFAN_AGREEMENT_TITLE}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAgreement} onOpenChange={(open) => !open && onCloseAgreement()}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>心理咨询协议</DialogTitle>
            <DialogDescription>请阅读协议并完成手写签名</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="rounded-xl bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {agreementText}
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-medium">
                  紧急联系人信息 <span className="text-red-500">*</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">签署协议前请完整填写以下三项</p>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">紧急联系人姓名</span>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  value={emergencyContact.name}
                  onChange={(e) => onEmergencyContactChange({ name: e.target.value })}
                  placeholder="请输入姓名"
                  maxLength={50}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">与您的关系</span>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  value={emergencyContact.relation}
                  onChange={(e) => onEmergencyContactChange({ relation: e.target.value })}
                  placeholder="如：父亲 / 配偶 / 朋友"
                  maxLength={30}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">联系电话</span>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  value={emergencyContact.phone}
                  onChange={(e) => onEmergencyContactChange({ phone: e.target.value })}
                  placeholder="请输入手机号"
                  maxLength={20}
                />
              </label>
              {emergencyError && (
                <p className="text-xs text-red-500">{emergencyError}</p>
              )}
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">
                  来访者签字 <span className="text-red-500">*</span>
                </span>
                <span className="text-xs text-muted-foreground">{currentDateLabel()}</span>
              </div>
              {!signaturePreview && !showSignaturePad && (
                <button
                  type="button"
                  onClick={onStartSignature}
                  className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary"
                >
                  点击此处手写签名
                </button>
              )}
              {showSignaturePad && (
                <SignaturePad onConfirm={onSignatureConfirm} onCancel={onSignatureCancel} />
              )}
              {signaturePreview && !showSignaturePad && (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signaturePreview}
                    alt="签名"
                    className="mx-auto h-24 object-contain"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={onStartSignature}>
                    重新签名
                  </Button>
                </div>
              )}
            </div>
          </div>
          <Button
            className="w-full"
            disabled={!signaturePreview || !!emergencyError}
            onClick={onConfirmAgreement}
          >
            同意协议并继续
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayment} onOpenChange={(open) => !open && onClosePayment()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认订单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <span className="text-3xl font-bold text-primary">
                ¥{selectedSlot?.Price ?? 0}
              </span>
            </div>
            <div className="space-y-2 rounded-xl bg-muted/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">咨询师</span>
                <span>{counselorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">预约时间</span>
                <span className="font-medium text-primary">
                  {selectedSlot?.startDate} {selectedSlot?.startHH}-{selectedSlot?.endHH}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">预约中心</span>
                <span>{centerId ? APPOINTMENT_CENTER_MAP[centerId] ?? centerId : "-"}</span>
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
              <p className="mb-2 font-medium">温馨提示</p>
              <ul className="space-y-1 text-xs leading-relaxed">
                <li>· 距咨询开始超过 24 小时可免费取消；</li>
                <li>· 距咨询开始 24 小时内取消或爽约，不予退款；</li>
                <li>· 特殊情况可致电咨询，申请人工豁免；</li>
                <li>· 迟到 15 分钟以上视为爽约。</li>
              </ul>
            </div>
            <button
              type="button"
              className="flex w-full items-start gap-3 text-left text-sm"
              onClick={onTogglePayRules}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  payRulesAgreed ? "border-primary bg-primary text-white" : "border-border"
                )}
              >
                {payRulesAgreed && "✓"}
              </span>
              <span>
                我已同意上述规则及《隐私协议》
              </span>
            </button>
          </div>
          <Button
            className="w-full"
            disabled={!payRulesAgreed || paying}
            onClick={onConfirmPayment}
          >
            {paying ? "预约中..." : "确认支付"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function buildAgreementText(
  isAdult: boolean,
  counselorName: string,
  price: number,
  emergency?: Partial<AgreementEmergencyContact> | null
): string {
  return isAdult
    ? getAdultAgreement(counselorName, price, emergency)
    : getMinorAgreement(counselorName, price, emergency);
}
