import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

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
import type {
  PricingCounselorListResponse,
  PricingCounselorSummary,
  PricingCounselorUpdatePayload,
  PricingPatientListResponse,
  PricingPatientRow,
  PricingPatientUpdatePayload,
} from "@/types/api";

export function PricingPanel({
  counselors,
  patients,
  listLoading,
  patientLoading,
  counselorKeyword,
  setCounselorKeyword,
  patientKeyword,
  setPatientKeyword,
  selectedCounselorId,
  page,
  pageSize,
  onSearchCounselors,
  onResetCounselors,
  onSelectCounselor,
  onSearchPatients,
  onResetPatients,
  onPageChange,
  onPageSizeChange,
  onSaveCounselor,
  onSavePatient,
}: {
  counselors?: PricingCounselorListResponse;
  patients?: PricingPatientListResponse;
  listLoading: boolean;
  patientLoading: boolean;
  counselorKeyword: string;
  setCounselorKeyword: (value: string) => void;
  patientKeyword: string;
  setPatientKeyword: (value: string) => void;
  selectedCounselorId: number | null;
  page: number;
  pageSize: number;
  onSearchCounselors: () => void;
  onResetCounselors: () => void;
  onSelectCounselor: (counselorId: number) => void;
  onSearchPatients: () => void;
  onResetPatients: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSaveCounselor: (counselor: PricingCounselorSummary, payload: PricingCounselorUpdatePayload) => Promise<void>;
  onSavePatient: (patient: PricingPatientRow, payload: PricingPatientUpdatePayload) => Promise<void>;
}) {
  const [editingCounselor, setEditingCounselor] = useState<PricingCounselorSummary | null>(null);
  const [editingPatient, setEditingPatient] = useState<PricingPatientRow | null>(null);
  const selectedCounselor = counselors?.items.find((item) => item.counselorId === selectedCounselorId);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
        <form
          className="px-6 py-5 sm:px-7 lg:px-8"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchCounselors();
          }}
        >
          <div>
            <h2 className="text-xl font-semibold tracking-normal">调价管理</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
              基础价和分成金额按元保存；页面按比例辅助填写，保存时会换算成咨询师分成金额。
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueryField label="咨询师">
              <input
                className={queryControlClass}
                placeholder="姓名 / 类型 / 编号"
                value={counselorKeyword}
                onChange={(event) => setCounselorKeyword(event.target.value)}
              />
            </QueryField>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <QueryButton type="submit" />
            <QueryResetButton onClick={onResetCounselors} />
          </div>
        </form>

        <div className="relative">
          {listLoading && Boolean(counselors?.items.length) && (
            <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
              正在加载咨询师...
            </div>
          )}
          {!counselors || counselors.items.length === 0 ? (
            <EmptyState text={listLoading ? "正在加载咨询师..." : "暂无咨询师定价数据。"} />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">咨询师</th>
                  <th className="px-5 py-3 font-medium">类型</th>
                  <th className="px-5 py-3 font-medium">基础价</th>
                  <th className="px-5 py-3 font-medium">默认分成</th>
                  <th className="px-5 py-3 font-medium">分成比例</th>
                  <th className="px-5 py-3 font-medium">来访</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {counselors.items.map((item) => {
                  const active = item.counselorId === selectedCounselorId;
                  return (
                    <tr
                      key={item.counselorId}
                      className={`border-t border-[var(--lxxl-border)] ${active ? "bg-[#F5F8F6]" : ""}`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium">{item.counselorName}</div>
                        <div className="mt-1 text-xs text-[var(--lxxl-muted)]">编号 {item.counselorId}</div>
                      </td>
                      <td className="px-5 py-4">{item.counselorTypeLabel || "-"}</td>
                      <td className="px-5 py-4">{formatMoneyFromCents(item.basePriceCents)}</td>
                      <td className="px-5 py-4">{formatMoneyFromCents(item.defaultRevenueShareCents)}</td>
                      <td className="px-5 py-4">{item.defaultSharePercent ?? 0}%</td>
                      <td className="px-5 py-4">
                        <div>咨询过 {item.patientCount}</div>
                        <div className="mt-1 text-xs text-[var(--lxxl-muted)]">已个体调价 {item.configuredPatientCount}</div>
                        {item.counselorType === "CHARITY" && (
                          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                            公益完成 {item.completedConsultationCount ?? 0}/{item.charityNegotiationThreshold ?? 30}
                          </div>
                        )}
                        {item.needsNegotiation && (
                          <div className="mt-1 text-xs font-medium text-[#B45309]">未个体调价来访显示需议价</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-4">
                          <TableActionButton onClick={() => setEditingCounselor(item)}>基础配置</TableActionButton>
                          <TableActionButton onClick={() => onSelectCounselor(item.counselorId)}>
                            {active ? "已选择" : "个体调价"}
                          </TableActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
        <form
          className="px-6 py-5 sm:px-7 lg:px-8"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchPatients();
          }}
        >
          <div>
            <h2 className="text-xl font-semibold tracking-normal">来访个体调价</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
              {selectedCounselor
                ? `${selectedCounselor.counselorName}：可按来访单独调整显示价格和咨询师分成。`
                : "请先在上方选择咨询师。"}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueryField label="来访者">
              <input
                className={queryControlClass}
                placeholder="姓名 / 手机 / 编号"
                value={patientKeyword}
                disabled={!selectedCounselorId}
                onChange={(event) => setPatientKeyword(event.target.value)}
              />
            </QueryField>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <QueryButton type="submit" disabled={!selectedCounselorId} />
            <QueryResetButton disabled={!selectedCounselorId} onClick={onResetPatients} />
          </div>
        </form>

        <div className="relative">
          {patientLoading && Boolean(patients?.items.length) && (
            <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
              正在加载来访列表...
            </div>
          )}
          {!selectedCounselorId ? (
            <EmptyState text="请先选择一个咨询师。" />
          ) : !patients || patients.items.length === 0 ? (
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
                    <th className="px-5 py-3 font-medium">咨询师分成</th>
                    <th className="px-5 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.items.map((item) => (
                    <tr key={item.patientId} className="border-t border-[var(--lxxl-border)]">
                      <td className="px-5 py-4">
                        <div className="font-medium">{item.patientName}</div>
                        <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{item.patientMobile || `编号 ${item.patientId}`}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div>平台完成 {item.totalCompletedConsultations}</div>
                        <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                          当前咨询师 {item.counselorCompletedConsultations}
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
                            公益完成 {item.completedCharityConsultationCount ?? item.lowPriceOrderCount}/{item.charityNegotiationThreshold ?? 30}
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
                        <div>{formatMoneyFromCents(item.revenueShareCents)}</div>
                        <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                          {item.displayPriceYuan > 0 ? `${Math.round((item.revenueShareYuan * 100) / item.displayPriceYuan)}%` : "0%"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <TableActionButton onClick={() => setEditingPatient(item)}>调价</TableActionButton>
                      </td>
                    </tr>
                  ))}
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

      {editingCounselor && (
        <CounselorPricingModal
          counselor={editingCounselor}
          onClose={() => setEditingCounselor(null)}
          onSave={async (payload) => {
            await onSaveCounselor(editingCounselor, payload);
            setEditingCounselor(null);
          }}
        />
      )}
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

function CounselorPricingModal({
  counselor,
  onClose,
  onSave,
}: {
  counselor: PricingCounselorSummary;
  onClose: () => void;
  onSave: (payload: PricingCounselorUpdatePayload) => Promise<void>;
}) {
  const [basePriceYuan, setBasePriceYuan] = useState(counselor.basePriceYuan);
  const [sharePercent, setSharePercent] = useState(counselor.defaultSharePercent ?? 50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const defaultRevenueShareYuan = useMemo(
    () => Math.min(basePriceYuan, Math.round((basePriceYuan * sharePercent) / 100)),
    [basePriceYuan, sharePercent],
  );

  useEffect(() => {
    setBasePriceYuan(counselor.basePriceYuan);
    setSharePercent(counselor.defaultSharePercent ?? 50);
    setError("");
  }, [counselor]);

  async function submit() {
    if (basePriceYuan < 0) {
      setError("基础价不能为负数");
      return;
    }
    if (sharePercent < 0 || sharePercent > 100) {
      setError("默认分成比例需要在 0 到 100 之间");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ basePriceYuan, defaultRevenueShareYuan });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer title={`${counselor.counselorName} 基础配置`} onClose={onClose}>
      <div className="space-y-5 px-6 py-5">
        <QueryField label="基础价格（元）" required>
          <input
            className={queryControlClass}
            min={0}
            type="number"
            value={basePriceYuan}
            onChange={(event) => setBasePriceYuan(Number(event.target.value || 0))}
          />
        </QueryField>
        <QueryField label="默认分成比例" required>
          <div className="flex items-center gap-3">
            <input
              className={queryControlClass}
              max={100}
              min={0}
              type="number"
              value={sharePercent}
              onChange={(event) => setSharePercent(Number(event.target.value || 0))}
            />
            <span className="shrink-0 text-sm text-[var(--lxxl-muted)]">%</span>
          </div>
        </QueryField>
        <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm leading-6">
          <div className="text-[var(--lxxl-muted)]">实际保存的默认分成金额</div>
          <div className="mt-1 text-lg font-semibold">¥{defaultRevenueShareYuan}</div>
          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
            例如基础价 600，分成 50%，会保存为咨询师分成 300。
          </div>
        </div>
        {error && <div className="rounded-xl border border-[#E7B8B2] bg-[#FFF5F3] px-4 py-3 text-sm text-[#A13F37]">{error}</div>}
      </div>
      <DrawerFooter>
        <QueryButton disabled={saving} onClick={submit}>
          {saving ? "保存中" : "保存"}
        </QueryButton>
        <QueryResetButton disabled={saving} onClick={onClose}>
          关闭
        </QueryResetButton>
      </DrawerFooter>
    </Drawer>
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
  const initialPercent = patient.displayPriceYuan > 0
    ? Math.round((patient.revenueShareYuan * 100) / patient.displayPriceYuan)
    : 0;
  const [adjustmentYuan, setAdjustmentYuan] = useState(patient.manualAdjustmentYuan);
  const [sharePercent, setSharePercent] = useState(initialPercent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const displayPriceYuan = useMemo(
    () => Math.max(0, patient.basePriceYuan + patient.autoAdjustmentYuan + adjustmentYuan),
    [adjustmentYuan, patient.autoAdjustmentYuan, patient.basePriceYuan],
  );
  const revenueShareYuan = useMemo(
    () => Math.min(displayPriceYuan, Math.round((displayPriceYuan * sharePercent) / 100)),
    [displayPriceYuan, sharePercent],
  );

  useEffect(() => {
    setAdjustmentYuan(patient.manualAdjustmentYuan);
    setSharePercent(patient.displayPriceYuan > 0 ? Math.round((patient.revenueShareYuan * 100) / patient.displayPriceYuan) : 0);
    setError("");
  }, [patient]);

  async function submit() {
    if (sharePercent < 0 || sharePercent > 100) {
      setError("分成比例需要在 0 到 100 之间");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        adjustmentYuan,
        shareMode: "AMOUNT",
        revenueShareYuan,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer title={`${patient.patientName} 个体调价`} onClose={onClose}>
      <div className="space-y-5 px-6 py-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <ReadonlyInfo label="咨询师" value={patient.counselorName} />
          <ReadonlyInfo label="来访者" value={patient.patientMobile || patient.patientName} />
          <ReadonlyInfo label="基础价" value={`¥${patient.basePriceYuan}`} />
          <ReadonlyInfo label="系统状态" value={patient.needsNegotiation ? (patient.priceLabel || "需议价") : "无系统调价"} />
        </div>
        <QueryField label="手动调价（元，可正可负）" required>
          <input
            className={queryControlClass}
            type="number"
            value={adjustmentYuan}
            onChange={(event) => setAdjustmentYuan(Number(event.target.value || 0))}
          />
        </QueryField>
        <QueryField label="咨询师分成比例" required>
          <div className="flex items-center gap-3">
            <input
              className={queryControlClass}
              max={100}
              min={0}
              type="number"
              value={sharePercent}
              onChange={(event) => setSharePercent(Number(event.target.value || 0))}
            />
            <span className="shrink-0 text-sm text-[var(--lxxl-muted)]">%</span>
          </div>
        </QueryField>
        <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm leading-6">
          <div className="grid grid-cols-2 gap-3">
            <ReadonlyInfo label="来访可见价" value={`¥${displayPriceYuan}`} />
            <ReadonlyInfo label="实际保存分成" value={`¥${revenueShareYuan}`} />
          </div>
          <div className="mt-2 text-xs text-[var(--lxxl-muted)]">数据库保存为分成金额，不保存比例。</div>
        </div>
        {error && <div className="rounded-xl border border-[#E7B8B2] bg-[#FFF5F3] px-4 py-3 text-sm text-[#A13F37]">{error}</div>}
      </div>
      <DrawerFooter>
        <QueryButton disabled={saving} onClick={submit}>
          {saving ? "保存中" : "保存"}
        </QueryButton>
        <QueryResetButton disabled={saving} onClick={onClose}>
          关闭
        </QueryResetButton>
      </DrawerFooter>
    </Drawer>
  );
}

function Drawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--lxxl-border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <TableActionButton tone="muted" onClick={onClose}>关闭</TableActionButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function DrawerFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-[var(--lxxl-border)] bg-white px-6 py-4">
      {children}
    </div>
  );
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
