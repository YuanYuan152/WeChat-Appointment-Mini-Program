"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { DetailDrawer } from "@/components/boards/DetailDrawer";
import {
  EmptyHint,
  FollowUpChip,
  GhostButton,
  PrivacyNote,
  SeverityChip,
  StatusChip,
  TagChip,
} from "@/components/enterpriseData/ui";
import {
  SEVERITY_META,
  chinaDateTimeText,
  formatScore,
  tagColor,
} from "@/lib/enterpriseData";
import {
  createEnterpriseAnnotation,
  deleteEnterpriseAnnotation,
  fetchEnterpriseRespondentDetail,
} from "@/services/enterpriseData";
import type {
  EnterpriseAnnotation,
  EnterpriseDataset,
  EnterpriseReportItem,
  EnterpriseRespondentDetail,
} from "@/types/enterpriseData";

const LEARNING_ACTION_LABELS = {
  view: "打开阅读",
  read: "阅读",
  play: "开始播放",
  complete: "播放完成",
} as const;

export function RespondentDrawer({
  dataset,
  enterpriseId,
  respondentKey,
  isAdmin,
  currentUserId,
  onClose,
  onOpenReport,
  onOpenFollowUp,
  onDeleteReport,
  onAnnotationCreated,
  onAnnotationDeleted,
  showNotice,
}: {
  dataset: EnterpriseDataset;
  enterpriseId: string;
  respondentKey: string;
  isAdmin: boolean;
  currentUserId: number;
  onClose: () => void;
  onOpenReport: (report: EnterpriseReportItem) => void;
  onOpenFollowUp: (report: EnterpriseReportItem) => void;
  onDeleteReport: (report: EnterpriseReportItem) => void;
  onAnnotationCreated: (annotation: EnterpriseAnnotation) => void;
  onAnnotationDeleted: () => void;
  showNotice: (type: "info" | "error" | "success", text: string) => void;
}) {
  const respondent = dataset.respondents.find((item) => item.key === respondentKey) || null;
  const roster = dataset.roster.find((item) => `p${item.personnelId}` === respondentKey) || null;
  const reports = useMemo(
    () =>
      dataset.reports
        .filter((report) => report.respondentKey === respondentKey)
        .sort((left, right) => (right.completedAt || "").localeCompare(left.completedAt || "")),
    [dataset.reports, respondentKey],
  );
  const displayName = respondent?.displayName || roster?.realName || roster?.username || "员工";
  const accountIds = respondent?.accountIds;
  const [detail, setDetail] = useState<EnterpriseRespondentDetail>();
  const [detailError, setDetailError] = useState("");
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>(respondent?.tags || []);
  const [customTag, setCustomTag] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(reports[0]?.publicId || null);

  useEffect(() => {
    let cancelled = false;
    fetchEnterpriseRespondentDetail(enterpriseId, respondentKey, accountIds || [])
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((error) => {
        if (!cancelled) setDetailError(error instanceof Error ? error.message : "档案详情加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [accountIds, enterpriseId, respondentKey]);

  const currentTags = respondent?.tags || detail?.annotations[0]?.tags || [];
  const status = respondent ? respondent.status : "todo";
  const authorizedCount = dataset.enterprise.assessmentIds.length;
  const libraryTags = new Set(dataset.tagLibrary.flatMap((group) => group.tags));
  const extraPicked = picked.filter((tag) => !libraryTags.has(tag));

  const togglePick = (tag: string) =>
    setPicked((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));

  const saveAnnotation = async () => {
    setSaving(true);
    try {
      const annotation = await createEnterpriseAnnotation(enterpriseId, respondentKey, {
        respondentName: displayName,
        tags: picked,
        note: note.trim(),
        source: source.trim(),
      });
      setDetail((current) =>
        current ? { ...current, annotations: [annotation, ...current.annotations] } : current,
      );
      onAnnotationCreated(annotation);
      setEditing(false);
      setNote("");
      setSource("");
      showNotice("success", "标注已保存");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "标注保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailDrawer title={`员工档案 · ${displayName}`} widthClassName="max-w-[760px]" onClose={onClose}>
      <div className="space-y-5">
        <section className="rounded-xl bg-gradient-to-r from-[#2F4A40] to-[#4E7464] px-5 py-4 text-white">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-lg font-semibold">
              {displayName.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{displayName}</span>
                {respondent && (
                  <span className="rounded bg-white/15 px-2 py-0.5 text-[11px]">
                    {respondent.severity ? SEVERITY_META[respondent.severity].label : "未分级"}
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-white/80">
                {[
                  respondent?.empNo ? `工号 ${respondent.empNo}` : roster?.empNo ? `工号 ${roster.empNo}` : "",
                  respondent?.personnel?.username || roster?.username ? `站点账号 ${respondent?.personnel?.username || roster?.username}` : "",
                  respondent?.firstAt ? `首次填写 ${chinaDateTimeText(respondent.firstAt)}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "匿名填写"}
              </div>
            </div>
            <div className="text-right text-xs text-white/80">
              <div>
                完成 {respondent?.completedCount ?? 0}/{authorizedCount} 个量表
              </div>
              <div className="mt-1">
                <StatusChip size="xs" status={status} />
              </div>
            </div>
          </div>
        </section>

        <DrawerSection title="① 基本信息" sub="员工在企业链接中填写的信息（取最近一次提交）">
          {respondent ? (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {dataset.fields.map((field) => (
                <div key={field.id} className="flex gap-3 text-sm">
                  <dt className="w-24 shrink-0 text-[var(--lxxl-muted)]">{field.label}</dt>
                  <dd className="min-w-0 break-words">{respondent.info[field.id] || <span className="text-[#C0BAB0]">未填写</span>}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <EmptyHint text="该员工尚未开始填写，暂无基本信息" />
          )}
        </DrawerSection>

        <DrawerSection title="② 测评记录" sub={`共 ${reports.length} 份答卷，点击展开维度结果`}>
          {reports.length === 0 ? (
            <EmptyHint text="暂无答卷" />
          ) : (
            <div className="divide-y divide-[var(--lxxl-border)]">
              {reports.map((report) => {
                const open = expanded === report.publicId;
                return (
                  <div key={report.publicId} className="py-3">
                    <button
                      className="flex w-full flex-wrap items-center gap-2 text-left"
                      type="button"
                      onClick={() => setExpanded(open ? null : report.publicId)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {report.assessmentTitle}
                          {!report.isLatest && <span className="ml-2 text-xs font-normal text-[var(--lxxl-muted)]">历史答卷</span>}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--lxxl-muted)]">
                          {chinaDateTimeText(report.completedAt)} · {report.resultType === "dimension" ? report.summary : `${report.level || "-"}${report.score !== null ? `（${formatScore(report.score)} 分）` : ""}`}
                        </span>
                      </span>
                      <SeverityChip severity={report.severity} size="xs" />
                      {report.followUp && <FollowUpChip size="xs" status={report.followUp.status} />}
                      <span className="text-xs text-[var(--lxxl-muted)]">{open ? "收起" : "展开"}</span>
                    </button>
                    {open && (
                      <div className="mt-3 rounded-xl bg-[#FAF8F4] p-4">
                        {report.dimensions.length > 0 ? (
                          <div className="space-y-2">
                            {report.dimensions.map((dimension) => (
                              <div key={dimension.id} className="flex items-center gap-3 text-sm">
                                <span className="w-28 shrink-0 truncate text-[var(--lxxl-muted)]" title={dimension.title}>
                                  {dimension.title}
                                </span>
                                <span className="w-14 shrink-0 font-semibold">{formatScore(dimension.score)}</span>
                                <span className="min-w-0 flex-1 truncate">{dimension.level || "-"}</span>
                                <SeverityChip severity={dimension.severity} size="xs" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm leading-6 text-[#4A4A4A]">{report.summary || report.level || "暂无结果摘要"}</div>
                        )}
                        {report.followUp?.note && (
                          <div className="mt-3 border-t border-[var(--lxxl-border)] pt-3 text-xs leading-5 text-[#5A5A5A]">
                            跟进记录：{report.followUp.note}
                            <span className="ml-2 text-[var(--lxxl-muted)]">
                              {report.followUp.updatedBy} {chinaDateTimeText(report.followUp.updatedAt)}
                            </span>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <GhostButton onClick={() => onOpenReport(report)}>查看完整报告</GhostButton>
                          <GhostButton onClick={() => onOpenFollowUp(report)}>{report.followUp ? "风险跟进" : "标记风险 / 跟进"}</GhostButton>
                          {isAdmin && (
                            <GhostButton tone="danger" onClick={() => onDeleteReport(report)}>
                              删除答卷
                            </GhostButton>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DrawerSection>

        <DrawerSection
          title="③ 知识库学习记录"
          sub={
            respondent?.learning
              ? `学习 ${respondent.learning.views} 次 · 完成音频 ${respondent.learning.completes} 次 · 累计约 ${respondent.learning.minutes} 分钟`
              : "企业站图文阅读与音频播放会自动回传"
          }
        >
          {detailError ? (
            <EmptyHint text={detailError} />
          ) : !detail ? (
            <EmptyHint text="正在加载学习记录..." />
          ) : detail.learningEvents.length === 0 ? (
            <EmptyHint text="暂无学习记录" />
          ) : (
            <div className="divide-y divide-[var(--lxxl-border)]">
              {detail.learningEvents.slice(0, 30).map((event, index) => (
                <div key={`${event.contentId}-${event.at}-${index}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      event.contentType === "audio" ? "bg-[#E8F0F8] text-[#2E5E8C]" : "bg-[#EAF2ED] text-[#2F7A55]"
                    }`}
                  >
                    {event.contentType === "audio" ? "音频" : "图文"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  <span className="shrink-0 text-xs text-[var(--lxxl-muted)]">
                    {LEARNING_ACTION_LABELS[event.action]}
                    {event.durationSec ? ` ${Math.max(1, Math.round(event.durationSec / 60))} 分钟` : ""}
                  </span>
                  <span className="w-32 shrink-0 text-right text-xs text-[var(--lxxl-muted)]">{chinaDateTimeText(event.at)}</span>
                </div>
              ))}
            </div>
          )}
        </DrawerSection>

        <DrawerSection
          right={
            <GhostButton
              tone={editing ? "default" : "primary"}
              onClick={() => {
                setPicked(currentTags);
                setEditing((value) => !value);
              }}
            >
              {editing ? "取消" : "添加标注"}
            </GhostButton>
          }
          sub="每次保存会记录操作人与时间；最新一次保存的标签即员工当前标签"
          title="④ 人工标注与观察记录"
        >
          {currentTags.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {currentTags.map((tag) => (
                <TagChip key={tag} color={tagColor(tag, dataset.tagLibrary)} tag={tag} />
              ))}
            </div>
          ) : (
            !editing && <div className="mb-3 text-sm text-[var(--lxxl-muted)]">暂无人工标签</div>
          )}

          {editing && (
            <div className="mb-4 space-y-4 rounded-xl border border-dashed border-[var(--lxxl-border)] p-4">
              {dataset.tagLibrary.map((group) => (
                <div key={group.name}>
                  <div className="mb-2 text-xs font-semibold" style={{ color: group.color }}>
                    {group.name}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map((tag) => {
                      const on = picked.includes(tag);
                      return (
                        <button
                          key={tag}
                          className="rounded-md border px-2.5 py-1 text-xs transition"
                          style={{
                            borderColor: on ? group.color : "#E8E4DE",
                            background: on ? `${group.color}14` : "#fff",
                            color: on ? group.color : "#5A5A5A",
                            fontWeight: on ? 600 : 400,
                          }}
                          type="button"
                          onClick={() => togglePick(tag)}
                        >
                          {on ? "✓ " : ""}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div>
                <div className="mb-2 text-xs font-semibold text-[var(--lxxl-muted)]">其他标签</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {extraPicked.map((tag) => (
                    <TagChip key={tag} color="#6B6B6B" tag={tag} onRemove={() => togglePick(tag)} />
                  ))}
                  <input
                    className="h-8 w-40 rounded-md border border-dashed border-[var(--lxxl-border)] px-2 text-xs outline-none focus:border-[var(--lxxl-green)]"
                    maxLength={20}
                    placeholder="输入自定义标签，回车添加"
                    value={customTag}
                    onChange={(event) => setCustomTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        const value = customTag.trim();
                        if (value && !picked.includes(value)) setPicked((current) => [...current, value]);
                        setCustomTag("");
                      }
                    }}
                  />
                </div>
              </div>
              <textarea
                className="min-h-20 w-full resize-y rounded-xl border border-[var(--lxxl-border)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--lxxl-green)]"
                maxLength={2000}
                placeholder="观察记录，例如：团辅中主动分享睡眠困扰，情绪稳定，建议 30 天后复测"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <input
                  className="h-9 w-56 rounded-xl border border-[var(--lxxl-border)] px-3 text-sm outline-none focus:border-[var(--lxxl-green)]"
                  maxLength={100}
                  placeholder="来源（选填），如：线下团辅 / 电话回访"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                />
                <GhostButton disabled={saving} tone="primary" onClick={() => void saveAnnotation()}>
                  {saving ? "正在保存..." : "保存标注"}
                </GhostButton>
              </div>
            </div>
          )}

          {!detail ? null : detail.annotations.length === 0 ? (
            <div className="text-xs text-[var(--lxxl-muted)]">暂无标注记录</div>
          ) : (
            <ol className="space-y-3 border-l-2 border-[var(--lxxl-border)] pl-4">
              {detail.annotations.map((annotation) => {
                const canDelete = isAdmin || annotation.operatorAccountId === currentUserId;
                return (
                  <li key={annotation.id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--lxxl-muted)]">
                      <span className="font-medium text-[var(--lxxl-text)]">{annotation.operatorName || "工作人员"}</span>
                      <span>{chinaDateTimeText(annotation.createdAt)}</span>
                      {annotation.source && <span>· {annotation.source}</span>}
                      {canDelete && (
                        <button
                          className="ml-auto text-[#A13F37] hover:text-[#7F2F29]"
                          type="button"
                          onClick={() => {
                            if (!window.confirm("删除这条标注记录？员工当前标签将回到上一条记录。")) return;
                            void deleteEnterpriseAnnotation(enterpriseId, annotation.id)
                              .then(() => {
                                setDetail((current) =>
                                  current
                                    ? { ...current, annotations: current.annotations.filter((item) => item.id !== annotation.id) }
                                    : current,
                                );
                                onAnnotationDeleted();
                                showNotice("success", "标注记录已删除");
                              })
                              .catch((error) => showNotice("error", error instanceof Error ? error.message : "删除失败"));
                          }}
                        >
                          删除
                        </button>
                      )}
                    </div>
                    {annotation.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {annotation.tags.map((tag) => (
                          <TagChip key={tag} color={tagColor(tag, dataset.tagLibrary)} tag={tag} />
                        ))}
                      </div>
                    )}
                    {annotation.note && <div className="mt-1.5 leading-6 text-[#4A4A4A]">{annotation.note}</div>}
                  </li>
                );
              })}
            </ol>
          )}
        </DrawerSection>

        <PrivacyNote>
          档案中的测评结果与观察记录仅供 EAP 服务团队专业跟进使用。查看完整报告会留存访问审计；删除答卷不可恢复，仅管理员可操作。
        </PrivacyNote>
      </div>
    </DetailDrawer>
  );
}

function DrawerSection({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--lxxl-border)] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          {sub && <p className="mt-1 text-xs leading-5 text-[var(--lxxl-muted)]">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
