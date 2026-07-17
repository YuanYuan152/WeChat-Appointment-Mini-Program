"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  EmptyState,
  Pagination,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";
import { formatMoneyFromCents } from "@/lib/format";
import { formatPatientNameWithContractTag, patientContractTag } from "@/lib/patientContract";
import {
  calculateThreePartyShareFromCents,
  isIntegerDraft,
  normalizeIntegerDraft,
  parseIntegerDraft,
  shareYuanFromPercent,
  threePartyFromCounselorAmount,
  threePartyFromHospitalAmount,
  threePartyFromPlatformAmount,
  type ThreePartySharePreview,
} from "@/lib/pricing";
import type {
  PricingPatientListResponse,
  PricingPatientRow,
  PricingPatientUpdatePayload,
} from "@/types/api";

export function PricingPatientsPanel({
  patients,
  patientLoading,
  patientKeyword,
  setPatientKeyword,
  page,
  pageSize,
  onSearchPatients,
  onResetPatients,
  onPageChange,
  onPageSizeChange,
  onSavePatient,
}: {
  patients?: PricingPatientListResponse;
  patientLoading: boolean;
  patientKeyword: string;
  setPatientKeyword: (value: string) => void;
  page: number;
  pageSize: number;
  onSearchPatients: () => void;
  onResetPatients: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSavePatient: (patient: PricingPatientRow, payload: PricingPatientUpdatePayload) => Promise<void>;
}) {
  const router = useRouter();
  const [editingPatient, setEditingPatient] = useState<PricingPatientRow | null>(null);
  const counselor = patients?.counselor;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
        <form
          className="px-6 py-5 sm:px-7 lg:px-8"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchPatients();
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm text-[var(--lxxl-muted)]">
                <button
                  className="text-[#315D4B] underline-offset-2 hover:underline"
                  type="button"
                  onClick={() => router.push("/pricing")}
                >
                  调价管理
                </button>
                <span className="mx-2">/</span>
                <span>个体调价</span>
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-normal">
                {counselor?.counselorName || "咨询师"} · 来访个体调价
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
                以下只展示该咨询师的来访。基础价格对该咨询师全部来访生效；调整金额与分成仅对当前来访生效。
                {counselor ? ` 当前统一基础价 ¥${counselor.basePriceYuan}。` : ""}
              </p>
            </div>
            <QueryResetButton onClick={() => router.push("/pricing")}>返回列表</QueryResetButton>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueryField label="来访者">
              <input
                className={queryControlClass}
                placeholder="姓名 / 手机 / 编号"
                value={patientKeyword}
                onChange={(event) => setPatientKeyword(event.target.value)}
              />
            </QueryField>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <QueryButton type="submit" />
            <QueryResetButton onClick={onResetPatients} />
          </div>
        </form>

        <div className="relative">
          {patientLoading && Boolean(patients?.items.length) && (
            <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
              正在加载来访列表...
            </div>
          )}
          {!patients || patients.items.length === 0 ? (
            <EmptyState text={patientLoading ? "正在加载来访列表..." : "暂无来访定价数据。"} />
          ) : (
            <>
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">来访者</th>
                    <th className="px-5 py-3 font-medium">历史咨询</th>
                    <th className="px-5 py-3 font-medium">基础价</th>
                    <th className="px-5 py-3 font-medium">调价</th>
                    <th className="px-5 py-3 font-medium">来访可见价</th>
                    <th className="px-5 py-3 font-medium">三方分成</th>
                    <th className="px-5 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.items.map((item) => {
                    const share = calculateThreePartyShareFromCents(
                      item.displayPriceCents,
                      item.revenueShareCents,
                    );
                    return (
                      <tr key={item.patientId} className="border-t border-[var(--lxxl-border)]">
                        <td className="px-5 py-4">
                          <div className="font-medium">{item.patientName}</div>
                          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                            {item.patientMobile || `编号 ${item.patientId}`}
                          </div>
                          {patientContractTag({
                            isContractSigned: item.isContractSigned,
                            boundCounselorName: item.boundCounselorName,
                            contractTag: item.contractTag,
                          }) && (
                            <div className="mt-1 text-xs font-medium text-[#315D4B]">
                              {patientContractTag({
                                isContractSigned: item.isContractSigned,
                                boundCounselorName: item.boundCounselorName,
                                contractTag: item.contractTag,
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div>平台完成 {item.totalCompletedConsultations} 次</div>
                          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                            当前咨询师 {item.counselorCompletedConsultations} 次
                          </div>
                        </td>
                        <td className="px-5 py-4">{formatMoneyFromCents(item.basePriceCents)}</td>
                        <td className="px-5 py-4">
                          <div>手动 {formatSignedYuan(item.manualAdjustmentYuan)}</div>
                          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                            {item.needsNegotiation
                              ? `${item.priceLabel || "需议价"}，调价后可预约`
                              : "无系统调价"}
                          </div>
                          {item.counselorType === "CHARITY" && (
                            <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                              公益完成{" "}
                              {item.completedCharityConsultationCount ?? item.lowPriceOrderCount}/
                              {item.charityNegotiationThreshold ?? 30} 次
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 font-medium">
                          {item.needsNegotiation ? (
                            <span className="text-[#B45309]">{item.priceLabel || "需议价"}</span>
                          ) : (
                            formatMoneyFromCents(item.displayPriceCents)
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <ThreePartyShareCompact preview={share} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <TableActionButton onClick={() => setEditingPatient(item)}>调价</TableActionButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={patients.total}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </>
          )}
        </div>
      </section>

      {editingPatient && (
        <PatientPricingModal
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onSave={async (payload) => {
            await onSavePatient(editingPatient, payload);
            setEditingPatient(null);
          }}
        />
      )}
    </div>
  );
}

function PatientPricingModal({
  patient,
  onClose,
  onSave,
}: {
  patient: PricingPatientRow;
  onClose: () => void;
  onSave: (payload: PricingPatientUpdatePayload) => Promise<void>;
}) {
  const initialShare = useMemo(() => {
    const display = Math.max(
      0,
      patient.basePriceYuan + patient.autoAdjustmentYuan + patient.manualAdjustmentYuan,
    );
    return threePartyFromCounselorAmount(display, patient.revenueShareYuan, 0);
  }, [patient]);

  const [adjustmentInput, setAdjustmentInput] = useState(String(patient.manualAdjustmentYuan));
  const [counselorPercentInput, setCounselorPercentInput] = useState(
    String(Math.round(initialShare.counselorSharePercent)),
  );
  const [counselorYuanInput, setCounselorYuanInput] = useState(String(initialShare.counselorShareYuan));
  const [platformPercentInput, setPlatformPercentInput] = useState(
    String(Math.round(initialShare.platformSharePercent)),
  );
  const [platformYuanInput, setPlatformYuanInput] = useState(String(initialShare.platformShareYuan));
  const [hospitalPercentInput, setHospitalPercentInput] = useState(
    String(Math.round(initialShare.hospitalSharePercent)),
  );
  const [hospitalYuanInput, setHospitalYuanInput] = useState(String(initialShare.hospitalShareYuan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const adjustmentYuan = parseIntegerDraft(adjustmentInput);
  const displayPriceYuan = useMemo(
    () =>
      adjustmentYuan == null
        ? undefined
        : Math.max(0, patient.basePriceYuan + patient.autoAdjustmentYuan + adjustmentYuan),
    [adjustmentYuan, patient.autoAdjustmentYuan, patient.basePriceYuan],
  );

  const sharePreview: ThreePartySharePreview | undefined = useMemo(() => {
    if (displayPriceYuan == null) {
      return undefined;
    }
    const counselorYuan = parseIntegerDraft(counselorYuanInput);
    const hospitalYuan = parseIntegerDraft(hospitalYuanInput);
    if (counselorYuan == null || hospitalYuan == null) {
      return undefined;
    }
    return threePartyFromCounselorAmount(displayPriceYuan, counselorYuan, hospitalYuan);
  }, [counselorYuanInput, displayPriceYuan, hospitalYuanInput]);

  useEffect(() => {
    const display = Math.max(
      0,
      patient.basePriceYuan + patient.autoAdjustmentYuan + patient.manualAdjustmentYuan,
    );
    const next = threePartyFromCounselorAmount(display, patient.revenueShareYuan, 0);
    setAdjustmentInput(String(patient.manualAdjustmentYuan));
    setCounselorPercentInput(String(Math.round(next.counselorSharePercent)));
    setCounselorYuanInput(String(next.counselorShareYuan));
    setPlatformPercentInput(String(Math.round(next.platformSharePercent)));
    setPlatformYuanInput(String(next.platformShareYuan));
    setHospitalPercentInput(String(Math.round(next.hospitalSharePercent)));
    setHospitalYuanInput(String(next.hospitalShareYuan));
    setError("");
  }, [patient]);

  function applyShare(preview: ThreePartySharePreview) {
    setCounselorPercentInput(String(Math.round(preview.counselorSharePercent)));
    setCounselorYuanInput(String(preview.counselorShareYuan));
    setPlatformPercentInput(String(Math.round(preview.platformSharePercent)));
    setPlatformYuanInput(String(preview.platformShareYuan));
    setHospitalPercentInput(String(Math.round(preview.hospitalSharePercent)));
    setHospitalYuanInput(String(preview.hospitalShareYuan));
  }

  function syncAfterAdjustment(nextAdjustment: string) {
    setAdjustmentInput(nextAdjustment);
    const nextAdj = parseIntegerDraft(nextAdjustment);
    if (nextAdj == null) {
      return;
    }
    const display = Math.max(0, patient.basePriceYuan + patient.autoAdjustmentYuan + nextAdj);
    const counselorPercent = parseIntegerDraft(counselorPercentInput) ?? 0;
    const hospitalYuan = parseIntegerDraft(hospitalYuanInput) ?? 0;
    applyShare(
      threePartyFromCounselorAmount(display, shareYuanFromPercent(counselorPercent, display), hospitalYuan),
    );
  }

  async function submit() {
    if (adjustmentYuan == null || adjustmentYuan < -99_999 || adjustmentYuan > 99_999) {
      setError("手动调价需为 -99999 到 99999 之间的整数");
      return;
    }
    if (!sharePreview) {
      setError("请填写有效的分成比例或金额");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        adjustmentYuan,
        shareMode: "AMOUNT",
        revenueShareYuan: sharePreview.counselorShareYuan,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      closeDisabled={saving}
      title={`${formatPatientNameWithContractTag(patient.patientName, patient.patientContractTag || patient.contractTag)} 个体调价`}
      onClose={onClose}
    >
      <div className="space-y-5 px-6 py-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <ReadonlyInfo label="咨询师" value={patient.counselorName} />
          <ReadonlyInfo
            label="来访者"
            value={`${formatPatientNameWithContractTag(patient.patientName, patient.patientContractTag || patient.contractTag)}${
              patient.patientMobile ? `（${patient.patientMobile}）` : ""
            }`}
          />
          <ReadonlyInfo label="基础价格（所有来访生效）" value={`¥${patient.basePriceYuan}`} />
          <ReadonlyInfo
            label="系统状态"
            value={patient.needsNegotiation ? patient.priceLabel || "需议价" : "无系统调价"}
          />
        </div>

        {patient.autoAdjustmentYuan ? (
          <ReadonlyInfo label="系统调价" value={`+¥${patient.autoAdjustmentYuan}`} />
        ) : null}

        <QueryField label="调整金额（对当前来访生效）" required>
          <input
            className={queryControlClass}
            inputMode="numeric"
            placeholder="例如：20 或 -20"
            type="text"
            value={adjustmentInput}
            onBlur={() => setAdjustmentInput((value) => normalizeIntegerDraft(value))}
            onChange={(event) => {
              if (isIntegerDraft(event.target.value, true)) {
                syncAfterAdjustment(event.target.value);
              }
            }}
          />
        </QueryField>

        <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--lxxl-muted)]">显示价格（预览）</span>
            <span className="text-lg font-semibold text-[#315D4B]">
              {displayPriceYuan == null ? "—" : `¥${displayPriceYuan}`}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--lxxl-border)]">
          <div className="grid grid-cols-[5rem_1fr_1fr] gap-3 bg-[#FAF8F4] px-4 py-3 text-xs font-medium text-[var(--lxxl-muted)]">
            <span>分成</span>
            <span>分成比例</span>
            <span>分成金额</span>
          </div>
          <EditableShareRow
            label="平台"
            percentInput={platformPercentInput}
            yuanInput={platformYuanInput}
            onPercentChange={(value) => {
              setPlatformPercentInput(value);
              if (displayPriceYuan == null) return;
              const percent = parseIntegerDraft(value);
              if (percent == null) return;
              const hospitalYuan = parseIntegerDraft(hospitalYuanInput) ?? 0;
              applyShare(
                threePartyFromPlatformAmount(
                  displayPriceYuan,
                  shareYuanFromPercent(percent, displayPriceYuan),
                  hospitalYuan,
                ),
              );
            }}
            onYuanChange={(value) => {
              setPlatformYuanInput(value);
              if (displayPriceYuan == null) return;
              const yuan = parseIntegerDraft(value);
              if (yuan == null) return;
              const hospitalYuan = parseIntegerDraft(hospitalYuanInput) ?? 0;
              applyShare(threePartyFromPlatformAmount(displayPriceYuan, yuan, hospitalYuan));
            }}
          />
          <EditableShareRow
            label="咨询师"
            percentInput={counselorPercentInput}
            yuanInput={counselorYuanInput}
            onPercentChange={(value) => {
              setCounselorPercentInput(value);
              if (displayPriceYuan == null) return;
              const percent = parseIntegerDraft(value);
              if (percent == null) return;
              const hospitalYuan = parseIntegerDraft(hospitalYuanInput) ?? 0;
              applyShare(
                threePartyFromCounselorAmount(
                  displayPriceYuan,
                  shareYuanFromPercent(percent, displayPriceYuan),
                  hospitalYuan,
                ),
              );
            }}
            onYuanChange={(value) => {
              setCounselorYuanInput(value);
              if (displayPriceYuan == null) return;
              const yuan = parseIntegerDraft(value);
              if (yuan == null) return;
              const hospitalYuan = parseIntegerDraft(hospitalYuanInput) ?? 0;
              applyShare(threePartyFromCounselorAmount(displayPriceYuan, yuan, hospitalYuan));
            }}
          />
          <EditableShareRow
            label="医院"
            percentInput={hospitalPercentInput}
            yuanInput={hospitalYuanInput}
            onPercentChange={(value) => {
              setHospitalPercentInput(value);
              if (displayPriceYuan == null) return;
              const percent = parseIntegerDraft(value);
              if (percent == null) return;
              const counselorYuan = parseIntegerDraft(counselorYuanInput) ?? 0;
              applyShare(
                threePartyFromHospitalAmount(
                  displayPriceYuan,
                  shareYuanFromPercent(percent, displayPriceYuan),
                  counselorYuan,
                ),
              );
            }}
            onYuanChange={(value) => {
              setHospitalYuanInput(value);
              if (displayPriceYuan == null) return;
              const yuan = parseIntegerDraft(value);
              if (yuan == null) return;
              const counselorYuan = parseIntegerDraft(counselorYuanInput) ?? 0;
              applyShare(threePartyFromHospitalAmount(displayPriceYuan, yuan, counselorYuan));
            }}
          />
        </div>

        <div className="text-xs leading-5 text-[var(--lxxl-muted)]">
          三方分成比例与金额可联动编辑，总和等于显示价格；保存时写入当前来访的咨询师分成金额（与小程序一致）。
        </div>
        {error && (
          <div className="rounded-xl border border-[#E7B8B2] bg-[#FFF5F3] px-4 py-3 text-sm text-[#A13F37]">
            {error}
          </div>
        )}
      </div>
      <DrawerFooter>
        <QueryButton disabled={saving} onClick={submit}>
          {saving ? "保存中" : "保存"}
        </QueryButton>
        <QueryResetButton disabled={saving} onClick={onClose}>
          取消
        </QueryResetButton>
      </DrawerFooter>
    </Drawer>
  );
}

function EditableShareRow({
  label,
  percentInput,
  yuanInput,
  onPercentChange,
  onYuanChange,
}: {
  label: string;
  percentInput: string;
  yuanInput: string;
  onPercentChange: (value: string) => void;
  onYuanChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-[5rem_1fr_1fr] items-center gap-3 border-t border-[var(--lxxl-border)] px-4 py-3">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <input
          className={queryControlClass}
          inputMode="numeric"
          type="text"
          value={percentInput}
          onBlur={() => onPercentChange(normalizeIntegerDraft(percentInput))}
          onChange={(event) => {
            if (isIntegerDraft(event.target.value, false)) {
              onPercentChange(event.target.value);
            }
          }}
        />
        <span className="shrink-0 text-sm text-[var(--lxxl-muted)]">%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm text-[var(--lxxl-muted)]">¥</span>
        <input
          className={queryControlClass}
          inputMode="numeric"
          type="text"
          value={yuanInput}
          onBlur={() => onYuanChange(normalizeIntegerDraft(yuanInput))}
          onChange={(event) => {
            if (isIntegerDraft(event.target.value, false)) {
              onYuanChange(event.target.value);
            }
          }}
        />
      </div>
    </div>
  );
}

function ThreePartyShareCompact({
  preview,
}: {
  preview: ReturnType<typeof calculateThreePartyShareFromCents>;
}) {
  return (
    <div className="space-y-1 text-xs leading-5">
      <div>
        <span className="text-[var(--lxxl-muted)]">平台</span>{" "}
        <span>{formatMoneyFromCents(preview.platformShareCents)}</span>
      </div>
      <div>
        <span className="text-[var(--lxxl-muted)]">咨询师</span>{" "}
        <span className="font-medium">{formatMoneyFromCents(preview.counselorShareCents)}</span>
      </div>
      <div>
        <span className="text-[var(--lxxl-muted)]">医院</span>{" "}
        <span>{formatMoneyFromCents(preview.hospitalShareCents)}</span>
      </div>
    </div>
  );
}

function Drawer({
  title,
  children,
  onClose,
  closeDisabled = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--lxxl-border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <TableActionButton disabled={closeDisabled} tone="muted" onClick={onClose}>
            关闭
          </TableActionButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function DrawerFooter({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 border-t border-[var(--lxxl-border)] bg-white px-6 py-4">{children}</div>;
}

function ReadonlyInfo({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[#FAF8F4] px-4 py-3">
      <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function formatSignedYuan(value: number) {
  if (value > 0) {
    return `+¥${value}`;
  }
  if (value < 0) {
    return `-¥${Math.abs(value)}`;
  }
  return "¥0";
}
