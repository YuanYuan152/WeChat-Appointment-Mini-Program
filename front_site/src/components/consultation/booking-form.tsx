"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Consultant } from "@/lib/api/types";

const bookingSchema = z.object({
  name: z.string().min(2, "请输入姓名"),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  date: z.string().min(1, "请选择日期"),
  timeSlot: z.string().min(1, "请选择时段"),
  note: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  consultant: Consultant;
}

export function BookingForm({ consultant }: BookingFormProps) {
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  });

  const onSubmit = async (data: BookingFormData) => {
    setSubmitting(true);
    try {
      const result = await api.createBooking({
        consultantId: consultant.id,
        ...data,
      });
      if (result.success) {
        setSuccessMessage(result.message);
        setSuccessOpen(true);
        reset();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <Label htmlFor="name">您的姓名</Label>
          <Input id="name" className="mt-1.5" placeholder="请输入姓名" {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div>
          <Label htmlFor="phone">手机号码</Label>
          <Input id="phone" className="mt-1.5" placeholder="请输入手机号" {...register("phone")} />
          {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
        </div>

        <div>
          <Label htmlFor="date">期望日期</Label>
          <Input id="date" type="date" min={minDate} className="mt-1.5" {...register("date")} />
          {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date.message}</p>}
        </div>

        <div>
          <Label htmlFor="timeSlot">预约时段</Label>
          <select
            id="timeSlot"
            className="mt-1.5 flex h-11 w-full rounded-xl border border-border bg-card px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register("timeSlot")}
          >
            <option value="">请选择时段</option>
            {consultant.availableSlots.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
          {errors.timeSlot && <p className="mt-1 text-xs text-red-500">{errors.timeSlot.message}</p>}
        </div>

        <div>
          <Label htmlFor="note">备注（选填）</Label>
          <Textarea id="note" className="mt-1.5" placeholder="简要描述您想咨询的问题" {...register("note")} />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "提交中..." : "确认预约电话咨询"}
        </Button>
      </form>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent onClose={() => setSuccessOpen(false)}>
          <DialogHeader>
            <DialogTitle>预约成功</DialogTitle>
            <DialogDescription>{successMessage}</DialogDescription>
          </DialogHeader>
          <Button onClick={() => setSuccessOpen(false)} className="mt-4 w-full">
            好的
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
