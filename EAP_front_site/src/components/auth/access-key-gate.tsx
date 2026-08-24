"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";

import { markAccessKeyPassed, verifyAccessKey } from "@/lib/access-key-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccessKeyGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [accessKey, setAccessKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!accessKey.trim()) {
      setError("请输入临时访问密钥");
      return;
    }
    setSubmitting(true);
    try {
      if (!verifyAccessKey(accessKey)) {
        setError("访问密钥不正确");
        return;
      }
      markAccessKeyPassed();
      onUnlocked();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="font-serif text-3xl font-bold">临时访问验证</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          当前环境已启用密钥登录，验证通过后将自动以来访身份进入。
        </p>
      </div>

      <form
        className="space-y-5 rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div>
          <Label htmlFor="eap-access-key">临时密钥</Label>
          <Input
            autoComplete="off"
            className="mt-1.5"
            id="eap-access-key"
            placeholder="请输入临时访问密钥"
            type="password"
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? "验证中..." : "验证并进入"}
        </Button>
      </form>
    </div>
  );
}
