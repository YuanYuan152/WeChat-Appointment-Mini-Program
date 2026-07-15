import { memo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import { formatDateTime, formatMoneyFromCents, statusLabel } from "@/lib/format";
import type { PagedResult, ProxyPersonOption, UserBoardDetail, UserBoardSummary } from "@/types/api";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import {
  Badge,
  CollapsibleSection,
  DetailList,
  EmptyState,
  MiniStat,
  Pagination,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";
import type { UserBoardFilters } from "@/types/app";
import { roleText } from "@/lib/display";
import { patientContractTag } from "@/lib/patientContract";

export interface UserProxyBookingTarget {
  patientId: number;
  patientName: string;
  patientMobile?: string | null;
}

export function UserBoardPanel({
  users,
  listLoading,
  selected,
  detailLoading,
  filters,
  setFilters,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
  onOpen,
  onCloseDetail,
  onProxyBooking,
  onSearchCounselors,
  onBindCounselor,
}: {
  users?: PagedResult<UserBoardSummary>;
  listLoading: boolean;
  selected?: UserBoardDetail;
  detailLoading: boolean;
  filters: UserBoardFilters;
  setFilters: Dispatch<SetStateAction<UserBoardFilters>>;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (accountId: number) => void;
  onCloseDetail: () => void;
  onProxyBooking?: (target: UserProxyBookingTarget) => void;
  onSearchCounselors?: (keyword: string) => Promise<ProxyPersonOption[]>;
  onBindCounselor?: (patientId: number, counselorId: number | null) => Promise<void>;
}) {
  return (
    <>
      <UserBoardListSection
        filters={filters}
        listLoading={listLoading}
        onOpen={onOpen}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onReset={onReset}
        onSearch={onSearch}
        setFilters={setFilters}
        users={users}
      />
      {(detailLoading || selected) && (
        <DetailDrawer title="用户详情" onClose={onCloseDetail}>
          {detailLoading && !selected ? (
            <div className="py-10 text-sm text-[var(--lxxl-muted)]">正在加载详情...</div>
          ) : selected ? (
            <UserDetailPanel
              detail={selected}
              onBindCounselor={onBindCounselor}
              onProxyBooking={onProxyBooking}
              onSearchCounselors={onSearchCounselors}
            />
          ) : null}
        </DetailDrawer>
      )}
    </>
  );
}

const UserBoardListSection = memo(function UserBoardListSection({
  users,
  listLoading,
  filters,
  setFilters,
  onSearch,
  onReset,
  onPageChange,
  onPageSizeChange,
  onOpen,
}: {
  users?: PagedResult<UserBoardSummary>;
  listLoading: boolean;
  filters: UserBoardFilters;
  setFilters: Dispatch<SetStateAction<UserBoardFilters>>;
  onSearch: () => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (accountId: number) => void;
}) {
  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] bg-white">
      <form
        className="px-6 py-5 sm:px-7 lg:px-8"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div>
          <h2 className="text-xl font-semibold tracking-normal">用户管理</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            按用户聚合订单、退款、豁免、预约和咨询室预约记录。
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QueryField label="姓名/昵称">
            <input
              className={queryControlClass}
              placeholder="请输入"
              value={filters.keyword}
              onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
            />
          </QueryField>
          <QueryField label="电话">
            <input
              className={queryControlClass}
              placeholder="请输入"
              value={filters.mobile}
              onChange={(event) => setFilters((prev) => ({ ...prev, mobile: event.target.value }))}
            />
          </QueryField>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <QueryButton type="submit" />
          <QueryResetButton onClick={onReset} />
        </div>
      </form>
      <div className="relative">
        {listLoading && users && users.items.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 border-t border-[var(--lxxl-border)] bg-white/80 px-5 py-3 text-sm text-[var(--lxxl-muted)] backdrop-blur-sm">
            正在加载列表...
          </div>
        )}
        {!users || users.items.length === 0 ? (
          <EmptyState text={listLoading ? "正在加载列表..." : "暂无用户数据。"} />
        ) : (
          <>
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">用户</th>
                  <th className="px-5 py-3 font-medium">手机</th>
                  <th className="px-5 py-3 font-medium">订单/金额</th>
                  <th className="px-5 py-3 font-medium">预约</th>
                  <th className="px-5 py-3 font-medium">退款/豁免</th>
                  <th className="px-5 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.items.map((user) => (
                  <tr key={user.id} className="border-t border-[var(--lxxl-border)]">
                    <td className="px-5 py-4">
                      <div className="font-medium">{user.name}</div>
                      <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{roleText(user.roles)}</div>
                      {patientContractTag(user) && (
                        <div className="mt-1 text-xs font-medium text-[#315D4B]">{patientContractTag(user)}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">{user.mobile || "-"}</td>
                    <td className="px-5 py-4">
                      {user.orderCount} / {formatMoneyFromCents(user.paidAmount)}
                    </td>
                    <td className="px-5 py-4">
                      总 {user.consultationCount}，完成 {user.completedConsultationCount}，取消{" "}
                      {user.cancelledConsultationCount}
                    </td>
                    <td className="px-5 py-4">
                      退款 {user.refundCount}，豁免 {user.exemptionCount}
                    </td>
                    <td className="px-5 py-4">
                      <TableActionButton onClick={() => onOpen(user.id)}>
                        查看
                      </TableActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={users.page}
              pageSize={users.pageSize}
              total={users.total}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </div>
    </section>
  );
});

function UserDetailPanel({
  detail,
  onProxyBooking,
  onSearchCounselors,
  onBindCounselor,
}: {
  detail: UserBoardDetail;
  onProxyBooking?: (target: UserProxyBookingTarget) => void;
  onSearchCounselors?: (keyword: string) => Promise<ProxyPersonOption[]>;
  onBindCounselor?: (patientId: number, counselorId: number | null) => Promise<void>;
}) {
  const [bindOpen, setBindOpen] = useState(false);
  const [bindKeyword, setBindKeyword] = useState("");
  const [bindOptions, setBindOptions] = useState<ProxyPersonOption[]>([]);
  const [selectedCounselorId, setSelectedCounselorId] = useState<number | null>(null);
  const [bindLoading, setBindLoading] = useState(false);
  const [bindSaving, setBindSaving] = useState(false);
  const [bindError, setBindError] = useState("");
  const [bindPrompt, setBindPrompt] = useState("");
  const bindSearchSeq = useRef(0);
  const canProxyBooking = detail.profile.isVisitor === true;
  const contractTag = patientContractTag(detail.profile);
  const completedConsultations = detail.consultations.filter((item) => item.status === "DONE");
  const cancelledConsultations = detail.consultations.filter(
    (item) => item.status === "CANCELLED" || item.status === "CANCELED",
  );
  const proxyTarget = (): UserProxyBookingTarget => ({
    patientId: detail.profile.id,
    patientName: detail.profile.name,
    patientMobile: detail.profile.mobile,
  });
  const loadCounselors = async (keyword: string) => {
    if (!onSearchCounselors) {
      return;
    }
    const requestSeq = bindSearchSeq.current + 1;
    bindSearchSeq.current = requestSeq;
    setBindLoading(true);
    setBindError("");
    try {
      const options = await onSearchCounselors(keyword);
      if (bindSearchSeq.current !== requestSeq) {
        return;
      }
      setBindOptions(options);
      setSelectedCounselorId((current) => {
        if (current === detail.profile.boundCounselorId || options.some((item) => item.id === current)) {
          return current;
        }
        return null;
      });
    } catch (error) {
      if (bindSearchSeq.current !== requestSeq) {
        return;
      }
      setBindOptions([]);
      setSelectedCounselorId((current) =>
        current === detail.profile.boundCounselorId ? current : null,
      );
      setBindError(error instanceof Error ? error.message : "咨询师搜索失败，请重试");
    } finally {
      if (bindSearchSeq.current === requestSeq) {
        setBindLoading(false);
      }
    }
  };
  const openBindingModal = (prompt = "") => {
    if (!onSearchCounselors || !onBindCounselor) {
      return;
    }
    setBindKeyword("");
    setBindError("");
    setBindPrompt(prompt);
    setSelectedCounselorId(detail.profile.boundCounselorId || null);
    setBindOpen(true);
    void loadCounselors("");
  };
  const requestProxyBooking = () => {
    if (!onProxyBooking) {
      return;
    }
    if (!detail.profile.boundCounselorId) {
      openBindingModal("代理预约前需先绑定咨询师。完成绑定后，再继续创建代理预约。");
      return;
    }
    onProxyBooking(proxyTarget());
  };
  const consultationCard = (item: UserBoardDetail["consultations"][number]) => {
    const note = cleanBusinessNote(item.note);
    return (
      <DetailCard
        action={
          canProxyBooking && onProxyBooking ? (
            <TableActionButton onClick={requestProxyBooking}>再约一单</TableActionButton>
          ) : undefined
        }
        title={`${timeRangeText(item.startTime, item.endTime)} · ${statusLabel(item.status)}`}
        rows={[
          ["咨询师", item.counselorName],
          ["地点", placeText(item.centerName, item.roomName)],
          ...(note ? ([["备注", note]] as Array<[string, string]>) : []),
        ]}
      />
    );
  };
  const roomBookingCard = (item: UserBoardDetail["roomBookings"][number]) => (
    <DetailCard
      title={timeRangeText(item.startTime, item.endTime)}
      rows={[["咨询室", placeText(item.centerName, item.roomName)]]}
    />
  );

  return (
    <>
      <div className="text-sm text-[var(--lxxl-muted)]">用户详情</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{detail.profile.name}</h3>
        {contractTag && <Badge tone="green">{contractTag}</Badge>}
      </div>
      <div className="mt-1 text-sm text-[var(--lxxl-muted)]">
        {detail.profile.mobile || "-"} · {detail.profile.gender || "性别未填"} · {roleText(detail.profile.roles)}
      </div>
      {canProxyBooking && (
        <div className="mt-4 rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm leading-6">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3">
            <span className="text-[var(--lxxl-muted)]">是否签约</span>
            <span className="font-medium">{detail.profile.isContractSigned ? "是" : "否"}</span>
            <span className="text-[var(--lxxl-muted)]">绑定咨询师</span>
            <span className="font-medium">{detail.profile.boundCounselorName || "未绑定"}</span>
          </div>
        </div>
      )}
      {canProxyBooking && onProxyBooking && (
        <div className="mt-4 flex flex-col items-start gap-3">
          <QueryButton className="w-28" onClick={requestProxyBooking}>
            代理预约
          </QueryButton>
          {!detail.profile.boundCounselorId && (
            <p className="text-xs leading-5 text-[#A46A22]">
              代理预约前需先绑定咨询师；点击“代理预约”或“再约一单”将先打开绑定窗口。
            </p>
          )}
          {onSearchCounselors && onBindCounselor && (
            <QueryResetButton
              className="w-40"
              onClick={() => openBindingModal()}
            >
              {detail.profile.boundCounselorId ? "更换绑定咨询师" : "绑定咨询师"}
            </QueryResetButton>
          )}
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="订单" value={detail.profile.orderCount} />
        <MiniStat label="已付金额" value={formatMoneyFromCents(detail.profile.paidAmount)} />
        <MiniStat label="退款金额" value={formatMoneyFromCents(detail.profile.refundAmount)} />
        <MiniStat label="预约总数" value={detail.profile.consultationCount} />
        <MiniStat label="完成预约" value={detail.profile.completedConsultationCount} />
        <MiniStat label="取消预约" value={detail.profile.cancelledConsultationCount} />
        <MiniStat label="豁免" value={detail.profile.exemptionCount} />
        <MiniStat label="待审豁免" value={detail.profile.pendingExemptionCount} />
      </div>
      <DetailList
        title="预约记录"
        items={detail.consultations.map(consultationCard)}
      />
      <CompletedConsultationsByCounselor
        consultations={completedConsultations}
        renderConsultation={consultationCard}
      />
      <DetailList
        title="取消预约记录"
        items={cancelledConsultations.map(consultationCard)}
      />
      <DetailList
        title="订单记录"
        items={detail.orders.map(
          (item) => (
            <DetailCard
              key={`order-${item.id}`}
              title={`${formatMoneyFromCents(item.totalFee)} · ${statusLabel(item.status)}`}
              rows={[
                ["创建时间", formatDateTime(item.createdAt)],
                ...(item.paidAt ? ([["支付时间", formatDateTime(item.paidAt)]] as Array<[string, string]>) : []),
                ...(item.outTradeNo ? ([["商户单号", item.outTradeNo]] as Array<[string, string]>) : []),
                ...(cleanBusinessNote(item.description)
                  ? ([["说明", cleanBusinessNote(item.description) || "-"]] as Array<[string, string]>)
                  : []),
              ]}
            />
          ),
        )}
      />
      <DetailList
        title="付款记录"
        items={detail.payments.map(
          (item) => (
            <DetailCard
              key={`payment-${item.id}`}
              title={`${formatMoneyFromCents(item.amount)} · ${statusLabel(item.status)}`}
              rows={[["支付时间", formatDateTime(item.paidAt)]]}
            />
          ),
        )}
      />
      <DetailList
        title="退款记录"
        items={detail.refunds.map(
          (item) => (
            <DetailCard
              key={`refund-${item.id}`}
              title={`${formatMoneyFromCents(item.amount)} · ${statusLabel(item.status)}`}
              rows={[["更新时间", formatDateTime(item.updatedAt)]]}
            />
          ),
        )}
      />
      <DetailList
        title="豁免记录"
        items={detail.exemptions.map(
          (item) => (
            <DetailCard
              key={`exemption-${item.id}`}
              title={`${formatMoneyFromCents(item.amount)} · ${statusLabel(item.status)}`}
              rows={[
                ["提交时间", formatDateTime(item.createdAt)],
                ...(item.reviewedAt ? ([["审核时间", formatDateTime(item.reviewedAt)]] as Array<[string, string]>) : []),
                ["原因", item.reason || "-"],
                ...(item.rejectReason ? ([["拒绝原因", item.rejectReason]] as Array<[string, string]>) : []),
              ]}
            />
          ),
        )}
      />
      <DetailList
        title="预约咨询室记录"
        items={detail.roomBookings.map(roomBookingCard)}
      />
      {bindOpen && onSearchCounselors && onBindCounselor && (
        <BindCounselorModal
          boundCounselorId={detail.profile.boundCounselorId}
          error={bindError}
          keyword={bindKeyword}
          loading={bindLoading}
          options={bindOptions}
          prompt={bindPrompt}
          saving={bindSaving}
          selectedCounselorId={selectedCounselorId}
          setKeyword={setBindKeyword}
          setSelectedCounselorId={setSelectedCounselorId}
          onClose={() => {
            bindSearchSeq.current += 1;
            setBindOpen(false);
          }}
          onSave={async (counselorId) => {
            setBindSaving(true);
            try {
              await onBindCounselor(detail.profile.id, counselorId);
              setBindOpen(false);
            } catch {
              // 页面级通知已展示接口返回的业务错误，保留弹窗便于重新选择。
            } finally {
              setBindSaving(false);
            }
          }}
          onSearch={() => loadCounselors(bindKeyword)}
        />
      )}
    </>
  );
}

function BindCounselorModal({
  boundCounselorId,
  error,
  keyword,
  loading,
  options,
  prompt,
  saving,
  selectedCounselorId,
  setKeyword,
  setSelectedCounselorId,
  onClose,
  onSave,
  onSearch,
}: {
  boundCounselorId?: number | null;
  error: string;
  keyword: string;
  loading: boolean;
  options: ProxyPersonOption[];
  prompt: string;
  saving: boolean;
  selectedCounselorId: number | null;
  setKeyword: (value: string) => void;
  setSelectedCounselorId: (value: number | null) => void;
  onClose: () => void;
  onSave: (counselorId: number | null) => Promise<void>;
  onSearch: () => Promise<void>;
}) {
  const [pendingCounselorId, setPendingCounselorId] = useState<number | null | undefined>(undefined);
  const selectedCounselor = options.find((item) => item.id === selectedCounselorId);
  const isSameCounselor = Boolean(boundCounselorId && selectedCounselorId === boundCounselorId);
  const needsChangeConfirmation = Boolean(
    boundCounselorId && pendingCounselorId !== undefined && pendingCounselorId !== boundCounselorId,
  );

  const requestSave = (counselorId: number | null) => {
    if (counselorId === boundCounselorId) {
      return;
    }
    if (boundCounselorId) {
      setPendingCounselorId(counselorId);
      return;
    }
    void onSave(counselorId);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 px-6 py-6">
      <section
        aria-label="选择绑定咨询师"
        aria-modal="true"
        className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--lxxl-border)] bg-white shadow-2xl"
        role="dialog"
      >
        <div className="border-b border-[var(--lxxl-border)] px-6 py-5">
          <h3 className="text-lg font-semibold">选择绑定咨询师</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
            绑定咨询师用于限定代理预约对象，绑定本身不等于签约。系统会根据来访与所选咨询师是否存在历史已支付订单重新判定签约状态；没有历史已支付订单时仍为未签约，代理预约需同时选择协议。
          </p>
          {prompt && <p className="mt-2 text-sm font-medium text-[#A46A22]">{prompt}</p>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="flex gap-3">
            <input
              className={queryControlClass}
              disabled={needsChangeConfirmation}
              placeholder="搜索咨询师姓名或电话"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSearch();
                }
              }}
            />
            <QueryButton disabled={loading || needsChangeConfirmation} onClick={() => void onSearch()}>
              {loading ? "搜索中" : "查询"}
            </QueryButton>
          </div>
          {error && (
            <div className="mt-3 rounded-lg bg-[#FFF2F0] px-3 py-2 text-sm text-[#B42318]" role="alert">
              {error}
            </div>
          )}
          <div className="mt-4 divide-y divide-[var(--lxxl-border)] rounded-xl border border-[var(--lxxl-border)]">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--lxxl-muted)]">正在加载咨询师...</div>
            ) : options.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--lxxl-muted)]">暂无咨询师</div>
            ) : (
              options.map((item) => (
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3" key={item.id}>
                  <input
                    checked={selectedCounselorId === item.id}
                    disabled={needsChangeConfirmation}
                    name="bound-counselor"
                    type="radio"
                    onChange={() => {
                      setPendingCounselorId(undefined);
                      setSelectedCounselorId(item.id);
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.name}</span>
                    <span className="mt-1 block text-xs text-[var(--lxxl-muted)]">{item.mobile || `ID ${item.id}`}</span>
                    {boundCounselorId === item.id && (
                      <span className="mt-1 block text-xs font-medium text-[#315D4B]">当前绑定</span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-[var(--lxxl-border)] px-6 py-4">
          {needsChangeConfirmation ? (
            <div className="w-full rounded-xl border border-[#E7C9A3] bg-[#FFF8ED] p-4">
              <p className="text-sm font-medium text-[#7A4B16]">
                {pendingCounselorId === null
                  ? "确认解除当前咨询师绑定？"
                  : `确认更换为${selectedCounselor?.name || "所选咨询师"}？`}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#8A6438]">
                换绑或解绑可能取消与原绑定咨询师关联的待支付代理订单，此操作完成后请核对来访的订单与预约记录。
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <QueryButton
                  disabled={saving}
                  onClick={() => pendingCounselorId !== undefined && void onSave(pendingCounselorId)}
                >
                  {saving ? "保存中" : pendingCounselorId === null ? "确认解绑" : "确认更换"}
                </QueryButton>
                <QueryResetButton disabled={saving} onClick={() => setPendingCounselorId(undefined)}>
                  返回
                </QueryResetButton>
              </div>
            </div>
          ) : (
            <>
              <QueryButton
                className="w-28"
                disabled={saving || !selectedCounselorId || isSameCounselor}
                onClick={() => selectedCounselorId && requestSave(selectedCounselorId)}
              >
                {saving ? "保存中" : isSameCounselor ? "当前已绑定" : "确定"}
              </QueryButton>
              {boundCounselorId && (
                <QueryResetButton disabled={saving} onClick={() => requestSave(null)}>
                  解除绑定
                </QueryResetButton>
              )}
              <QueryResetButton disabled={saving} onClick={onClose}>取消</QueryResetButton>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

type UserConsultation = UserBoardDetail["consultations"][number];

function CompletedConsultationsByCounselor({
  consultations,
  renderConsultation,
}: {
  consultations: UserConsultation[];
  renderConsultation: (item: UserConsultation) => ReactNode;
}) {
  const groups = groupConsultationsByCounselor(consultations);

  return (
    <CollapsibleSection count={consultations.length} title="完成预约记录">
      {groups.length === 0 ? (
        <div className="text-sm text-[var(--lxxl-muted)]">暂无记录</div>
      ) : (
        <div className="border-y border-[var(--lxxl-border)]">
          <div className="grid grid-cols-[minmax(0,1fr)_4rem_3rem] gap-2 bg-[#FAF8F4] px-3 py-2 text-xs text-[var(--lxxl-muted)]">
            <span>咨询师</span>
            <span className="text-right">次数</span>
            <span />
          </div>
          <div className="divide-y divide-[var(--lxxl-border)]">
            {groups.map((group) => (
              <CompletedConsultationCounselorGroup
                key={group.key}
                counselorName={group.counselorName}
                consultations={group.consultations}
                renderConsultation={renderConsultation}
              />
            ))}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

function CompletedConsultationCounselorGroup({
  counselorName,
  consultations,
  renderConsultation,
}: {
  counselorName: string;
  consultations: UserConsultation[];
  renderConsultation: (item: UserConsultation) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_4rem_3rem] items-center gap-2 px-3 py-3 text-left text-sm transition hover:bg-[#FAF8F4]"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate font-medium text-[var(--lxxl-text)]">{counselorName}</span>
        <span className="text-right text-[var(--lxxl-muted)]">{consultations.length} 次</span>
        <span className="text-right text-xs font-medium text-[var(--lxxl-green)]">
          {open ? "收起" : "展开"}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-[var(--lxxl-border)] border-t border-[var(--lxxl-border)] bg-[#FCFBF8] px-3">
          {consultations.map((item) => (
            <div className="py-3 text-xs leading-5 text-[var(--lxxl-muted)]" key={item.id}>
              {renderConsultation(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupConsultationsByCounselor(consultations: UserConsultation[]) {
  const groups = new Map<
    string,
    { key: string; counselorName: string; consultations: UserConsultation[] }
  >();

  for (const consultation of consultations) {
    const key = String(consultation.counselorId || consultation.counselorName);
    const group = groups.get(key) || {
      key,
      counselorName: consultation.counselorName || `咨询师 #${consultation.counselorId}`,
      consultations: [],
    };
    group.consultations.push(consultation);
    groups.set(key, group);
  }

  return Array.from(groups.values());
}

function timeRangeText(startTime?: string | null, endTime?: string | null) {
  return `${formatDateTime(startTime)} 至 ${formatDateTime(endTime)}`;
}

function placeText(centerName?: string | null, roomName?: string | null) {
  return [centerName, roomName].filter(Boolean).join(" ") || "-";
}

function cleanBusinessNote(value?: string | null) {
  if (!value) {
    return "";
  }
  return value
    .split(/[|；;]/)
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith("center:") && !part.startsWith("room:"))
    .join(" · ");
}

function DetailCard({ title, rows, action }: { title: string; rows: Array<[string, string]>; action?: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="font-medium text-[var(--lxxl-text)]">{title}</div>
      <div className="space-y-1">
        {rows.map(([label, value]) => (
          <div className="grid grid-cols-[4.5rem_1fr] gap-2" key={label}>
            <span className="text-[var(--lxxl-muted)]">{label}</span>
            <span className="text-[var(--lxxl-muted)]">{value || "-"}</span>
          </div>
        ))}
      </div>
      {action && <div className="flex justify-end pt-1">{action}</div>}
    </div>
  );
}
