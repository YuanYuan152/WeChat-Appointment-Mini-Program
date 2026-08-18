export interface BookingTimeSlot {
  ID: number;
  gId?: string;
  startDate: string;
  startHH: string;
  endHH: string;
  week: string;
  Price: number;
  maxSign: number;
  numSign: number;
  centerId: string;
  status?: "AVAILABLE" | "BOOKED" | "EXPIRED" | "PENDING_PAYMENT" | "TOO_SOON";
  isBookable?: boolean;
  unavailableReason?: string;
  startTime?: string;
  endTime?: string;
}

export function normalizeBookingTimeSlots(raw: unknown[] = []): BookingTimeSlot[] {
  return raw
    .map((item) => {
      const slot = item as Record<string, unknown>;
      const centerId = String(slot.centerId ?? slot.center_id ?? slot.CenterId ?? "");
      return {
        ID: Number(slot.ID ?? slot.Id ?? slot.id ?? 0),
        gId: slot.gId as string | undefined,
        startDate: String(slot.startDate ?? ""),
        startHH: String(slot.startHH ?? ""),
        endHH: String(slot.endHH ?? ""),
        week: String(slot.week ?? ""),
        Price: Number(slot.Price ?? slot.price ?? 0),
        maxSign: Number(slot.maxSign ?? 1),
        numSign: Number(slot.numSign ?? 0),
        centerId,
        status: slot.status as BookingTimeSlot["status"],
        isBookable:
          slot.isBookable !== undefined
            ? Boolean(slot.isBookable)
            : slot.status !== "BOOKED" &&
              slot.status !== "EXPIRED" &&
              Number(slot.numSign ?? 0) < Number(slot.maxSign ?? 1),
        unavailableReason: (slot.unavailableReason ?? slot.unavailable_reason) as
          | string
          | undefined,
        startTime: slot.startTime as string | undefined,
        endTime: slot.endTime as string | undefined,
      };
    })
    .filter((slot) => Boolean(slot.centerId) && Boolean(slot.ID));
}

export function getCounselorAvailableCenterIds(slots: BookingTimeSlot[]): string[] {
  return [...new Set(slots.map((s) => s.centerId).filter(Boolean))];
}

export function filterSlotsByCenter(
  slots: BookingTimeSlot[],
  centerId: string | null
): BookingTimeSlot[] {
  if (!centerId) return [];
  return slots.filter((s) => s.centerId === centerId);
}

export function counselorWorksAtCenter(slots: BookingTimeSlot[], centerId: string): boolean {
  return slots.some((s) => s.centerId === centerId);
}

export function isSlotExpired(slot: BookingTimeSlot): boolean {
  return slot.status === "EXPIRED";
}

export function slotUnavailableLabel(slot: BookingTimeSlot): string {
  if (slot.unavailableReason) return slot.unavailableReason;
  if (isSlotExpired(slot)) return "已过期";
  if (slot.status === "BOOKED") return "已约满";
  return "已约满";
}

export function isSlotBookable(slot: BookingTimeSlot): boolean {
  if (slot.isBookable === false) return false;
  if (isSlotExpired(slot)) return false;
  if (slot.status === "BOOKED") return false;
  return (slot.numSign ?? 0) < (slot.maxSign ?? 1);
}

export function hasBookableSlotsInCenter(
  slots: BookingTimeSlot[],
  centerId: string | null
): boolean {
  if (!centerId) return false;
  return slots.some((s) => s.centerId === centerId && isSlotBookable(s));
}
