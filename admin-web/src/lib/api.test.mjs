import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const sourceUrl = new URL("./api.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function installWindow() {
  const target = new EventTarget();
  target.localStorage = new MemoryStorage();
  globalThis.window = target;
  return target;
}

after(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
});

test("apiRequest returns successful non-JSON response text", async () => {
  installWindow();
  globalThis.fetch = async () => new Response("ok", { status: 200 });

  assert.equal(await api.apiRequest("/plain"), "ok");
});

test("apiRequest turns non-JSON error responses into ApiError", async () => {
  installWindow();
  globalThis.fetch = async () => new Response("upstream unavailable", { status: 502 });

  await assert.rejects(
    () => api.apiRequest("/broken"),
    (error) => error instanceof api.ApiError && error.status === 502 && error.message === "upstream unavailable",
  );
});

test("401 clears the stored token and emits the unauthorized event", async () => {
  const target = installWindow();
  let eventCount = 0;
  target.addEventListener(api.AUTH_UNAUTHORIZED_EVENT, () => {
    eventCount += 1;
  });
  api.setStoredToken("expired-token");
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: "登录已过期" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(() => api.apiRequest("/protected"), /登录已过期/);
  assert.equal(api.getStoredToken(), null);
  assert.equal(eventCount, 1);
});

test("a stale 401 cannot clear a newly issued login token", async () => {
  const target = installWindow();
  let eventCount = 0;
  let resolveFetch;
  target.addEventListener(api.AUTH_UNAUTHORIZED_EVENT, () => {
    eventCount += 1;
  });
  api.setStoredToken("old-token");
  globalThis.fetch = () =>
    new Promise((resolve) => {
      resolveFetch = () =>
        resolve(
          new Response(JSON.stringify({ detail: "旧会话已过期" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          }),
        );
    });

  const pendingRequest = api.apiRequest("/slow-protected");
  api.setStoredToken("new-token");
  resolveFetch();

  await assert.rejects(() => pendingRequest, /旧会话已过期/);
  assert.equal(api.getStoredToken(), "new-token");
  assert.equal(eventCount, 0);
});
