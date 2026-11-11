import assert from "node:assert/strict";
import test from "node:test";

import { safeRedirectPath, withRedirectQuery } from "./redirect.ts";

test("keeps in-site paths with query strings", () => {
  assert.equal(safeRedirectPath("/consultation?id=3&source=eap"), "/consultation?id=3&source=eap");
  assert.equal(safeRedirectPath(" /assessment/reports "), "/assessment/reports");
});

test("rejects anything that can leave the site", () => {
  for (const value of [
    "https://evil.example.com",
    "//evil.example.com",
    "/\\evil.example.com",
    "/\t/evil.example.com",
    "javascript:alert(1)",
    "consultation",
    "",
    undefined,
    ["/a", "/b"],
  ]) {
    assert.equal(safeRedirectPath(value), undefined, String(value));
  }
});

test("carries the redirect target between login and register", () => {
  assert.equal(withRedirectQuery("/register"), "/register");
  assert.equal(
    withRedirectQuery("/register", "/consultation?id=3"),
    "/register?redirect=%2Fconsultation%3Fid%3D3",
  );
});
