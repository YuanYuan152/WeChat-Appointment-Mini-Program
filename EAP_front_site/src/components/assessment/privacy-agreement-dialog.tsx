"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  privacyAgreementIntro,
  privacyAgreementSections,
} from "@/lib/assessment/privacy-content";
import { ASSISTANT_CONTACT } from "@/lib/booking/contact-info";

interface PrivacyAgreementDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onAccept: () => void;
  onDecline?: () => void;
}

export function PrivacyAgreementDialog({
  open,
  onOpenChange,
  onAccept,
  onDecline,
}: PrivacyAgreementDialogProps) {
  const handleDecline = () => {
    onDecline?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) return;
        onOpenChange?.(next);
      }}
      closeOnBackdrop={false}
    >
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>隐私保护协议</DialogTitle>
          </div>
          <DialogDescription>{privacyAgreementIntro}</DialogDescription>
        </DialogHeader>

        <div className="my-4 max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
          {privacyAgreementSections.map((section) => (
            <div key={section.title} className="mb-4 last:mb-0">
              <h3 className="mb-1.5 font-medium text-foreground">{section.title}</h3>
              <p>{section.content}</p>
            </div>
          ))}
          <p className="mt-2 text-xs">
            如有疑问，请联系咨询助理电话：{ASSISTANT_CONTACT.phone}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={handleDecline}>
            暂不同意
          </Button>
          <Button onClick={onAccept}>我已阅读并同意</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
