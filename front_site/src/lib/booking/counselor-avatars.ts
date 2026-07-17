/** 官网咨询师头像：统一使用 public/images/counselors 本地图片，不依赖后端 AvatarUrl。 */

const COUNSELOR_AVATARS = [
  "/images/counselors/counselor-01.jpg",
  "/images/counselors/counselor-02.jpg",
  "/images/counselors/counselor-03.jpg",
  "/images/counselors/counselor-04.jpg",
  "/images/counselors/counselor-05.jpg",
] as const;

const DEFAULT_AVATAR = COUNSELOR_AVATARS[0];

/** 咨询师姓名 → 本地头像（与 seed / 展示数据对齐，可按需扩展） */
const NAME_TO_AVATAR: Record<string, string> = {
  李心怡: COUNSELOR_AVATARS[0],
  陈启明: COUNSELOR_AVATARS[1],
  王婉清: COUNSELOR_AVATARS[2],
  张明远: COUNSELOR_AVATARS[3],
  林晚晴: COUNSELOR_AVATARS[0],
  陈宇航: COUNSELOR_AVATARS[1],
  苏雅文: COUNSELOR_AVATARS[2],
  赵思琪: COUNSELOR_AVATARS[4],
};

export function resolveCounselorAvatar(
  name?: string | null,
  counselorId?: number | null
): string {
  const trimmed = (name || "").trim();
  if (trimmed && NAME_TO_AVATAR[trimmed]) {
    return NAME_TO_AVATAR[trimmed];
  }
  if (counselorId != null && counselorId > 0) {
    return COUNSELOR_AVATARS[(counselorId - 1) % COUNSELOR_AVATARS.length];
  }
  return DEFAULT_AVATAR;
}
