import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function importTypeScript(name) {
  const sourceUrl = new URL(name, import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    fileName: sourceUrl.pathname,
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const canvasPdf = await importTypeScript("./canvas-pdf.ts");
const agreements = await importTypeScript("./consultationAgreement.ts");
const counselorAvatar = await importTypeScript("./counselor-avatar.ts");

test("Canvas 文本按测量宽度分页并保留空行", () => {
  const context = { measureText: (text) => ({ width: Array.from(text).length * 10 }) };
  assert.deepEqual(canvasPdf.splitCanvasText(context, "中文AB\n\n尾行", 30), ["中文A", "B", "", "尾行"]);
});

test("PDF 文件名替换 Windows 非法字符", () => {
  assert.equal(canvasPdf.sanitizePdfFilename(' 张三:咨询/记录? '), "张三_咨询_记录_.pdf");
});

test("同心理协议构建替换全部签约占位符", () => {
  const result = agreements.buildTongxinConsultationAgreement("王老师", 680, {
    name: "李女士",
    relation: "母亲",
    phone: "13800000000",
  });
  assert.match(result, /王老师/);
  assert.match(result, /680元整/);
  assert.match(result, /136元整/);
  assert.match(result, /李女士/);
  assert.doesNotMatch(result, /【(?:咨询师姓名|费用|超时费用|紧急联系人)/);
});

test("扬帆协议为空联系人时保留可填写横线", () => {
  const result = agreements.buildYangfanConsultationAgreement("周老师", 100, null);
  assert.match(result, /周老师/);
  assert.match(result, /__________________/);
});

test("咨询师头像仅接受指定格式且不超过 10MB", () => {
  assert.equal(
    counselorAvatar.getCounselorAvatarFileError({ type: "image/webp", size: 1024 }),
    null,
  );
  assert.match(
    counselorAvatar.getCounselorAvatarFileError({ type: "image/gif", size: 1024 }),
    /JPEG、PNG 或 WebP/,
  );
  assert.match(
    counselorAvatar.getCounselorAvatarFileError({
      type: "image/png",
      size: counselorAvatar.COUNSELOR_AVATAR_MAX_BYTES + 1,
    }),
    /10MB/,
  );
});
