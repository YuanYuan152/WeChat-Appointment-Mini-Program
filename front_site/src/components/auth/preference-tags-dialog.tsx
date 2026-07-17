"use client";

import { useEffect, useState } from "react";
import { fetchTagOptions, savePreferenceTags, type TagOptionsResponse } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function TagGroup({
  label,
  hint,
  options,
  selected,
  max,
  onToggle,
}: {
  label: string;
  hint: string;
  options: string[];
  selected: string[];
  max: number;
  onToggle: (tag: string) => void;
}) {
  return (
    <div>
      <div className="mb-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((tag) => {
          const active = selected.includes(tag);
          const disabled = !active && selected.length >= max;
          return (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(tag)}
              className="disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Badge
                variant={active ? "default" : "outline"}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-sm transition-colors",
                  active && "shadow-sm"
                )}
              >
                {tag}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PreferenceTagsDialog() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<TagOptionsResponse | null>(null);
  const [personalTags, setPersonalTags] = useState<string[]>([]);
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const shouldPrompt = Boolean(token && user && !user.hasPreferenceTags);

  useEffect(() => {
    if (!shouldPrompt) {
      setOpen(false);
      return;
    }
    setOpen(true);
    fetchTagOptions()
      .then(setOptions)
      .catch(() => setError("加载标签选项失败"));
  }, [shouldPrompt]);

  const toggleTag = (
    tag: string,
    selected: string[],
    setSelected: (tags: string[]) => void,
    max: number
  ) => {
    if (selected.includes(tag)) {
      setSelected(selected.filter((item) => item !== tag));
      return;
    }
    if (selected.length >= max) return;
    setSelected([...selected, tag]);
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (!personalTags.length || !interestTags.length) {
      setError("请各至少选择 1 个标签");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const updated = await savePreferenceTags(token, personalTags, interestTags);
      setUser(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  if (!shouldPrompt) return null;

  const max = options?.maxPerCategory ?? 5;

  return (
    <Dialog open={open} onOpenChange={() => {}} closeOnBackdrop={false}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>完善你的偏好标签</DialogTitle>
          <DialogDescription>
            帮助我们为你推荐更合适的内容。每个类别可选 1–{max} 个，填写后无需重复选择。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {options ? (
            <>
              <TagGroup
                label="个人标签（人群）"
                hint={`请选择最符合你的身份，最多 ${max} 个`}
                options={options.personalTags}
                selected={personalTags}
                max={max}
                onToggle={(tag) =>
                  toggleTag(tag, personalTags, setPersonalTags, max)
                }
              />
              <TagGroup
                label="感兴趣的心理问题"
                hint={`请选择你想了解或正在关注的方向，最多 ${max} 个`}
                options={options.interestTags}
                selected={interestTags}
                max={max}
                onToggle={(tag) =>
                  toggleTag(tag, interestTags, setInterestTags, max)
                }
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">正在加载标签选项…</p>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            className="w-full"
            disabled={loading || !options || !personalTags.length || !interestTags.length}
            onClick={handleSubmit}
          >
            {loading ? "保存中..." : "完成"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
