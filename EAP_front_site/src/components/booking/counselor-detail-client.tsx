"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, MapPin, Headphones } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingModals, buildAgreementText } from "@/components/booking/booking-modals";
import { ContactAssistantDialog } from "@/components/booking/contact-assistant-dialog";
import {
  addFavorite,
  checkFavorite,
  fetchCounselorDetail,
  fetchCounselorTimeSlots,
  fetchPatientProfile,
  removeFavorite,
  simulatePay,
  uploadSignature,
} from "@/lib/booking/api";
import { validateAgreementEmergencyContact } from "@/lib/booking/intake-agreement";
import { APPOINTMENT_CENTERS } from "@/lib/booking/constants";
import {
  counselorWorksAtCenter,
  filterSlotsByCenter,
  getCounselorAvailableCenterIds,
  hasBookableSlotsInCenter,
  isSlotBookable,
  slotUnavailableLabel,
  type BookingTimeSlot,
} from "@/lib/booking/slots";
import type { CounselorDetail } from "@/lib/booking/types";
import {
  billingToYuan,
  splitCsv,
} from "@/lib/booking/utils";
import { resolveCounselorAvatar } from "@/lib/booking/counselor-avatars";
import { consultationDetailPath } from "@/lib/booking/paths";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

interface CounselorDetailClientProps {
  counselorId: number;
  source?: string | null;
}

