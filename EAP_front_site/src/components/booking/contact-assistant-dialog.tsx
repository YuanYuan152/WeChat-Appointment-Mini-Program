"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactAssistantContent } from "@/components/booking/contact-assistant-content";

interface ContactAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactAssistantDialog({ open, onOpenChange }: ContactAssistantDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>联系助理</DialogTitle>
        </DialogHeader>
        <ContactAssistantContent showCenters={false} compact />
      </DialogContent>
    </Dialog>
  );
}
