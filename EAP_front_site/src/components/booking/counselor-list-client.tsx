"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Headphones } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CounselorCard } from "@/components/booking/counselor-card";
import { ContactAssistantDialog } from "@/components/booking/contact-assistant-dialog";
import { fetchCounselors } from "@/lib/booking/api";
import type { CounselorListItem } from "@/lib/booking/types";

export function CounselorListClient() {
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counselors, setCounselors] = useState<CounselorListItem[]>([]);
  const [contactOpen, setContactOpen] = useState(false);

  const load = useCallback(async (kw?: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchCounselors({
        keyword: kw || undefined,
        page: 1,
        page_size: 50,
      });
      setCounselors(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setCounselors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(keyword.trim());
    load(keyword.trim() || undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索咨询师姓名或擅长领域"
            className="pl-10"
          />
        </form>
        <Button variant="outline" className="shrink-0 gap-2" onClick={() => setContactOpen(true)}>
          <Headphones className="h-4 w-4" />
          联系助理
        </Button>
      </div>

      {loading && (
        <p className="py-12 text-center text-muted-foreground">加载咨询师列表…</p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}（请确认后端已启动）
        </p>
      )}
      {!loading && !error && counselors.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          {search ? "未找到匹配的咨询师" : "暂无可预约咨询师"}
        </p>
      )}
      <div className="space-y-6">
        {counselors.map((c, i) => (
          <CounselorCard key={`${c._source ?? "app"}-${c.id}`} counselor={c} index={i} />
        ))}
      </div>
      <ContactAssistantDialog open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
}
