import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  EmptyState,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";
import { formatMoneyFromCents } from "@/lib/format";
import {
  buildCounselorPercentPricingUpdate,
  calculateThreePartyShare,
  isIntegerDraft,
  normalizeIntegerDraft,
  parseIntegerDraft,
  type ThreePartySharePreview,
} from "@/lib/pricing";
import type {
  PricingBatchDefaultSharePayload,
  PricingBatchDefaultShareResult,
  PricingCounselorListResponse,
  PricingCounselorSummary,
  PricingCounselorUpdatePayload,
} from "@/types/api";

const MAX_BATCH_COUNSELOR_COUNT = 200;

export function PricingPanel({
  counselors,
  listLoading,
  counselorKeyword,
  setCounselorKeyword,
  onSearchCounselors,
  onResetCounselors,
  onSaveCounselor,
  onPreviewBatchShare,
  onApplyBatchShare,
  onBatchError,
}: {
  counselors?: PricingCounselorListResponse;
  listLoading: boolean;
  counselorKeyword: string;
  setCounselorKeyword: (value: string) => void;
  onSearchCounselors: () => void;
  onResetCounselors: () => void;
  onSaveCounselor: (counselor: PricingCounselorSummary, payload: PricingCounselorUpdatePayload) => Promise<void>;
  onPreviewBatchShare: (payload: PricingBatchDefaultSharePayload) => Promise<PricingBatchDefaultShareResult>;
  onApplyBatchShare: (payload: PricingBatchDefaultSharePayload) => Promise<PricingBatchDefaultShareResult>;
  onBatchError: (message: string) => void;
}) {
  const router = useRouter();
  const [editingCounselor, setEditingCounselor] = useState<PricingCounselorSummary | null>(null);
  const [selectedCounselorIds, setSelectedCounselorIds] = useState<number[]>([]);
  const [batchShareOpen, setBatchShareOpen] = useState(false);
  const visibleCounselorIds = useMemo(
    () => counselors?.items.map((item) => item.counselorId) || [],
    [counselors?.items],
  );
  const selectableVisibleCounselorIds = useMemo(
    () => visibleCounselorIds.slice(0, MAX_BATCH_COUNSELOR_COUNT),
    [visibleCounselorIds],
  );
  const allVisibleSelected =
    selectableVisibleCounselorIds.length > 0 &&
    selectableVisibleCounselorIds.every((id) => selectedCounselorIds.includes(id));

  useEffect(() => {
    setSelectedCounselorIds((current) => current.filter((id) => visibleCounselorIds.includes(id)));
  }, [visibleCounselorIds]);

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
              基础价格对该咨询师的全部来访生效；默认分成比例用于未单独设置个体分成的来访。点击「个体调价」进入该咨询师的来访调价页。
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
            <QueryButton
              disabled={selectedCounselorIds.length === 0}
              type="button"
              onClick={() => setBatchShareOpen(true)}
            >
              批量调整分成（{selectedCounselorIds.length}）
            </QueryButton>
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
                  <th className="w-12 px-5 py-3 font-medium">
                    <input
                      aria-label="选择全部咨询师"
                      checked={allVisibleSelected}
                      type="checkbox"
                      onChange={(event) => {
                        if (event.target.checked && visibleCounselorIds.length > MAX_BATCH_COUNSELOR_COUNT) {
                          onBatchError(`单次最多选择 ${MAX_BATCH_COUNSELOR_COUNT} 名咨询师，已选择列表前 ${MAX_BATCH_COUNSELOR_COUNT} 名`);
                        }
                        setSelectedCounselorIds(event.target.checked ? selectableVisibleCounselorIds : []);
                      }}
                    />
                  </th>
                  <th className="px-5 py-3 font-medium">咨询师</th>
                  <th className="px-5 py-3 font-medium">类型</th>
                  <th className="px-5 py-3 font-medium">基础价</th>
                  <th className="px-5 py-3 font-medium">三方默认分成</th>
                  <th className="px-5 py-3 font-medium">咨询师抽成比例</th>
                  <th className="px-5 py-3 font-medium">来访</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {counselors.items.map((item) => {
                  const defaultSharePercent = item.defaultSharePercent ?? 50;
                  const defaultShare = calculateThreePartyShare(item.basePriceYuan, defaultSharePercent);
                  return (
                    <tr key={item.counselorId} className="border-t border-[var(--lxxl-border)]">
                      <td className="px-5 py-4">
                        <input
                          aria-label={`选择${item.counselorName}`}
                          checked={selectedCounselorIds.includes(item.counselorId)}
                          type="checkbox"
                          onChange={(event) => {
                            if (
                              event.target.checked &&
                              !selectedCounselorIds.includes(item.counselorId) &&
                              selectedCounselorIds.length >= MAX_BATCH_COUNSELOR_COUNT
                            ) {
                              onBatchError(`单次最多选择 ${MAX_BATCH_COUNSELOR_COUNT} 名咨询师`);
                              return;
                            }
                            setSelectedCounselorIds((current) =>
                              event.target.checked
                                ? Array.from(new Set([...current, item.counselorId]))
                                : current.filter((id) => id !== item.counselorId),
                            );
                          }}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium">{item.counselorName}</div>
                        <div className="mt-1 text-xs text-[var(--lxxl-muted)]">编号 {item.counselorId}</div>
                      </td>
                      <td className="px-5 py-4">{item.counselorTypeLabel || "-"}</td>
                      <td className="px-5 py-4">{formatMoneyFromCents(item.basePriceCents)}</td>
                      <td className="px-5 py-4">
                        <ThreePartyShareCompact preview={defaultShare} hideHospital />
                      </td>
                      <td className="px-5 py-4">{defaultSharePercent}%</td>
                      <td className="px-5 py-4">
                        <div>咨询过 {item.patientCount} 人</div>
                        <div className="mt-1 text-xs text-[var(--lxxl-muted)]">已个体调价 {item.configuredPatientCount} 人</div>
                        {item.counselorType === "CHARITY" && (
                          <div className="mt-1 text-xs text-[var(--lxxl-muted)]">
                            公益完成 {item.completedConsultationCount ?? 0}/{item.charityNegotiationThreshold ?? 30} 次
                          </div>
                        )}
                        {item.needsNegotiation && (
                          <div className="mt-1 text-xs font-medium text-[#B45309]">未个体调价来访显示需议价</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-4">
                          <TableActionButton onClick={() => setEditingCounselor(item)}>基础配置</TableActionButton>
                          <TableActionButton
                            onClick={() => router.push(`/pricing/patients?counselorId=${item.counselorId}`)}
                          >
                            个体调价
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
      {batchShareOpen && (
        <BatchShareModal
          counselors={counselors?.items || []}
          counselorIds={selectedCounselorIds}
          onApply={async (payload) => {
            const result = await onApplyBatchShare(payload);
            setBatchShareOpen(false);
            setSelectedCounselorIds([]);
            return result;
          }}
          onClose={() => setBatchShareOpen(false)}
          onError={onBatchError}
          onPreview={onPreviewBatchShare}
        />
      )}
    </div>
  );
}

function BatchShareModal({
  counselors,
  counselorIds,
  onClose,
  onPreview,
  onApply,
  onError,
}: {
  counselors: PricingCounselorSummary[];
  counselorIds: number[];
  onClose: () => void;
  onPreview: (payload: PricingBatchDefaultSharePayload) => Promise<PricingBatchDefaultShareResult>;
  onApply: (payload: PricingBatchDefaultSharePayload) => Promise<PricingBatchDefaultShareResult>;
  onError: (message: string) => void;
}) {
  const [revenueSharePercentInput, setRevenueSharePercentInput] = useState("50");
  const [preview, setPreview] = useState<PricingBatchDefaultShareResult>();
  const [previewPayloadKey, setPreviewPayloadKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewRequestId = useRef(0);

  const revenueSharePercent = parseIntegerDraft(revenueSharePercentInput);
  const payload = useMemo<PricingBatchDefaultSharePayload>(
    () => ({ counselorIds, revenueSharePercent: revenueSharePercent ?? -1, overridePatientShares: true }),
    [counselorIds, revenueSharePercent],
  );
  const payloadKey = useMemo(() => batchSharePayloadKey(payload), [payload]);
  const previewIsCurrent = Boolean(preview) && previewPayloadKey === payloadKey;

  useEffect(() => {
    previewRequestId.current += 1;
    setPreview(undefined);
    setPreviewPayloadKey("");
    setLoading(false);
  }, [payloadKey]);

  function reportError(message: string) {
    setError(message);
    onError(message);
  }

  async function loadPreview() {
    if (counselorIds.length === 0 || counselorIds.length > MAX_BATCH_COUNSELOR_COUNT) {
      reportError(`单次需选择 1 到 ${MAX_BATCH_COUNSELOR_COUNT} 名咨询师`);
      return;
    }
    if (revenueSharePercent == null || revenueSharePercent < 0 || revenueSharePercent > 100) {
      reportError("分成比例需要在 0 到 100 之间");
      return;
    }
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;
    const requestedPayload = { ...payload, counselorIds: [...payload.counselorIds] };
    const requestedPayloadKey = batchSharePayloadKey(requestedPayload);
    setLoading(true);
    setError("");
    try {
      const result = await onPreview(requestedPayload);
      if (requestId !== previewRequestId.current) {
        return;
      }
      setPreview(result);
      setPreviewPayloadKey(requestedPayloadKey);
    } catch (err) {
      if (requestId === previewRequestId.current) {
        reportError(err instanceof Error ? err.message : "批量调整预览失败");
      }
    } finally {
      if (requestId === previewRequestId.current) {
        setLoading(false);
      }
    }
  }

  async function apply() {
    if (!previewIsCurrent || saving) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onApply(payload);
    } catch (err) {
      reportError(err instanceof Error ? err.message : "批量调整失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer closeDisabled={saving} title="批量调整咨询师分成比例" onClose={onClose}>
      <div className="space-y-5 px-6 py-5">
        <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm">
          已选择 <span className="font-semibold">{counselorIds.length}</span> 名咨询师
        </div>
        <QueryField label="新的咨询师默认分成比例" required>
          <div className="flex items-center gap-3">
            <input
              className={queryControlClass}
              inputMode="numeric"
              type="text"
              value={revenueSharePercentInput}
              disabled={saving}
              onBlur={() => setRevenueSharePercentInput((value) => normalizeIntegerDraft(value))}
              onChange={(event) => {
                if (isIntegerDraft(event.target.value, false)) {
                  setRevenueSharePercentInput(event.target.value);
                }
              }}
            />
            <span className="text-sm text-[var(--lxxl-muted)]">%</span>
          </div>
        </QueryField>
        <div className="rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] px-4 py-3 text-sm">
          <span>
            <span className="block font-medium">同步覆盖来访个体分成</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--lxxl-muted)]">
              与小程序单项调整规则一致：批量调整后，所选咨询师已有的来访个体分成配置会被清除，来访调价不会被清除。
            </span>
          </span>
        </div>

        <QueryButton disabled={loading || saving} onClick={loadPreview}>
          {loading ? "预览中" : "预览影响"}
        </QueryButton>

        {previewIsCurrent && preview && (
          <div className="space-y-3 rounded-xl border border-[var(--lxxl-border)] p-4 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ReadonlyInfo label="选择咨询师" value={preview.selectedCount} />
              <ReadonlyInfo label="实际变化" value={preview.changedCount} />
              <ReadonlyInfo label="个体分成配置" value={preview.patientShareOverrideCount} />
              <ReadonlyInfo label="将清除配置" value={preview.willClearPatientShareOverrideCount} />
            </div>
            <div className="max-h-60 overflow-y-auto rounded-lg bg-[#FAF8F4]">
              {preview.items.map((item) => {
                const beforePercent = resolveBatchBeforeSharePercent(item, counselors);
                const counselor = counselors.find((candidate) => candidate.counselorId === item.counselorId);
                const afterPercent = item.afterShare.revenueSharePercent ?? revenueSharePercent ?? 0;
                const share = calculateThreePartyShare(counselor?.basePriceYuan || 0, afterPercent);
                return (
                  <div className="border-b border-[var(--lxxl-border)] px-3 py-3 last:border-0" key={item.counselorId}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{item.counselorName}</span>
                      <span className="text-[var(--lxxl-muted)]">
                        咨询师 {beforePercent == null ? "系统默认" : `${beforePercent}%`} → {afterPercent}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <ThreePartySharePreviewCards preview={share} compact hideHospital />
                    </div>
                    {item.willClearPatientShareOverrideCount > 0 && (
                      <div className="mt-2 text-xs text-[#A46A22]">
                        将清除 {item.willClearPatientShareOverrideCount} 项个体分成配置
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-[#E7B8B2] bg-[#FFF5F3] px-4 py-3 text-sm text-[#A13F37]">{error}</div>
        )}
      </div>
      <DrawerFooter>
        <QueryButton disabled={!previewIsCurrent || loading || saving} onClick={apply}>
          {saving ? "提交中" : "确认批量调整"}
        </QueryButton>
        <QueryResetButton disabled={saving} onClick={onClose}>关闭</QueryResetButton>
      </DrawerFooter>
    </Drawer>
  );
}

function resolveBatchBeforeSharePercent(
  item: PricingBatchDefaultShareResult["items"][number],
  counselors: PricingCounselorSummary[],
) {
  if (item.beforeShare.revenueSharePercent != null) {
    return item.beforeShare.revenueSharePercent;
  }

  const counselor = counselors.find((candidate) => candidate.counselorId === item.counselorId);
  if (counselor?.defaultSharePercent != null) {
    return counselor.defaultSharePercent;
  }

  const revenueShareCents = item.beforeShare.revenueShareCents ?? counselor?.defaultRevenueShareCents;
  const basePriceCents = counselor?.basePriceCents;
  if (revenueShareCents != null && basePriceCents && basePriceCents > 0) {
    return Math.round((revenueShareCents * 100) / basePriceCents);
  }

  return null;
}

function batchSharePayloadKey(payload: PricingBatchDefaultSharePayload) {
  return JSON.stringify({
    counselorIds: [...payload.counselorIds].sort((left, right) => left - right),
    revenueSharePercent: payload.revenueSharePercent,
    overridePatientShares: true,
  });
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
  const [basePriceInput, setBasePriceInput] = useState(String(counselor.basePriceYuan));
  const [sharePercentInput, setSharePercentInput] = useState(String(counselor.defaultSharePercent ?? 50));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const basePriceYuan = parseIntegerDraft(basePriceInput);
  const sharePercent = parseIntegerDraft(sharePercentInput);
  const sharePreview = useMemo(
    () =>
      basePriceYuan == null ||
      basePriceYuan < 0 ||
      basePriceYuan > 99_999 ||
      sharePercent == null ||
      sharePercent < 0 ||
      sharePercent > 100
        ? undefined
        : calculateThreePartyShare(basePriceYuan, sharePercent),
    [basePriceYuan, sharePercent],
  );

  useEffect(() => {
    setBasePriceInput(String(counselor.basePriceYuan));
    setSharePercentInput(String(counselor.defaultSharePercent ?? 50));
    setError("");
  }, [counselor]);

  async function submit() {
    if (basePriceYuan == null || basePriceYuan < 0 || basePriceYuan > 99_999) {
      setError("请输入 0 到 99999 之间的整数基础价");
      return;
    }
    if (sharePercent == null || sharePercent < 0 || sharePercent > 100) {
      setError("默认分成比例需要在 0 到 100 之间");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(buildCounselorPercentPricingUpdate(basePriceYuan, sharePercent));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer closeDisabled={saving} title={`${counselor.counselorName} 基础配置`} onClose={onClose}>
      <div className="space-y-5 px-6 py-5">
        <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm leading-6 text-[var(--lxxl-muted)]">
          <p>
            <span className="font-medium text-[var(--lxxl-text)]">基础价格：</span>
            咨询师对所有来访端展示的价格，如果对个体价格单独做过设置那么该个体看到的是修改后的价格，而其余未做过个体价格调整的来访端显示的还是基础价格。
          </p>
          <p className="mt-2">
            <span className="font-medium text-[var(--lxxl-text)]">分成比例：</span>
            咨询师默认分成占来访可见价的比例，对未单独设置个体分成的来访生效；已个体调价并单独设置分成的来访不受此默认比例覆盖（除非批量调整时选择清除）。基础配置里的分成比例调整的是平台和咨询师之间的，如果包含医院分成比例需要进入个体调价里去调整分成比例。
          </p>
        </div>
        <QueryField label="基础价格（元，对全部来访生效）" required>
          <input
            className={queryControlClass}
            inputMode="numeric"
            type="text"
            value={basePriceInput}
            onBlur={() => setBasePriceInput((value) => normalizeIntegerDraft(value))}
            onChange={(event) => {
              if (isIntegerDraft(event.target.value, false)) {
                setBasePriceInput(event.target.value);
              }
            }}
          />
        </QueryField>
        <QueryField label="咨询师抽成比例（对未个体设置分成的来访生效）" required>
          <div className="flex items-center gap-3">
            <input
              className={queryControlClass}
              inputMode="numeric"
              type="text"
              value={sharePercentInput}
              onBlur={() => setSharePercentInput((value) => normalizeIntegerDraft(value))}
              onChange={(event) => {
                if (isIntegerDraft(event.target.value, false)) {
                  setSharePercentInput(event.target.value);
                }
              }}
            />
            <span className="shrink-0 text-sm text-[var(--lxxl-muted)]">%</span>
          </div>
        </QueryField>
        {sharePreview ? (
          <ThreePartySharePreviewCards preview={sharePreview} hideHospital />
        ) : (
          <div className="rounded-xl bg-[#FAF8F4] px-4 py-4 text-sm text-[var(--lxxl-muted)]">
            填写有效基础价和比例后显示分成预览。
          </div>
        )}
        <div className="text-xs leading-5 text-[var(--lxxl-muted)]">
          平台分成为来访可见价扣除咨询师分成后的余额。个体调价中的医院分成请在对应来访页面单独配置。
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

function ThreePartyShareCompact({
  preview,
  hideHospital = false,
}: {
  preview: ThreePartySharePreview;
  hideHospital?: boolean;
}) {
  return (
    <div className="space-y-1 text-xs leading-5">
      <div>
        <span className="text-[var(--lxxl-muted)]">咨询师分成</span>{" "}
        <span className="font-medium">¥{preview.counselorShareYuan}</span>
        <span className="text-[var(--lxxl-muted)]">（{formatPercent(preview.counselorSharePercent)}）</span>
      </div>
      <div>
        <span className="text-[var(--lxxl-muted)]">平台分成</span>{" "}
        <span>¥{preview.platformShareYuan}</span>
        <span className="text-[var(--lxxl-muted)]">（{formatPercent(preview.platformSharePercent)}）</span>
      </div>
      {!hideHospital && (
        <div>
          <span className="text-[var(--lxxl-muted)]">医院分成</span>{" "}
          <span>¥{preview.hospitalShareYuan}</span>
          <span className="text-[var(--lxxl-muted)]">（{formatPercent(preview.hospitalSharePercent)}）</span>
        </div>
      )}
    </div>
  );
}

function ThreePartySharePreviewCards({
  preview,
  compact = false,
  hideHospital = false,
}: {
  preview: ThreePartySharePreview;
  compact?: boolean;
  hideHospital?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-[#FAF8F4] ${compact ? "p-3" : "p-4"}`}>
      {!compact && (
        <div className="mb-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--lxxl-muted)]">来访可见价</span>
          <span className="text-lg font-semibold">¥{preview.displayPriceYuan}</span>
        </div>
      )}
      <div className={`grid grid-cols-1 gap-2 text-sm ${hideHospital ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <SharePreviewItem
          label="咨询师分成"
          percent={preview.counselorSharePercent}
          value={preview.counselorShareYuan}
        />
        <SharePreviewItem
          label="平台分成"
          percent={preview.platformSharePercent}
          value={preview.platformShareYuan}
        />
        {!hideHospital && (
          <SharePreviewItem
            label="医院分成"
            percent={preview.hospitalSharePercent}
            value={preview.hospitalShareYuan}
          />
        )}
      </div>
    </div>
  );
}

function SharePreviewItem({ label, percent, value }: { label: string; percent: number; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--lxxl-border)] bg-white px-3 py-2">
      <div className="text-xs text-[var(--lxxl-muted)]">{label}</div>
      <div className="mt-1 font-semibold">¥{value}</div>
      <div className="text-xs text-[var(--lxxl-muted)]">{formatPercent(percent)}</div>
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
          <TableActionButton disabled={closeDisabled} tone="muted" onClick={onClose}>关闭</TableActionButton>
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

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}
