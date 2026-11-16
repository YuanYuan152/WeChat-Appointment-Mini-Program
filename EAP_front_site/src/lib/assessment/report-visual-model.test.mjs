import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./report-visual-model.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: sourceUrl.pathname,
});
const visual = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const range = (min, max, level) => ({ min, max, level });

test("level keywords decide the tone before the band position", () => {
  assert.equal(visual.toneFromLevel("低风险"), "good");
  assert.equal(visual.toneFromLevel("中度焦虑"), "moderate");
  assert.equal(visual.toneFromLevel("重度"), "severe");
  assert.equal(visual.toneFromLevel("轻度"), "mild");
  assert.equal(visual.toneFromLevel("高"), "moderate");
  assert.equal(visual.toneFromLevel("未知"), null);
  assert.equal(visual.toneFromLevel("A 型"), null);

  const bands = visual.bandsFromRanges([range(10, 20, "第二档"), range(0, 9, "第一档"), range(21, 30, "第三档")]);
  assert.deepEqual(bands.map((band) => [band.min, band.tone]), [[0, "good"], [10, "mild"], [21, "severe"]]);
  assert.deepEqual(visual.bandsFromRanges([range(0, 10, "综合测评结果")]).map((band) => band.tone), ["neutral"]);
});

test("sum scale uses score ranges for bounds, band and tone", () => {
  const model = visual.buildReportVisualModel(
    { scoringType: "sum", scoreRanges: [range(0, 4, "正常"), range(5, 9, "轻度"), range(10, 27, "重度")] },
    { type: "sum", totalScore: 7, level: "轻度", description: "旧说明", visitorDescription: "来访说明", suggestions: ["多休息", " "] },
  );
  assert.equal(model.kind, "score");
  assert.equal(model.hero.min, 0);
  assert.equal(model.hero.max, 27);
  assert.equal(model.hero.tone, "mild");
  assert.equal(model.hero.description, "来访说明");
  assert.deepEqual(model.hero.suggestions, ["多休息"]);
  assert.ok(Math.abs(model.hero.ratio - 7 / 27) < 1e-9);
});

test("dimension scale shows configured total, nests sub-dimensions and picks the overview", () => {
  const assessment = {
    scoringType: "dimension",
    dimensions: [
      { id: "a", title: "情绪", scoreRanges: [range(0, 5, "平稳"), range(6, 10, "需关注")] },
      { id: "a.b", title: "焦虑", scoreRanges: [range(0, 4, "平稳")] },
      { id: "c", title: "睡眠", scoreRanges: [range(0, 6, "良好")] },
    ],
    totalScore: { title: "综合总分", intro: "全部相加", scoreRanges: [range(0, 10, "平稳"), range(11, 20, "需关注")] },
  };
  const result = {
    type: "dimension",
    dimensions: [
      { id: "a", title: "情绪", score: 7, level: "需关注", description: "情绪说明", suggestions: [] },
      { id: "a.b", title: "焦虑", score: 3, level: "平稳", description: "", suggestions: [] },
      { id: "c", title: "睡眠", score: 2, level: "良好", description: "", suggestions: ["早睡"] },
    ],
    total: { title: "综合总分", score: 12, level: "需关注", visitorDescription: "总分说明", suggestions: ["预约咨询"] },
  };
  const model = visual.buildReportVisualModel(assessment, result);
  assert.equal(model.hero.title, "综合总分");
  assert.equal(model.hero.max, 20);
  assert.equal(model.hero.intro, "全部相加");
  assert.equal(model.groups.length, 1);
  assert.deepEqual(model.groups[0].items.map((item) => item.id), ["a", "c"]);
  assert.deepEqual(model.groups[0].items[0].children.map((item) => item.id), ["a.b"]);
  assert.equal(model.overview, "bars", "两个一级维度用条形对比");
  assert.deepEqual(visual.collectVisualSuggestions(model), ["预约咨询", "早睡"]);
});

test("composed scale groups dimensions by parent scale", () => {
  const assessment = {
    scoringType: "dimension",
    composedFrom: [{ id: "phq" }, { id: "gad" }],
    sourceReports: [
      { sourceId: "phq", sourceTitle: "PHQ-9", dimensions: [{ id: "phq-total" }] },
      { sourceId: "gad", sourceTitle: "GAD-7", dimensions: [{ id: "gad-total" }] },
    ],
    dimensions: [
      { id: "phq-total", title: "总分", scoreRanges: [range(0, 27, "轻度")] },
      { id: "gad-total", title: "总分", scoreRanges: [range(0, 21, "轻度")] },
    ],
  };
  const model = visual.buildReportVisualModel(assessment, {
    type: "dimension",
    dimensions: [
      { id: "phq-total", title: "总分", score: 6, level: "轻度" },
      { id: "gad-total", title: "总分", score: 3, level: "轻度" },
    ],
  });
  assert.deepEqual(model.groups.map((group) => group.title), ["PHQ-9", "GAD-7"]);
  assert.equal(model.hero, null, "各母量表自己的总分仍按维度展示");
  assert.deepEqual(model.bars.map((item) => item.label), ["PHQ-9 · 总分", "GAD-7 · 总分"]);
  assert.deepEqual(model.bars.map((item) => item.title), ["总分", "总分"]);
});

