"use client";

import { useCallback, useEffect, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { ContentImageUpload } from "@/components/content/ContentImageUpload";
import { EapArticleSection } from "@/components/enterprises/EapArticleSection";
import {
  EmptyState,
  QueryButton,
  QueryField,
  QueryResetButton,
  TableActionButton,
  queryControlClass,
} from "@/components/ui";
import {
  deleteAssessmentEnterprise,
  fetchAssessmentEnterprises,
  fetchAssessmentEnterpriseDefault,
  fetchEmployeeInfoFieldCatalog,
  fetchEnterpriseEapArticles,
  fetchPrivateAssessmentOptions,
  fetchSharedEapArticles,
  generateAssessmentEnterpriseQrCode,
  saveAssessmentEnterprise,
  saveAssessmentEnterpriseDefault,
} from "@/services/assessmentEnterprises";
import type {
  AssessmentEnterprise,
  AssessmentEnterpriseBranding,
  AssessmentEnterpriseHeroSlide,
  CustomEmployeeInfoField,
  EapArticle,
  EmployeeInfoFieldOption,
  PrivateAssessmentOption,
} from "@/types/api";

const DEFAULT_BASE_URL = (
  process.env.NEXT_PUBLIC_ZHONGJIAN_SITE_BASE_URL
  || process.env.NEXT_PUBLIC_EAP_BASE_URL
  || "http://127.0.0.1:3000"
).replace(/\/$/, "");

function generateSecureSuffix() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function AssessmentEnterprisesScreen() {
  return (
    <AppRoute sectionId="assessmentEnterprises">
      <AssessmentEnterprisesContent />
    </AppRoute>
  );
}

function AssessmentEnterprisesContent() {
  const { clearNotice, refreshKey, setBreadcrumbTail, showNotice } = useAppRoute();
  const [items, setItems] = useState<AssessmentEnterprise[]>([]);
  const [assessmentOptions, setAssessmentOptions] = useState<PrivateAssessmentOption[]>([]);
  const [employeeInfoFieldCatalog, setEmployeeInfoFieldCatalog] = useState<EmployeeInfoFieldOption[]>([]);
  const [defaultBranding, setDefaultBranding] = useState<AssessmentEnterpriseBranding>();
  const [articles, setArticles] = useState<EapArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AssessmentEnterprise | null | undefined>(undefined);
  const [qr, setQr] = useState<{ companyName: string; url: string; svg: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const [enterprises, privateAssessments, branding, fieldCatalog, sharedArticles] = await Promise.all([
        fetchAssessmentEnterprises(),
        fetchPrivateAssessmentOptions(),
        fetchAssessmentEnterpriseDefault(),
        fetchEmployeeInfoFieldCatalog(),
        fetchSharedEapArticles(),
      ]);
      setItems(enterprises);
      setAssessmentOptions(privateAssessments);
      setDefaultBranding(branding);
      setEmployeeInfoFieldCatalog(fieldCatalog);
      setArticles(sharedArticles);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "企业定制配置加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, showNotice]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [editing]);

  useEffect(() => {
    if (editing === undefined) {
      setBreadcrumbTail(null);
      return;
    }
    setBreadcrumbTail(editing ? "编辑" : "新增");
    return () => setBreadcrumbTail(null);
  }, [editing, setBreadcrumbTail]);

  if (editing !== undefined) {
    return (
      <>
        <EnterpriseEditor
          defaultHeroSlides={normalizeHeroSlides(defaultBranding?.heroSlides)}
          employeeInfoFieldCatalog={employeeInfoFieldCatalog}
          item={editing}
          options={assessmentOptions}
          onClose={() => setEditing(undefined)}
          onSave={async (input) => {
            try {
              await saveAssessmentEnterprise(input);
              showNotice("success", input.id ? "企业配置已更新" : "企业配置已新增");
              setEditing(undefined);
              await load();
            } catch (error) {
              showNotice("error", error instanceof Error ? error.message : "企业配置保存失败");
              throw error;
            }
          }}
          onPersist={async (input, notice) => {
            try {
              const saved = await saveAssessmentEnterprise(input);
              await load();
              showNotice("success", notice || "已保存，已应用到当前企业页面");
              return saved;
            } catch (error) {
              showNotice("error", error instanceof Error ? error.message : "保存失败");
              throw error;
            }
          }}
        />
        {qr && <QrDialog value={qr} onClose={() => setQr(undefined)} />}
      </>
    );
  }

  return (
    <>
      {defaultBranding && (
        <DefaultBrandingEditor
          value={defaultBranding}
          onSave={async (input) => {
            try {
              const saved = await saveAssessmentEnterpriseDefault(input);
              setDefaultBranding(saved);
              showNotice("success", "默认网站设置已保存");
            } catch (error) {
              showNotice("error", error instanceof Error ? error.message : "默认设置保存失败");
              throw error;
            }
          }}
        />
      )}
      <section className="mb-6 rounded-xl border border-[var(--lxxl-border)] bg-white p-6 sm:p-7 lg:p-8">
        <EapArticleSection
          articles={articles}
          mode="shared"
          onChange={async () => setArticles(await fetchSharedEapArticles())}
        />
      </section>
      <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 sm:px-7 lg:px-8">
          <div>
            <h2 className="text-xl font-semibold">企业定制</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
              为企业创建专属访问链接，授权已发布的私有或公有量表，并生成可下载二维码。
            </p>
          </div>
          <QueryButton onClick={() => setEditing(null)}>新增公司链接</QueryButton>
        </div>
        <div className="border-t border-[var(--lxxl-border)]">
          {loading && items.length === 0 ? (
            <EmptyState text="正在加载企业配置..." />
          ) : items.length === 0 ? (
            <EmptyState text="暂无企业定制链接。" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="bg-[#FAF8F4] text-left text-[var(--lxxl-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">公司</th>
                    <th className="px-5 py-3 font-medium">专属链接</th>
                    <th className="px-5 py-3 font-medium">授权量表</th>
                    <th className="px-5 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr className="border-t border-[var(--lxxl-border)] align-top" key={item.id}>
                      <td className="px-5 py-4">
                        <div className="font-medium">{item.companyName}</div>
                        <div className="mt-1 text-xs text-[var(--lxxl-muted)]">{item.siteName} · {item.slogan}</div>
                      </td>
                      <td className="max-w-md px-5 py-4">
                        <a className="break-all text-[var(--lxxl-green)] hover:underline" href={item.url} rel="noreferrer" target="_blank">
                          {item.url}
                        </a>
                      </td>
                      <td className="px-5 py-4">
                        {item.assessmentIds
                          .map((id) => {
                            const override = (item.assessmentTitles?.[id] || "").trim();
                            const original =
                              assessmentOptions.find((option) => option.id === id)?.title || id;
                            return override || original;
                          })
                          .join("、")}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-3">
                          <TableActionButton onClick={() => setEditing(item)}>编辑</TableActionButton>
                          <TableActionButton
                            onClick={() => {
                              void generateAssessmentEnterpriseQrCode(item.id)
                                .then((svg) => setQr({ companyName: item.companyName, url: item.url, svg }))
                                .catch((error) => showNotice("error", error instanceof Error ? error.message : "二维码生成失败"));
                            }}
                          >
                            生成二维码
                          </TableActionButton>
                          <TableActionButton
                            onClick={() => {
                              if (!window.confirm(`确认删除“${item.companyName}”的企业链接？`)) return;
                              void deleteAssessmentEnterprise(item.id)
                                .then(() => {
                                  showNotice("success", "企业配置已删除");
                                  return load();
                                })
                                .catch((error) => showNotice("error", error instanceof Error ? error.message : "删除失败"));
                            }}
                          >
                            删除
                          </TableActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {qr && <QrDialog value={qr} onClose={() => setQr(undefined)} />}
    </>
  );
}

const DEFAULT_HERO_SLIDES: AssessmentEnterpriseHeroSlide[] = [
  {
    imageUrl: "/assets/hero-site.jpg",
    title: "心理测评",
    desc: "专业量表，帮助你更好认识自己",
  },
  {
    imageUrl: "/assets/hero-office.jpg",
    title: "职场支持",
    desc: "关注工作压力与情绪健康",
  },
  {
    imageUrl: "/assets/hero-family.jpg",
    title: "生活与家庭",
    desc: "陪伴你与家人共同成长",
  },
];

function normalizeHeroSlides(
  slides?: AssessmentEnterpriseHeroSlide[] | null,
): AssessmentEnterpriseHeroSlide[] {
  return DEFAULT_HERO_SLIDES.map((fallback, index) => {
    const current = slides?.[index];
    return {
      imageUrl: (current?.imageUrl || "").trim() || fallback.imageUrl,
      title: (current?.title || "").trim() || fallback.title,
      desc: (current?.desc || "").trim() || fallback.desc,
    };
  });
}

function DefaultBrandingEditor({
  value,
  onSave,
}: {
  value: AssessmentEnterpriseBranding;
  onSave: (input: AssessmentEnterpriseBranding) => Promise<void>;
}) {
  const withDefaults = (input: AssessmentEnterpriseBranding): AssessmentEnterpriseBranding => ({
    ...input,
    onboardingEntryLabel: (input.onboardingEntryLabel || "").trim() || "新员工入职测评",
    heroSlides: normalizeHeroSlides(input.heroSlides),
  });
  const [draft, setDraft] = useState(() => withDefaults(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(withDefaults(value)), [value]);

  const updateHeroSlide = (
    index: number,
    patch: Partial<AssessmentEnterpriseHeroSlide>,
  ) => {
    setDraft((current) => ({
      ...current,
      heroSlides: current.heroSlides.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, ...patch } : slide,
      ),
    }));
  };

  const heroReady = draft.heroSlides.every(
    (slide) => slide.imageUrl.trim() && slide.title.trim() && slide.desc.trim(),
  );

  return (
    <section className="mb-6 rounded-xl border border-[var(--lxxl-border)] bg-white p-6 sm:p-7 lg:p-8">
      <h2 className="text-xl font-semibold">通用EAP默认设置</h2>
      <p className="mt-2 text-sm text-[var(--lxxl-muted)]">
        控制不带企业专属后缀访问网站时显示的品牌信息。
      </p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <QueryField label="网站名" required>
          <input className={queryControlClass} value={draft.siteName} onChange={(event) => setDraft({ ...draft, siteName: event.target.value })} />
        </QueryField>
        <QueryField label="公司名">
          <input
            className={queryControlClass}
            value={draft.companyName}
            placeholder="选填；不填则 EAP 首页不显示公司名"
            onChange={(event) => setDraft({ ...draft, companyName: event.target.value })}
          />
        </QueryField>
        <div className="lg:col-span-2">
          <ContentImageUpload label="网站 Logo" required value={draft.logoUrl} onChange={(logoUrl) => setDraft({ ...draft, logoUrl })} />
        </div>
        <div className="lg:col-span-2">
          <QueryField label="口号" required>
            <input className={queryControlClass} value={draft.slogan} onChange={(event) => setDraft({ ...draft, slogan: event.target.value })} />
          </QueryField>
        </div>
        <div className="lg:col-span-2">
          <QueryField label="入职测评入口文案" required>
            <input
              className={queryControlClass}
              value={draft.onboardingEntryLabel}
              placeholder="新员工入职测评"
              onChange={(event) => setDraft({ ...draft, onboardingEntryLabel: event.target.value })}
            />
          </QueryField>
          <p className="mt-1 text-xs text-[var(--lxxl-muted)]">
            显示在 EAP 首页导航与主按钮的测评入口文案。
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-[var(--lxxl-border)] pt-6">
        <h3 className="text-base font-semibold">首页轮播图</h3>
        <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
          对应 EAP 首页右侧自动滚动的三张图片，可分别修改图片与文案。
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {draft.heroSlides.map((slide, index) => (
            <div
              key={`hero-slide-${index}`}
              className="rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-4"
            >
              <div className="mb-3 text-sm font-medium text-[var(--lxxl-ink)]">
                第 {index + 1} 张
              </div>
              <ContentImageUpload
                label="轮播图片"
                required
                value={slide.imageUrl}
                onChange={(imageUrl) => updateHeroSlide(index, { imageUrl })}
              />
              <div className="mt-3 space-y-3">
                <QueryField label="标题" required>
                  <input
                    className={queryControlClass}
                    value={slide.title}
                    maxLength={40}
                    onChange={(event) => updateHeroSlide(index, { title: event.target.value })}
                  />
                </QueryField>
                <QueryField label="说明文字" required>
                  <input
                    className={queryControlClass}
                    value={slide.desc}
                    maxLength={120}
                    onChange={(event) => updateHeroSlide(index, { desc: event.target.value })}
                  />
                </QueryField>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <QueryButton
          disabled={
            saving
            || !draft.siteName.trim()
            || !draft.logoUrl.trim()
            || !draft.slogan.trim()
            || !draft.onboardingEntryLabel.trim()
            || !heroReady
          }
          onClick={() => {
            setSaving(true);
            void onSave({
              companyName: draft.companyName.trim(),
              siteName: draft.siteName.trim(),
              logoUrl: draft.logoUrl.trim(),
              slogan: draft.slogan.trim(),
              onboardingEntryLabel: draft.onboardingEntryLabel.trim(),
              heroSlides: draft.heroSlides.map((slide) => ({
                imageUrl: slide.imageUrl.trim(),
                title: slide.title.trim(),
                desc: slide.desc.trim(),
              })),
            }).finally(() => setSaving(false));
          }}
        >
          {saving ? "保存中..." : "保存默认设置"}
        </QueryButton>
      </div>
    </section>
  );
}

function AssessmentOptionList({
  options,
  selectedIds,
  displayTitles,
  emptyText,
  onToggle,
  onDisplayTitleChange,
}: {
  options: PrivateAssessmentOption[];
  selectedIds: string[];
  displayTitles: Record<string, string>;
  emptyText: string;
  onToggle: (id: string, checked: boolean) => void;
  onDisplayTitleChange: (id: string, title: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const startEdit = (option: PrivateAssessmentOption) => {
    const current = (displayTitles[option.id] || "").trim() || option.title;
    setEditingId(option.id);
    setDraftTitle(current);
  };

  const commitEdit = (option: PrivateAssessmentOption) => {
    const next = draftTitle.trim();
    // 与原名相同或清空 → 不覆盖，仍展示原量表名
    onDisplayTitleChange(option.id, next === option.title ? "" : next);
    setEditingId(null);
    setDraftTitle("");
  };

  return (
    <div className="divide-y divide-[var(--lxxl-border)] rounded-xl border border-[var(--lxxl-border)]">
      {options.length === 0 ? (
        <div className="px-4 py-5 text-sm text-[var(--lxxl-muted)]">{emptyText}</div>
      ) : (
        options.map((option) => {
          const selected = selectedIds.includes(option.id);
          const override = (displayTitles[option.id] || "").trim();
          const shownTitle = override || option.title;
          const isEditing = editingId === option.id;
          return (
            <div className="px-4 py-3" key={option.id}>
              <div className="flex items-center gap-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    checked={selected}
                    type="checkbox"
                    onChange={(event) => onToggle(option.id, event.target.checked)}
                  />
                  <span className="min-w-0 truncate">{shownTitle}</span>
                  {override ? (
                    <span className="shrink-0 text-xs text-[var(--lxxl-muted)]">原名：{option.title}</span>
                  ) : (
                    <span className="shrink-0 text-xs text-[var(--lxxl-muted)]">{option.id}</span>
                  )}
                </label>
                {selected && !isEditing && (
                  <button
                    aria-label="修改量表展示名"
                    className="group/tip relative shrink-0 rounded-md px-1.5 py-0.5 text-base leading-none text-[var(--lxxl-muted)] hover:bg-[#F7F5F2] hover:text-[var(--lxxl-ink)]"
                    type="button"
                    onClick={() => startEdit(option)}
                  >
                    <span aria-hidden="true">🖊</span>
                    <span
                      className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 hidden whitespace-nowrap rounded-md bg-[#2C2C2C] px-2 py-1 text-xs font-normal leading-4 text-white shadow-sm group-hover/tip:block"
                      role="tooltip"
                    >
                      修改量表展示名
                    </span>
                  </button>
                )}
              </div>
              {selected && isEditing && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    autoFocus
                    className={`${queryControlClass} flex-1`}
                    maxLength={120}
                    placeholder="本企业链接展示名（不影响原量表名称）"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitEdit(option);
                      }
                      if (event.key === "Escape") {
                        setEditingId(null);
                        setDraftTitle("");
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <QueryButton onClick={() => commitEdit(option)}>确定</QueryButton>
                    <QueryResetButton
                      onClick={() => {
                        setEditingId(null);
                        setDraftTitle("");
                      }}
                    >
                      取消
                    </QueryResetButton>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function EmployeeInfoTemplatePanel({
  catalog,
  value,
  customFields,
  onChange,
  onCustomFieldsChange,
  onPersist,
}: {
  catalog: EmployeeInfoFieldOption[];
  value: string[] | null;
  customFields: CustomEmployeeInfoField[];
  onChange: (next: string[] | null) => void;
  onCustomFieldsChange: (next: CustomEmployeeInfoField[]) => void;
  onPersist: (next: string[] | null, customFields: CustomEmployeeInfoField[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const allIds = catalog.map((field) => field.id);
  const groups = Array.from(new Set(catalog.map((field) => field.group)));
  const [draftIds, setDraftIds] = useState<string[]>(() => value ?? catalog.map((field) => field.id));

  useEffect(() => {
    setDraftIds(value ?? catalog.map((field) => field.id));
  }, [value, catalog]);

  const toggleDraft = (id: string, checked: boolean) => {
    setDraftIds((current) =>
      checked ? [...current, id] : current.filter((fieldId) => fieldId !== id),
    );
  };

  const persist = async (
    next: string[] | null,
    nextCustom: CustomEmployeeInfoField[] = customFields,
  ) => {
    setSaving(true);
    setError("");
    onChange(next);
    onCustomFieldsChange(nextCustom);
    try {
      await onPersist(next, nextCustom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "员工信息保存失败");
    } finally {
      setSaving(false);
    }
  };

  const addField = async () => {
    const label = fieldName.trim();
    if (!label) {
      setError("请填写字段名称");
      return;
    }
    const duplicated = [...catalog.map((field) => field.label), ...customFields.map((field) => field.label)]
      .some((item) => item.trim() === label);
    if (duplicated) {
      setError("已有同名字段");
      return;
    }
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const id = `custom-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    setFieldName("");
    setAdding(false);
    setExpanded(true);
    await persist(value, [...customFields, { id, label }]);
  };

  const removeField = async (fieldId: string) => {
    setDraftIds((current) => current.filter((id) => id !== fieldId));
    const nextValue = value == null ? null : value.filter((id) => id !== fieldId);
    await persist(nextValue, customFields.filter((field) => field.id !== fieldId));
  };

  return (
    <div className="block min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <button
            aria-expanded={expanded}
            aria-label={expanded ? "收起员工信息" : "展开员工信息"}
            className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--lxxl-ink)] hover:bg-[#F4F1EB] hover:text-[var(--lxxl-green)]"
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            <svg
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
          <h3 className="text-base font-semibold">员工信息收集</h3>
        </div>
        <button
          className="h-10 shrink-0 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white hover:bg-[var(--lxxl-green-dark)]"
          type="button"
          onClick={() => {
            setError("");
            setFieldName("");
            setAdding(true);
          }}
        >
          新增员工信息字段
        </button>
      </div>
      {expanded && (
        <div className="mt-4">
          <p className="text-sm text-[var(--lxxl-muted)]">
            勾选需要员工在当前企业 EAP 基本信息页填写的字段。保存后只对这家企业生效。带「默认必填」标记的字段在勾选后仍为必填。自定义字段只属于当前企业，勾选保存后才会出现在员工填写页。
          </p>
          <div className="mt-4 space-y-4">
            {groups.map((group) => (
              <div key={group}>
                <div className="mb-2 text-sm font-medium text-[var(--lxxl-ink)]">{group}</div>
                <div className="divide-y divide-[var(--lxxl-border)] rounded-xl border border-[var(--lxxl-border)]">
                  {catalog
                    .filter((field) => field.group === group)
                    .map((field) => (
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3" key={field.id}>
                        <input
                          checked={draftIds.includes(field.id)}
                          disabled={saving}
                          type="checkbox"
                          onChange={(event) => toggleDraft(field.id, event.target.checked)}
                        />
                        <span className="flex-1">{field.label}</span>
                        {field.required && (
                          <span className="text-xs text-[var(--lxxl-muted)]">默认必填</span>
                        )}
                      </label>
                    ))}
                </div>
              </div>
            ))}
            <div>
              <div className="mb-2 text-sm font-medium text-[var(--lxxl-ink)]">自定义字段</div>
              {customFields.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--lxxl-border)] px-4 py-3 text-sm text-[var(--lxxl-muted)]">
                  还没有自定义字段。点击右上角「新增员工信息字段」后会出现在这里。
                </p>
              ) : (
                <div className="divide-y divide-[var(--lxxl-border)] rounded-xl border border-[var(--lxxl-border)]">
                  {customFields.map((field) => (
                    <div className="flex items-center gap-3 px-4 py-3" key={field.id}>
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          checked={draftIds.includes(field.id)}
                          disabled={saving}
                          type="checkbox"
                          onChange={(event) => toggleDraft(field.id, event.target.checked)}
                        />
                        <span className="flex-1">{field.label}</span>
                      </label>
                      <button
                        className="shrink-0 text-sm text-[#A13F37] hover:underline disabled:opacity-50"
                        disabled={saving}
                        type="button"
                        onClick={() => void removeField(field.id)}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-[#A13F37]">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <QueryButton
              className="!w-auto px-4"
              disabled={saving || draftIds.length === 0}
              onClick={() => {
                const ordered = [
                  ...allIds.filter((id) => draftIds.includes(id)),
                  ...customFields.map((field) => field.id).filter((id) => draftIds.includes(id)),
                ];
                if (ordered.length === 0) return;
                void persist(ordered);
              }}
            >
              {saving ? "保存中..." : "保存"}
            </QueryButton>
            <QueryResetButton
              className="!w-auto px-4"
              disabled={saving}
              onClick={() => {
                setDraftIds(allIds);
                void persist(null);
              }}
            >
              恢复默认全部字段
            </QueryResetButton>
          </div>
        </div>
      )}
      {adding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              void addField();
            }}
          >
            <h4 className="text-base font-semibold">新增员工信息字段</h4>
            <p className="mt-2 text-sm text-[var(--lxxl-muted)]">
              只添加到当前企业。字段默认不勾选，勾选并保存后才会出现在这家企业的员工填写页。
            </p>
            <label className="mt-4 block text-sm">
              字段名称
              <input
                autoFocus
                className={`${queryControlClass} mt-2`}
                maxLength={40}
                value={fieldName}
                onChange={(event) => setFieldName(event.target.value)}
              />
            </label>
            {error && <p className="mt-3 text-sm text-[#A13F37]">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="h-10 rounded-xl px-4 text-sm text-[var(--lxxl-ink)] hover:bg-[#F4F1EB]"
                type="button"
                onClick={() => {
                  setAdding(false);
                  setError("");
                }}
              >
                取消
              </button>
              <button
                className="h-10 rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white hover:bg-[var(--lxxl-green-dark)]"
                type="submit"
              >
                确定
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function AssessmentSelectionPanel({
  privateOptions,
  publicOptions,
  selectedIds,
  displayTitles,
  onSave,
}: {
  privateOptions: PrivateAssessmentOption[];
  publicOptions: PrivateAssessmentOption[];
  selectedIds: string[];
  displayTitles: Record<string, string>;
  onSave: (ids: string[], titles: Record<string, string>) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const [draftTitles, setDraftTitles] = useState<Record<string, string>>(displayTitles);

  useEffect(() => {
    setDraftIds(selectedIds);
    setDraftTitles(displayTitles);
  }, [selectedIds, displayTitles]);

  const toggleDraft = (id: string, checked: boolean) => {
    setDraftIds((current) => (checked ? [...current, id] : current.filter((itemId) => itemId !== id)));
    if (!checked) {
      setDraftTitles((current) => {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  const updateDraftTitle = (id: string, title: string) => {
    setDraftTitles((current) => {
      const next = { ...current };
      const trimmed = title.trim();
      if (!trimmed) delete next[id];
      else next[id] = trimmed;
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(draftIds, draftTitles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "量表勾选保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex min-w-0 items-start gap-2">
        <button
          aria-expanded={expanded}
          aria-label={expanded ? "收起量表勾选" : "展开量表勾选"}
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--lxxl-ink)] hover:bg-[#F4F1EB] hover:text-[var(--lxxl-green)]"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <svg
            aria-hidden="true"
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
        <h3 className="text-base font-semibold">量表勾选</h3>
      </div>
      {expanded && (
        <div className="mt-4">
          <p className="mb-4 text-sm text-[var(--lxxl-muted)]">
            勾选后点保存，只对当前企业页面生效。勾选后可点 🖊 修改本企业的量表展示名，不会改母量表管理中的原名称。
          </p>
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium text-[var(--lxxl-ink)]">私有量表</div>
              <AssessmentOptionList
                displayTitles={draftTitles}
                emptyText="暂无已发布私有量表，请先在母量表管理中设置并发布。"
                options={privateOptions}
                selectedIds={draftIds}
                onDisplayTitleChange={updateDraftTitle}
                onToggle={toggleDraft}
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-[var(--lxxl-ink)]">公有量表</div>
              <AssessmentOptionList
                displayTitles={draftTitles}
                emptyText="暂无已发布公有量表，请先在母量表管理中设置并发布。"
                options={publicOptions}
                selectedIds={draftIds}
                onDisplayTitleChange={updateDraftTitle}
                onToggle={toggleDraft}
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-[#A13F37]">{error}</p>}
          <div className="mt-4">
            <QueryButton className="!w-auto px-4" disabled={saving || draftIds.length === 0} onClick={() => void save()}>
              {saving ? "保存中..." : "保存"}
            </QueryButton>
          </div>
        </div>
      )}
    </div>
  );
}

function sameHeroSlides(
  left: AssessmentEnterpriseHeroSlide[],
  right: AssessmentEnterpriseHeroSlide[],
) {
  const normalizedLeft = normalizeHeroSlides(left);
  const normalizedRight = normalizeHeroSlides(right);
  return normalizedLeft.every((slide, index) => {
    const other = normalizedRight[index];
    return slide.imageUrl === other.imageUrl && slide.title === other.title && slide.desc === other.desc;
  });
}

function EnterpriseEditor({
  item,
  options,
  employeeInfoFieldCatalog,
  defaultHeroSlides,
  onClose,
  onSave,
  onPersist,
}: {
  item: AssessmentEnterprise | null;
  options: PrivateAssessmentOption[];
  employeeInfoFieldCatalog: EmployeeInfoFieldOption[];
  defaultHeroSlides: AssessmentEnterpriseHeroSlide[];
  onClose: () => void;
  onSave: (input: {
    id?: string;
    companyName: string;
    siteName: string;
    logoUrl: string;
    slogan: string;
    url: string;
    assessmentIds: string[];
    assessmentTitles: Record<string, string>;
    employeeInfoFields: string[] | null;
    customEmployeeInfoFields?: CustomEmployeeInfoField[];
    heroSlides: AssessmentEnterpriseHeroSlide[];
    hideConsultation?: boolean;
  }) => Promise<void>;
  onPersist: (input: {
    id?: string;
    companyName: string;
    siteName: string;
    logoUrl: string;
    slogan: string;
    url: string;
    assessmentIds: string[];
    assessmentTitles: Record<string, string>;
    employeeInfoFields: string[] | null;
    customEmployeeInfoFields?: CustomEmployeeInfoField[];
    heroSlides: AssessmentEnterpriseHeroSlide[];
    hideConsultation?: boolean;
  }, notice?: string) => Promise<{ id: string }>;
}) {
  const [companyName, setCompanyName] = useState(item?.companyName || "");
  const [siteName, setSiteName] = useState(item?.siteName || "心安 EAP");
  const [logoUrl, setLogoUrl] = useState(item?.logoUrl || "/static/uploads/eap-default-logo.png");
  const [slogan, setSlogan] = useState(item?.slogan || "专业测评，贴心陪伴");
  const [suffix, setSuffix] = useState(item?.slug || generateSecureSuffix);
  const [assessmentIds, setAssessmentIds] = useState<string[]>(item?.assessmentIds || []);
  const [assessmentTitles, setAssessmentTitles] = useState<Record<string, string>>(
    () => ({ ...(item?.assessmentTitles || {}) }),
  );
  const [employeeInfoFields, setEmployeeInfoFields] = useState<string[] | null>(
    () => (Array.isArray(item?.employeeInfoFields) ? [...item.employeeInfoFields] : null),
  );
  const [customEmployeeInfoFields, setCustomEmployeeInfoFields] = useState<CustomEmployeeInfoField[]>(
    () => (item?.customEmployeeInfoFields || []).map((field) => ({ id: field.id, label: field.label })),
  );
  const [hideConsultation, setHideConsultation] = useState(Boolean(item?.hideConsultation));
  const [enterpriseId, setEnterpriseId] = useState(item?.id);
  const [heroSlides, setHeroSlides] = useState<AssessmentEnterpriseHeroSlide[]>(() =>
    normalizeHeroSlides(item?.heroSlides?.length ? item.heroSlides : defaultHeroSlides),
  );
  const [enterpriseArticles, setEnterpriseArticles] = useState<EapArticle[]>([]);
  const reloadArticles = useCallback(async () => {
    const next = enterpriseId
      ? await fetchEnterpriseEapArticles(enterpriseId)
      : await fetchSharedEapArticles();
    setEnterpriseArticles(next);
  }, [enterpriseId]);
  useEffect(() => {
    void reloadArticles();
  }, [reloadArticles]);
  const [saving, setSaving] = useState(false);
  const heroReady = heroSlides.every(
    (slide) => slide.imageUrl.trim() && slide.title.trim() && slide.desc.trim(),
  );
  const heroMatchesDefault = sameHeroSlides(heroSlides, defaultHeroSlides);
  const updateHeroSlide = (index: number, patch: Partial<AssessmentEnterpriseHeroSlide>) => {
    setHeroSlides((current) =>
      current.map((slide, slideIndex) => (slideIndex === index ? { ...slide, ...patch } : slide)),
    );
  };
  const url = `${DEFAULT_BASE_URL}/${suffix}`;
  const formReady = Boolean(
    companyName.trim() && siteName.trim() && logoUrl.trim() && slogan.trim() && suffix.length >= 20 && assessmentIds.length > 0 && heroReady,
  );
  const buildInput = (
    fields: string[] | null,
    assessments?: { ids: string[]; titles: Record<string, string> },
    customFields?: CustomEmployeeInfoField[],
  ) => {
    const ids = assessments?.ids ?? assessmentIds;
    const titleSource = assessments?.titles ?? assessmentTitles;
    const titlesForSelected = Object.fromEntries(
      ids
        .map((id) => [id, (titleSource[id] || "").trim()] as const)
        .filter(([, title]) => Boolean(title)),
    );
    return {
      id: enterpriseId,
      companyName: companyName.trim(),
      siteName: siteName.trim(),
      logoUrl: logoUrl.trim(),
      slogan: slogan.trim(),
      url: url.trim(),
      assessmentIds: ids,
      assessmentTitles: titlesForSelected,
      employeeInfoFields: fields,
      customEmployeeInfoFields: customFields ?? customEmployeeInfoFields,
      hideConsultation,
      heroSlides: heroSlides.map((slide) => ({
        imageUrl: slide.imageUrl.trim(),
        title: slide.title.trim(),
        desc: slide.desc.trim(),
      })),
    };
  };
  const persistEmployeeInfo = async (
    fields: string[] | null,
    customFields: CustomEmployeeInfoField[],
  ) => {
    setEmployeeInfoFields(fields);
    setCustomEmployeeInfoFields(customFields);
    if (!formReady) {
      throw new Error("请先补全公司信息、轮播图并至少选择一个量表。员工信息会随页面底部的确认保存一起生效。");
    }
    const saved = await onPersist(
      buildInput(fields, undefined, customFields),
      "员工信息已保存，已应用到当前企业页面",
    );
    if (saved.id) setEnterpriseId(saved.id);
  };
  const persistAssessments = async (ids: string[], titles: Record<string, string>) => {
    const baseReady = Boolean(
      companyName.trim() && siteName.trim() && logoUrl.trim() && slogan.trim() && suffix.length >= 20 && heroReady,
    );
    if (!baseReady || ids.length === 0) {
      throw new Error("请先补全公司信息、轮播图并至少勾选一个量表。量表勾选会随页面底部的确认保存一起生效。");
    }
    setAssessmentIds(ids);
    setAssessmentTitles(titles);
    const saved = await onPersist(buildInput(employeeInfoFields, { ids, titles }), "量表勾选已保存，已应用到当前企业页面");
    if (saved.id) setEnterpriseId(saved.id);
  };
  const privateOptions = options.filter((option) => option.visibility === "private");
  const publicOptions = options.filter((option) => option.visibility !== "private");

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
      <div className="border-b border-[var(--lxxl-border)] px-6 py-5 sm:px-7 lg:px-8">
        <button
          className="text-sm font-medium text-[var(--lxxl-green)] hover:underline"
          type="button"
          onClick={onClose}
        >
          返回企业列表
        </button>
        <h2 className="mt-2 text-xl font-semibold">{item ? "编辑公司链接" : "新增公司链接"}</h2>
      </div>
      <div className="px-6 py-6 sm:px-7 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <QueryField label="公司名" required>
            <input className={queryControlClass} value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          </QueryField>
          <QueryField label="网站名" required>
            <input className={queryControlClass} value={siteName} onChange={(event) => setSiteName(event.target.value)} />
          </QueryField>
          <div className="lg:col-span-2">
            <ContentImageUpload label="网站左上角 Logo" required value={logoUrl} onChange={setLogoUrl} />
          </div>
          <div className="lg:col-span-2">
            <QueryField label="口号" required>
              <input className={queryControlClass} value={slogan} onChange={(event) => setSlogan(event.target.value)} />
            </QueryField>
          </div>
          <div className="lg:col-span-2">
            <QueryField label="专属 URL" required>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className={`${queryControlClass} flex min-w-0 flex-1 items-center overflow-x-auto bg-[#F7F5F2] text-[var(--lxxl-muted)]`}>
                  {DEFAULT_BASE_URL}/
                </div>
                <input
                  className={`${queryControlClass} min-w-64 flex-1 font-mono`}
                  minLength={20}
                  value={suffix}
                  onChange={(event) => setSuffix(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                />
                <QueryResetButton onClick={() => setSuffix(generateSecureSuffix())}>
                  重新生成
                </QueryResetButton>
              </div>
              <p className="mt-1 break-all text-xs text-[var(--lxxl-muted)]">
                完整链接：{url}。前缀固定为中建站点域名，随机后缀用于降低链接被猜测的风险。
              </p>
            </QueryField>
          </div>
          <div className="lg:col-span-2 border-t border-[var(--lxxl-border)] pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">首页轮播图</h3>
                <p className="mt-1 text-sm text-[var(--lxxl-muted)]">
                  {heroMatchesDefault
                    ? "当前使用通用首页轮播。在这里修改并保存后，只改变本企业链接的首页，通用轮播保持原样。"
                    : "已改为本企业专属轮播。保存后只在本企业链接展示，不会改动通用首页轮播。"}
                </p>
              </div>
              {!heroMatchesDefault && (
                <button
                  className="text-sm font-medium text-[var(--lxxl-green)] hover:underline"
                  type="button"
                  onClick={() => setHeroSlides(normalizeHeroSlides(defaultHeroSlides))}
                >
                  恢复通用轮播
                </button>
              )}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {heroSlides.map((slide, index) => (
                <div
                  key={`enterprise-hero-${index}`}
                  className="rounded-xl border border-[var(--lxxl-border)] bg-[#FAF8F4] p-4"
                >
                  <div className="mb-3 text-sm font-medium text-[var(--lxxl-ink)]">第 {index + 1} 张</div>
                  <ContentImageUpload
                    label="轮播图片"
                    required
                    value={slide.imageUrl}
                    onChange={(imageUrl) => updateHeroSlide(index, { imageUrl })}
                  />
                  <div className="mt-3 space-y-3">
                    <QueryField label="标题" required>
                      <input
                        className={queryControlClass}
                        value={slide.title}
                        maxLength={40}
                        onChange={(event) => updateHeroSlide(index, { title: event.target.value })}
                      />
                    </QueryField>
                    <QueryField label="说明文字" required>
                      <input
                        className={queryControlClass}
                        value={slide.desc}
                        maxLength={120}
                        onChange={(event) => updateHeroSlide(index, { desc: event.target.value })}
                      />
                    </QueryField>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            <EapArticleSection
              articles={enterpriseArticles}
              divided
              enterpriseId={enterpriseId}
              mode="enterprise"
              onChange={reloadArticles}
            />
          </div>
          <div className="mt-8 border-y border-[var(--lxxl-border)] py-6 lg:col-span-2">
            <EmployeeInfoTemplatePanel
              catalog={employeeInfoFieldCatalog}
              customFields={customEmployeeInfoFields}
              value={employeeInfoFields}
              onChange={setEmployeeInfoFields}
              onCustomFieldsChange={setCustomEmployeeInfoFields}
              onPersist={persistEmployeeInfo}
            />
          </div>
          <div className="mt-8 border-b border-[var(--lxxl-border)] pb-6 lg:col-span-2">
            <AssessmentSelectionPanel
              displayTitles={assessmentTitles}
              privateOptions={privateOptions}
              publicOptions={publicOptions}
              selectedIds={assessmentIds}
              onSave={persistAssessments}
            />
          </div>
          <div className="mt-8 border-b border-[var(--lxxl-border)] pb-6 lg:col-span-2">
            <h3 className="text-base font-semibold">预约心理咨询</h3>
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                checked={hideConsultation}
                className="mt-1"
                type="checkbox"
                onChange={(event) => setHideConsultation(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-[var(--lxxl-ink)]">隐藏预约心理咨询</span>
                <span className="mt-1 block text-sm text-[var(--lxxl-muted)]">
                  勾选后点确认保存，当前企业页面不再显示预约心理咨询按钮、预约咨询卡片、咨询师照片和预约流程。只对这家企业生效。
                </span>
              </span>
            </label>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <QueryButton
            disabled={saving || !formReady}
            onClick={() => {
              setSaving(true);
              void onSave(buildInput(employeeInfoFields)).finally(() => setSaving(false));
            }}
          >
            {saving ? "保存中..." : "确认保存"}
          </QueryButton>
          <QueryResetButton disabled={saving} onClick={onClose}>取消</QueryResetButton>
        </div>
      </div>
    </section>
  );
}

function QrDialog({
  value,
  onClose,
}: {
  value: { companyName: string; url: string; svg: string };
  onClose: () => void;
}) {
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value.svg)}`;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
        <h3 className="text-lg font-semibold">{value.companyName}专属二维码</h3>
        <img alt={`${value.companyName}专属链接二维码`} className="mx-auto mt-5 h-64 w-64" src={source} />
        <p className="mt-4 break-all text-xs text-[var(--lxxl-muted)]">{value.url}</p>
        <div className="mt-5 flex justify-center gap-3">
          <a className="inline-flex h-10 items-center rounded-xl bg-[var(--lxxl-green)] px-4 text-sm font-medium text-white" download={`${value.companyName}-二维码.svg`} href={source}>
            下载二维码
          </a>
          <QueryResetButton onClick={onClose}>关闭</QueryResetButton>
        </div>
      </section>
    </div>
  );
}
