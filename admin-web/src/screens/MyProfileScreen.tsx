"use client";

import { useState } from "react";

import { AppRoute, useAppRoute } from "@/components/AppRoute";
import { updateCurrentUser } from "@/lib/api";
import { MyProfilePanel } from "@/panels/MyProfilePanel";
import { uploadImage } from "@/services/uploads";

export function MyProfileScreen() {
  return (
    <AppRoute sectionId="myProfile">
      <MyProfileScreenContent />
    </AppRoute>
  );
}

function MyProfileScreenContent() {
  const { clearNotice, currentUser, refreshCurrentUser, showNotice } = useAppRoute();
  const [saving, setSaving] = useState(false);

  const handleSave = async (payload: {
    nickname: string;
    realName: string;
    gender: string;
    avatarFile: File | null;
    avatarUrl: string;
  }) => {
    setSaving(true);
    clearNotice();
    try {
      let avatarUrl = payload.avatarUrl.trim() || null;
      if (payload.avatarFile) {
        const uploadResult = await uploadImage(payload.avatarFile);
        avatarUrl = (uploadResult.url || "").trim() || null;
        if (!avatarUrl) {
          throw new Error("头像上传失败，未返回可用地址");
        }
      }

      await updateCurrentUser({
        nickname: payload.nickname,
        realName: payload.realName,
        gender: payload.gender || null,
        avatarUrl,
        markProfileCompleted: true,
      });
      await refreshCurrentUser();
      showNotice("success", "资料已保存");
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return <MyProfilePanel currentUser={currentUser} saving={saving} onSave={handleSave} />;
}