test("cbcl uses fixed cutoffs and promotes the behavior total", () => {
  const questions = Array.from({ length: 119 }, (_, index) => ({ id: `q${index + 1}` }));
  const model = visual.buildReportVisualModel(
    { scoringType: "cbcl", questions },
    {
      type: "dimension",
      summary: "行为问题总分：40",
      dimensions: [
        { id: "withdrawn", title: "退缩", score: 8, level: "需关注" },
        { id: "social", title: "社交问题", score: 2, level: "正常" },
        { id: "behavior-total", title: "行为问题总分", score: 40, level: "需关注" },
      ],
    },
  );
  assert.equal(model.hero.id, "behavior-total");
  assert.equal(model.hero.max, 238);
  assert.equal(model.hero.tone, "moderate");
  assert.equal(model.overview, "bars");
  const withdrawn = model.bars.find((item) => item.id === "withdrawn");
  assert.equal(withdrawn.max, 18);
  assert.deepEqual(withdrawn.markers, [{ value: 6, label: "参考界值 6" }]);
  assert.equal(model.bars.find((item) => item.id === "social").tone, "good");
  assert.equal(model.summary, "行为问题总分：40");
});

test("dark-light shows the three traits on a radar with the total as hero", () => {
  const model = visual.buildReportVisualModel(
    { scoringType: "dark-light" },
    {
      type: "dimension",
      dimensions: [
        { id: "machiavellianism", title: "维度一：马基雅维利主义倾向", score: 10, level: "低" },
        { id: "psychopathy", title: "维度二：精神病态倾向", score: 15, level: "中" },
        { id: "narcissism", title: "维度三：自恋倾向", score: 22, level: "高" },
        { id: "dark-total", title: "综合暗黑等级判断", score: 47, level: "中" },
      ],
    },
  );
  assert.equal(model.hero.id, "dark-total");
  assert.equal(model.hero.min, 12);
  assert.equal(model.hero.max, 84);
  assert.equal(model.overview, "radar");
  assert.deepEqual(model.radar.map((item) => item.tone), ["good", "mild", "moderate"]);
});

test("pbi builds parenting style quadrants", () => {
  const model = visual.buildReportVisualModel(
    { scoringType: "pbi" },
    {
      type: "dimension",
      dimensions: [
        { id: "mother-care", title: "母亲关爱", score: 30, level: "权威型" },
        { id: "mother-autonomy", title: "母亲鼓励自主", score: 13, level: "较高" },
        { id: "mother-control", title: "母亲控制", score: 9, level: "较高" },
        { id: "father-care", title: "父亲关爱", score: 10, level: "放任型" },
        { id: "father-autonomy", title: "父亲鼓励自主", score: 6, level: "一般" },
        { id: "father-control", title: "父亲控制", score: 2, level: "一般" },
      ],
    },
  );
  assert.equal(model.overview, "none");
  assert.deepEqual(model.quadrants.map((item) => [item.id, item.result]), [["mother", "权威型"], ["father", "放任型"]]);
  assert.equal(model.quadrants[0].x.max, 33);
  assert.equal(model.quadrants[0].y.high, 8.64);
  const autonomy = model.groups[0].items.find((item) => item.id === "mother-autonomy");
  assert.equal(autonomy.tone, "good", "固定量表按区间定色，“较高”的鼓励自主是好事");
  const control = model.groups[0].items.find((item) => item.id === "mother-control");
  assert.equal(control.tone, "mild");
});

test("aas match marks the attachment style cell", () => {
  const model = visual.buildReportVisualModel(
    {
      scoringType: "aas",
      matchResults: [
        { id: "secure", title: "安全型", suggestions: ["保持沟通"] },
        { id: "fearful", title: "恐惧型" },
      ],
    },
    { type: "match", resultId: "secure", title: "安全型", description: "说明", image: "", shareText: "分享" },
  );
  assert.equal(model.kind, "match");
  assert.deepEqual(model.match.suggestions, ["保持沟通"]);
  const active = model.match.map.cells.filter((cell) => cell.active);
  assert.deepEqual(active.map((cell) => [cell.id, cell.column, cell.row]), [["secure", 1, 0]]);
  assert.equal(model.match.map.cells.find((cell) => cell.id === "dismissive").title, "冷漠型");
});
