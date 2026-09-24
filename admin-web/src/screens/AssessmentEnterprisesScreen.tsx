"use client";

import { useCallback, useEffect, useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { ContentImageUpload } from "@/components/content/ContentImageUpload";
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
  fetchPrivateAssessmentOptions,
  generateAssessmentEnterpriseQrCode,
  saveAssessmentEnterprise,
  saveAssessmentEnterpriseDefault,
} from "@/services/assessmentEnterprises";
import type {
  AssessmentEnterprise,
  AssessmentEnterpriseBranding,
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
  const { clearNotice, refreshKey, showNotice } = useAppRoute();
  const [items, setItems] = useState<AssessmentEnterprise[]>([]);
  const [assessmentOptions, setAssessmentOptions] = useState<PrivateAssessmentOption[]>([]);
  const [defaultBranding, setDefaultBranding] = useState<AssessmentEnterpriseBranding>();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AssessmentEnterprise | null | undefined>(undefined);
  const [qr, setQr] = useState<{ companyName: string; url: string; svg: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    clearNotice();
    try {
      const [enterprises, privateAssessments, branding] = await Promise.all([
        fetchAssessmentEnterprises(),
        fetchPrivateAssessmentOptions(),
        fetchAssessmentEnterpriseDefault(),
      ]);
      setItems(enterprises);
      setAssessmentOptions(privateAssessments);
      setDefaultBranding(branding);
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "企业定制配置加载失败");
    } finally {
      setLoading(false);
    }
  }, [clearNotice, showNotice]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

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
      <section className="overflow-hidden rounded-xl border border-[var(--lxxl-border)] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 sm:px-7 lg:px-8">
          <div>
            <h2 className="text-xl font-semibold">企业定制</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--lxxl-muted)]">
              为企业创建专属访问链接，授权已发布的私有量表，并生成可下载二维码。
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
                    <th className="px-5 py-3 font-medium">私有量表</th>
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
                        {item.assessmentIds.map((id) => assessmentOptions.find((option) => option.id === id)?.title || id).join("、")}
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

      {editing !== undefined && (
        <EnterpriseEditor
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
        />
      )}
      {qr && <QrDialog value={qr} onClose={() => setQr(undefined)} />}
    </>
  );
}

function DefaultBrandingEditor({
  value,
  onSave,
}: {
  value: AssessmentEnterpriseBranding;
  onSave: (input: AssessmentEnterpriseBranding) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(value), [value]);

  return (
    <section className="mb-6 rounded-xl border border-[var(--lxxl-border)] bg-white p-6 sm:p-7 lg:p-8">
      <h2 className="text-xl font-semibold">默认设置</h2>
      <p className="mt-2 text-sm text-[var(--lxxl-muted)]">
        控制不带企业专属后缀访问网站时显示的品牌信息。
      </p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <QueryField label="网站名" required>
          <input className={queryControlClass} value={draft.siteName} onChange={(event) => setDraft({ ...draft, siteName: event.target.value })} />
        </QueryField>
        <QueryField label="公司名" required>
          <input className={queryControlClass} value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} />
        </QueryField>
        <div className="lg:col-span-2">
          <ContentImageUpload label="网站 Logo" required value={draft.logoUrl} onChange={(logoUrl) => setDraft({ ...draft, logoUrl })} />
        </div>
        <div className="lg:col-span-2">
          <QueryField label="口号" required>
            <input className={queryControlClass} value={draft.slogan} onChange={(event) => setDraft({ ...draft, slogan: event.target.value })} />
          </QueryField>
        </div>
      </div>
      <div className="mt-5">
        <QueryButton
          disabled={saving || Object.values(draft).some((text) => !text.trim())}
          onClick={() => {
            setSaving(true);
            void onSave({
              companyName: draft.companyName.trim(),
              siteName: draft.siteName.trim(),
              logoUrl: draft.logoUrl.trim(),
              slogan: draft.slogan.trim(),
            }).finally(() => setSaving(false));
          }}
        >
          {saving ? "保存中..." : "保存默认设置"}
        </QueryButton>
      </div>
    </section>
  );
}

function EnterpriseEditor({
  item,
  options,
  onClose,
  onSave,
}: {
  item: AssessmentEnterprise | null;
  options: PrivateAssessmentOption[];
  onClose: () => void;
  onSave: (input: { id?: string; companyName: string; siteName: string; logoUrl: string; slogan: string; url: string; assessmentIds: string[] }) => Promise<void>;
}) {
  const [companyName, setCompanyName] = useState(item?.companyName || "");
  const [siteName, setSiteName] = useState(item?.siteName || "广厦心安");
  const [logoUrl, setLogoUrl] = useState(item?.logoUrl || "/assets/guangsha-xinan-logo.jpg");
  const [slogan, setSlogan] = useState(item?.slogan || "建广厦万间，护心安一寸");
  const [suffix, setSuffix] = useState(item?.slug || generateSecureSuffix);
  const [assessmentIds, setAssessmentIds] = useState<string[]>(item?.assessmentIds || []);
  const [saving, setSaving] = useState(false);
  const url = `${DEFAULT_BASE_URL}/${suffix}`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-6">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold">{item ? "编辑公司链接" : "新增公司链接"}</h3>
        <div className="mt-5 space-y-4">
          <QueryField label="公司名" required>
            <input className={queryControlClass} value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          </QueryField>
          <QueryField label="网站名" required>
            <input className={queryControlClass} value={siteName} onChange={(event) => setSiteName(event.target.value)} />
          </QueryField>
          <ContentImageUpload label="网站左上角 Logo" required value={logoUrl} onChange={setLogoUrl} />
          <QueryField label="口号" required>
            <input className={queryControlClass} value={slogan} onChange={(event) => setSlogan(event.target.value)} />
          </QueryField>
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
          <QueryField label="授权私有量表" required>
            <div className="divide-y divide-[var(--lxxl-border)] rounded-xl border border-[var(--lxxl-border)]">
              {options.length === 0 ? (
                <div className="px-4 py-5 text-sm text-[var(--lxxl-muted)]">暂无已发布私有量表，请先在量表管理中设置并发布。</div>
              ) : options.map((option) => (
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3" key={option.id}>
                  <input
                    checked={assessmentIds.includes(option.id)}
                    type="checkbox"
                    onChange={(event) =>
                      setAssessmentIds((current) =>
                        event.target.checked
                          ? [...current, option.id]
                          : current.filter((id) => id !== option.id),
                      )
                    }
                  />
                  <span>{option.title}</span>
                  <span className="text-xs text-[var(--lxxl-muted)]">{option.id}</span>
                </label>
              ))}
            </div>
          </QueryField>
        </div>
        <div className="mt-6 flex gap-3">
          <QueryButton
            disabled={saving || !companyName.trim() || !siteName.trim() || !logoUrl.trim() || !slogan.trim() || suffix.length < 20 || assessmentIds.length === 0}
            onClick={() => {
              setSaving(true);
              void onSave({
                id: item?.id,
                companyName: companyName.trim(),
                siteName: siteName.trim(),
                logoUrl: logoUrl.trim(),
                slogan: slogan.trim(),
                url: url.trim(),
                assessmentIds,
              })
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "保存中..." : "确认保存"}
          </QueryButton>
          <QueryResetButton disabled={saving} onClick={onClose}>取消</QueryResetButton>
        </div>
      </section>
    </div>
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
