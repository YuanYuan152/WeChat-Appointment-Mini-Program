// 制表符、换行等控制字符会被浏览器从 URL 中剔除，反斜杠会被当成斜杠，
// 都可能把 "/\evil.com"、"/\t/evil.com" 变成站外地址。
const UNSAFE_REDIRECT_CHARS = /[\\\s\u0000-\u001f\u007f]/;

/**
 * 登录 / 注册完成后的跳转地址：只接受以单个 “/” 开头的站内路径，
 * 防止 ?redirect= 被用作开放跳转；不合法时返回 undefined（由调用方回到首页）。
 */
export function safeRedirectPath(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || UNSAFE_REDIRECT_CHARS.test(value)) {
    return undefined;
  }
  return value;
}

/** 在登录页与注册页之间切换时保留跳转目标。 */
export function withRedirectQuery(path: string, redirectTo?: string): string {
  return redirectTo ? `${path}?redirect=${encodeURIComponent(redirectTo)}` : path;
}