export function CounselorDetailClient({ counselorId, source }: CounselorDetailClientProps) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [counselor, setCounselor] = useState<CounselorDetail | null>(null);
  const [timeSlots, setTimeSlots] = useState<BookingTimeSlot[]>([]);
  const [centerIds, setCenterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"intro" | "booking">("intro");

  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number>(-1);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const [needsIntakeAgreement, setNeedsIntakeAgreement] = useState(true);
  const [showAge, setShowAge] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [intakeIsAdult, setIntakeIsAdult] = useState<boolean | null>(null);
  const [agreementText, setAgreementText] = useState("");
  const [emergencyContact, setEmergencyContact] = useState({
    name: "",
    relation: "",
    phone: "",
  });
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [payRulesAgreed, setPayRulesAgreed] = useState(false);
  const [paying, setPaying] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [contactOpen, setContactOpen] = useState(false);

  const applySlots = useCallback((slots: BookingTimeSlot[], availableCenterIds?: string[]) => {
    setTimeSlots(slots);
    setCenterIds(
      availableCenterIds?.length
        ? availableCenterIds
        : getCounselorAvailableCenterIds(slots)
    );
    setSelectedCenterId(null);
    setSelectedSlotId(-1);
  }, []);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCounselorDetail(counselorId, source);
      setCounselor(data);
      applySlots(data.timeSlots ?? [], data.availableCenterIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [applySlots, counselorId, source]);

  const refreshSlots = useCallback(async () => {
    try {
      const data = await fetchCounselorTimeSlots(counselorId);
      applySlots(data.timeSlots, data.availableCenterIds);
    } catch {
      /* ignore */
    }
  }, [applySlots, counselorId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!token || !counselorId) {
      setIsFavorited(false);
      return;
    }
    checkFavorite(token, counselorId)
      .then(setIsFavorited)
      .catch(() => setIsFavorited(false));
  }, [token, counselorId]);

  const selectedSlot = useMemo(
    () => timeSlots.find((s) => s.ID === selectedSlotId) ?? null,
    [timeSlots, selectedSlotId]
  );

  const filteredSlots = useMemo(
    () => filterSlotsByCenter(timeSlots, selectedCenterId),
    [timeSlots, selectedCenterId]
  );

  const worksAtCenter = (centerId: string) =>
    centerIds.includes(centerId) || counselorWorksAtCenter(timeSlots, centerId);

  const isTimeModuleDisabled =
    Boolean(selectedCenterId) &&
    (!worksAtCenter(selectedCenterId!) ||
      !hasBookableSlotsInCenter(timeSlots, selectedCenterId));

  const canProceedBooking = Boolean(
    selectedCenterId &&
      selectedSlotId !== -1 &&
      selectedSlot &&
      isSlotBookable(selectedSlot) &&
      selectedSlot.centerId === selectedCenterId
  );

  const priceYuan = counselor ? billingToYuan(counselor.billing) : 0;
  const fields = splitCsv(counselor?.field || counselor?.specialty);
  const targetGroups = splitCsv(counselor?.targetGroup);

  const resetSignature = () => {
    setSignatureBlob(null);
    if (signaturePreview) URL.revokeObjectURL(signaturePreview);
    setSignaturePreview(null);
    setShowSignaturePad(false);
    setIntakeIsAdult(null);
    setEmergencyContact({ name: "", relation: "", phone: "" });
  };

  const requireLogin = (redirectPath: string) => {
    router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  };

  const makeAppointment = async () => {
    setBookingError("");
    if (!selectedCenterId) {
      setBookingError("请选择预约中心");
      return;
    }
    if (!canProceedBooking) {
      setBookingError("请选择可约时间段");
      return;
    }

    const redirectPath = consultationDetailPath(counselorId, source);
    if (!token) {
      requireLogin(redirectPath);
      return;
    }

    resetSignature();
    let needIntake = needsIntakeAgreement;
    if (token) {
      try {
        const profile = await fetchPatientProfile(token);
        needIntake = profile.needsIntakeAgreement !== false;
        setNeedsIntakeAgreement(needIntake);
      } catch {
        needIntake = true;
        setNeedsIntakeAgreement(true);
      }
    }

    if (!needIntake) {
      setPayRulesAgreed(false);
      setShowPayment(true);
      return;
    }
    setShowAge(true);
  };

  const toggleFavorite = async () => {
    if (!counselorId) return;
    if (!token) {
      requireLogin(consultationDetailPath(counselorId, source));
      return;
    }
    if (favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      if (isFavorited) {
        await removeFavorite(token, counselorId);
        setIsFavorited(false);
      } else {
        await addFavorite(token, counselorId);
        setIsFavorited(true);
      }
    } catch {
      setBookingError("收藏操作失败");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const rebuildAgreementText = (
    isAdult: boolean,
    emergency = emergencyContact
  ) => {
    setAgreementText(
      buildAgreementText(
        isAdult,
        counselor?.name ?? "咨询师",
        selectedSlot?.Price ?? priceYuan,
        emergency
      )
    );
  };

  const handleConfirmAge = async (isAdult: boolean) => {
    setIntakeIsAdult(isAdult);
    setShowAge(false);
    let nextEmergency = emergencyContact;
    if (token) {
      try {
        const profile = await fetchPatientProfile(token);
        nextEmergency = {
          name: profile.emergencyContact || "",
          relation: profile.emergencyRelation || "",
          phone: profile.emergencyPhone || "",
        };
        setEmergencyContact(nextEmergency);
      } catch {
        /* ignore */
      }
    }
    rebuildAgreementText(isAdult, nextEmergency);
    setShowAgreement(true);
  };

  const handleEmergencyContactChange = (
    patch: Partial<{ name: string; relation: string; phone: string }>
  ) => {
    setEmergencyContact((prev) => {
      const next = { ...prev, ...patch };
      if (intakeIsAdult !== null) rebuildAgreementText(intakeIsAdult, next);
      return next;
    });
  };

  const handleSignatureConfirm = (blob: Blob) => {
    setSignatureBlob(blob);
    const url = URL.createObjectURL(blob);
    setSignaturePreview(url);
    setShowSignaturePad(false);
  };

  const handleConfirmAgreement = () => {
    if (!signaturePreview) return;
    const err = validateAgreementEmergencyContact(emergencyContact);
    if (err) {
      setBookingError(err);
      return;
    }
    setShowAgreement(false);
    setPayRulesAgreed(false);
    setShowPayment(true);
  };

  const handleConfirmPayment = async () => {
    if (!token || !selectedSlot || !selectedCenterId || !counselor) return;
    if (!payRulesAgreed) {
      setBookingError("请先阅读并同意温馨提示与隐私协议");
      return;
    }

    setPaying(true);
    setBookingError("");
    try {
      let signatureUrl: string | undefined;
      if (needsIntakeAgreement) {
        if (intakeIsAdult === null) throw new Error("请先选择签署协议");
        if (!signatureBlob) throw new Error("请先完成协议签字");
        const emergencyError = validateAgreementEmergencyContact(emergencyContact);
        if (emergencyError) throw new Error(emergencyError);
        signatureUrl = await uploadSignature(token, signatureBlob);
      }

      const payload = {
        slot_id: selectedSlot.ID,
        center_id: selectedCenterId,
        total_fee: Math.round((selectedSlot.Price || priceYuan) * 100),
        description: `心理咨询预约 - ${counselor.name}`,
        ...(needsIntakeAgreement
          ? {
              is_adult: intakeIsAdult!,
              signature_url: signatureUrl,
              emergency_contact: emergencyContact.name.trim(),
              emergency_relation: emergencyContact.relation.trim(),
              emergency_phone: emergencyContact.phone.trim(),
            }
          : {}),
      };

      const result = await simulatePay(token, payload);
      setNeedsIntakeAgreement(false);
      setShowPayment(false);
      await refreshSlots();
      router.push(`/consultation/payment-result?order_id=${result.order_id}`);
    } catch (e) {
      setBookingError(e instanceof Error ? e.message : "预约失败");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <p className="py-20 text-center text-muted-foreground">加载咨询师信息…</p>;
  }

  if (error || !counselor) {
    return (
      <div className="py-20 text-center">
        <p className="text-red-500">{error || "咨询师不存在"}</p>
        <Link href="/consultation" className="mt-4 inline-block text-primary hover:underline">
          返回列表
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="relative mb-6 overflow-hidden rounded-[var(--radius)] border border-border bg-card">
        <div className="relative h-56 sm:h-64">
          <Image
            src={resolveCounselorAvatar(counselor.name, counselor.id)}
            alt={counselor.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <h1 className="font-serif text-2xl font-bold sm:text-3xl">{counselor.name}</h1>
            <p className="mt-1 text-white/80">{counselor.title || "心理咨询师"}</p>
            <p className="mt-2 text-xl font-semibold">
              ¥{priceYuan}
              <span className="text-sm font-normal text-white/80">/次</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center">
          <div className="py-4">
            <div className="text-lg font-semibold">{counselor.workYears}年</div>
            <div className="text-xs text-muted-foreground">从业年限</div>
          </div>
          <div className="py-4">
            <div className="text-lg font-semibold">{counselor.consultHours}h+</div>
            <div className="text-xs text-muted-foreground">咨询时数</div>
          </div>
          <div className="py-4">
            <div className="text-lg font-semibold">{counselor.province || "线下/线上"}</div>
            <div className="text-xs text-muted-foreground">服务方式</div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-2 rounded-full bg-muted p-1">
        {(["intro", "booking"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={cn(
              "flex-1 rounded-full py-2 text-sm transition-colors",
              activeTab === tab ? "bg-card font-medium text-primary shadow-sm" : "text-muted-foreground"
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "intro" ? "介绍" : "预约"}
          </button>
        ))}
      </div>

      {activeTab === "intro" ? (
        <div className="space-y-6">
          <section className="rounded-[var(--radius)] border border-border bg-card p-6">
            <h2 className="mb-3 font-serif text-lg font-semibold">简介</h2>
            <p className="leading-relaxed text-muted-foreground">
              {counselor.introduce || counselor.profile || "暂无简介"}
            </p>
          </section>
          {counselor.qualification && (
            <section className="rounded-[var(--radius)] border border-border bg-card p-6">
              <h2 className="mb-3 font-serif text-lg font-semibold">资质</h2>
              <p className="text-muted-foreground">{counselor.qualification}</p>
            </section>
          )}
          {fields.length > 0 && (
            <section className="rounded-[var(--radius)] border border-border bg-card p-6">
              <h2 className="mb-3 font-serif text-lg font-semibold">专业领域</h2>
              <div className="flex flex-wrap gap-2">
                {fields.map((f) => (
                  <Badge key={f}>{f}</Badge>
                ))}
              </div>
            </section>
          )}
          {targetGroups.length > 0 && (
            <section className="rounded-[var(--radius)] border border-border bg-card p-6">
              <h2 className="mb-3 font-serif text-lg font-semibold">服务人群</h2>
              <div className="flex flex-wrap gap-2">
                {targetGroups.map((g) => (
                  <Badge key={g} variant="outline">
                    {g}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">请选择您合适的预约中心和时间段</p>

          <section className="rounded-[var(--radius)] border border-border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-medium">
              <MapPin className="h-4 w-4 text-primary" />
              预约中心
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {APPOINTMENT_CENTERS.map((center) => {
                const unavailable = !worksAtCenter(center.id);
                return (
                  <button
                    key={center.id}
                    type="button"
                    disabled={unavailable}
                    onClick={() => {
                      setSelectedCenterId(center.id);
                      setSelectedSlotId(-1);
                    }}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      selectedCenterId === center.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                      unavailable && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div className="font-medium">{center.name}</div>
                    {unavailable && (
                      <div className="mt-1 text-xs text-muted-foreground">暂无可约</div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className={cn(
              "rounded-[var(--radius)] border border-border bg-card p-5",
              isTimeModuleDisabled && "opacity-60"
            )}
          >
            <h3 className="mb-3 font-medium">可约时间</h3>
            {!selectedCenterId && (
              <p className="py-8 text-center text-sm text-muted-foreground">请先选择预约中心</p>
            )}
            {selectedCenterId && !worksAtCenter(selectedCenterId) && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                该咨询师不在此预约中心，暂不可预约
              </p>
            )}
            {selectedCenterId && worksAtCenter(selectedCenterId) && filteredSlots.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                该预约中心暂无可约时间段
              </p>
            )}
            {selectedCenterId && filteredSlots.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSlots.map((slot) => {
                  const bookable = isSlotBookable(slot);
                  const selected = selectedSlotId === slot.ID && bookable;
                  return (
                    <button
                      key={slot.ID}
                      type="button"
                      disabled={!bookable || isTimeModuleDisabled}
                      onClick={() => {
                        if (!bookable) return;
                        setSelectedSlotId(selected ? -1 : slot.ID);
                      }}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-colors",
                        selected ? "border-primary bg-primary/5" : "border-border",
                        !bookable && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span>{slot.startDate}</span>
                        <span className="text-muted-foreground">{slot.week}</span>
                      </div>
                      <div className="mt-2 font-medium">
                        {slot.startHH}-{slot.endHH}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-primary">¥{slot.Price}</span>
                        {!bookable && (
                          <span className="text-xs text-muted-foreground">
                            {slotUnavailableLabel(slot)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {bookingError && (
            <p className="text-sm text-red-500">{bookingError}</p>
          )}
          {!token && (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              预约咨询需先{" "}
              <Link href={`/login?redirect=${encodeURIComponent(consultationDetailPath(counselorId, source))}`} className="text-primary hover:underline">
                登录
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFavorite}
            disabled={favoriteLoading}
            aria-label="收藏"
          >
            <Heart className={cn("h-4 w-4", isFavorited && "fill-red-500 text-red-500")} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setContactOpen(true)}
            aria-label="联系助理"
          >
            <Headphones className="h-4 w-4" />
          </Button>
          <Button
            className="flex-1"
            disabled={!canProceedBooking}
            onClick={makeAppointment}
          >
            {canProceedBooking
              ? `立即预约 ¥${selectedSlot?.Price ?? priceYuan}`
              : "立即预约"}
          </Button>
        </div>
      </div>

      <ContactAssistantDialog open={contactOpen} onOpenChange={setContactOpen} />

      <BookingModals
        counselorName={counselor.name}
        selectedSlot={selectedSlot}
        centerId={selectedCenterId}
        showAge={showAge}
        showAgreement={showAgreement}
        showPayment={showPayment}
        agreementText={agreementText}
        emergencyContact={emergencyContact}
        onEmergencyContactChange={handleEmergencyContactChange}
        signaturePreview={signaturePreview}
        showSignaturePad={showSignaturePad}
        payRulesAgreed={payRulesAgreed}
        paying={paying}
        onCloseAge={() => setShowAge(false)}
        onConfirmAge={handleConfirmAge}
        onCloseAgreement={() => {
          setShowAgreement(false);
          resetSignature();
        }}
        onStartSignature={() => setShowSignaturePad(true)}
        onSignatureConfirm={handleSignatureConfirm}
        onSignatureCancel={() => setShowSignaturePad(false)}
        onConfirmAgreement={handleConfirmAgreement}
        onClosePayment={() => setShowPayment(false)}
        onTogglePayRules={() => setPayRulesAgreed((v) => !v)}
        onConfirmPayment={handleConfirmPayment}
      />
    </div>
  );
}
