const ACCESS_KEY_PASSED_STORAGE_KEY = "lxxl_eap_access_key_passed";

export function isAccessKeyLoginEnabled() {
  return process.env.NEXT_PUBLIC_ACCESS_KEY_LOGIN_ENABLED === "true";
}

export function getConfiguredAccessKey() {
  return (process.env.NEXT_PUBLIC_ACCESS_KEY || "").trim();
}

export function getAccessKeyLoginDevCode() {
  const code = (process.env.NEXT_PUBLIC_ACCESS_KEY_LOGIN_CODE || "dev_admin").trim();
  return code || "dev_admin";
}

export function hasAccessKeyPassed() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.sessionStorage.getItem(ACCESS_KEY_PASSED_STORAGE_KEY) === "1";
}

export function markAccessKeyPassed() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(ACCESS_KEY_PASSED_STORAGE_KEY, "1");
  }
}

export function clearAccessKeyPassed() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(ACCESS_KEY_PASSED_STORAGE_KEY);
  }
}

export function verifyAccessKey(input: string) {
  const expected = getConfiguredAccessKey();
  if (!expected) {
    return false;
  }
  return input.trim() === expected;
}
