import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("./enterpriseData.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
});
const lib = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const NOW = Date.parse("2026-11-12T04:00:00Z");

function report(overrides) {
  return {
    publicId: overrides.publicId,
    respondentKey: overrides.respondentKey,
    accountId: 1,
    assessmentId: overrides.assessmentId || "bsi",
    assessmentVersion: 1,
    assessmentTitle: overrides.assessmentTitle || "BSI",
    scoringType: "dimension",
    completedAt: overrides.completedAt,
    summary: "",
    resultType: overrides.resultType || "dimension",
    score: overrides.score ?? null,
    level: overrides.level || "",
    dimensions: overrides.dimensions || [],
    autoSeverity: overrides.severity ?? null,
    severity: overrides.severity ?? null,
    triggers: [],
    isLatest: overrides.isLatest ?? true,
    followUp: overrides.followUp ?? null,
  };
}

function respondent(key, info, severity = null, firstAt = "2026-10-01T00:00:00Z") {
  return {
    key,
    accountIds: [1],
    personnel: null,
    name: info.name || "",
    empNo: "",
    displayName: info.name || key,
    info,
    firstAt,
    lastAt: firstAt,
    reportCount: 1,
    completedAssessmentIds: ["bsi"],
    completedCount: 1,
    status: "doing",
    severity,
    tags: [],
    annotationCount: 0,
    lastAnnotatedAt: null,
    lastNote: "",
    lastNoteBy: "",
    lastNoteAt: null,
    learning: null,
  };
}

const dims = (dep, depSeverity) => [
  { id: "dep", title: "抑郁", score: dep, level: depSeverity === "mid" ? "中度抑郁" : "正常", severity: depSeverity },
];

function dataset() {
  const reports = [
    report({ publicId: "r1", respondentKey: "a1", completedAt: "2026-06-01T02:00:00Z", severity: "high", isLatest: false, dimensions: dims(20, "high") }),
    report({ publicId: "r2", respondentKey: "a1", completedAt: "2026-11-01T02:00:00Z", severity: "ok", dimensions: dims(3, "ok") }),
    report({ publicId: "r3", respondentKey: "a2", completedAt: "2026-11-05T02:00:00Z", severity: "mid", dimensions: dims(12, "mid") }),
    report({ publicId: "r4", respondentKey: "a3", completedAt: "2026-10-20T02:00:00Z", severity: "mid", dimensions: dims(13, "mid") }),
    report({ publicId: "r5", respondentKey: "a4", completedAt: "2026-10-21T02:00:00Z", severity: null, dimensions: [] , resultType: "sum", assessmentId: "onb", assessmentTitle: "入职测评", score: 40, level: "综合测评结果" }),
  ];
  return {
    enterprise: {
      id: "e1",
      companyName: "示例",
      siteName: "心安",
      slug: "s",
      url: "",
      logoUrl: "",
      assessmentIds: ["bsi", "onb"],
      loginRequired: true,
      personnelEmployeeCount: 10,
      personnelAdminCount: 0,
      hideLibrary: false,
    },
    generatedAt: "2026-11-12T04:00:00Z",
    fields: [
      { id: "name", label: "姓名", group: "个人信息", enabled: true },
      { id: "dept", label: "所属部门", group: "岗位信息", enabled: true },
      { id: "category", label: "岗位类别", group: "岗位信息", enabled: true },
    ],
    assessments: [
      { id: "bsi", title: "BSI", authorized: true, resultType: "dimension", levels: [], dimensions: [{ id: "dep", title: "抑郁", levels: ["正常", "中度抑郁"] }] },
      { id: "onb", title: "入职测评", authorized: true, resultType: "sum", levels: ["综合测评结果"], dimensions: [] },
    ],
    respondents: [
      respondent("a1", { name: "甲", category: "一线业务" }, "ok", "2026-06-01T02:00:00Z"),
      respondent("a2", { name: "乙", category: "一线业务" }, "mid", "2026-11-05T02:00:00Z"),
      respondent("a3", { name: "丙", category: "职能支持" }, "mid", "2026-10-20T02:00:00Z"),
      respondent("a4", { name: "丁" }, null, "2026-10-21T02:00:00Z"),
    ],
    reports,
    roster: [
      { personnelId: 9, username: "acme00009", empNo: "00009", realName: "", respondentKey: null },
    ],
    learning: { totalViews: 0, learnerCount: 0, linkedLearnerCount: 0, totalMinutes: 0, articleViews: 0, audioPlays: 0, topContents: [] },
    tagLibrary: [{ name: "状态", color: "#C26A0A", tags: ["需要持续关注"] }],
    recentAnnotations: [],
    followUpStatuses: [],
  };
}

test("period scope keeps the latest report in range and recomputes severity", () => {
  const scoped = lib.scopeDataset(dataset(), "90", NOW);
  assert.deepEqual(scoped.reports.map((item) => item.publicId), ["r2", "r3", "r4", "r5"]);
  assert.equal(scoped.respondents.length, 4);
  const all = lib.scopeDataset(dataset(), "all", NOW);
  assert.equal(all.reports.length, 5);
  assert.equal(all.severityByKey.get("a1"), "ok");
  const counts = lib.countSeverities(all.respondents);
  assert.deepEqual([counts.high, counts.mid, counts.ok, counts.none], [0, 2, 1, 1]);
});

test("monthly trend buckets by Beijing month and computes risk rate", () => {
  const data = dataset();
  const trend = lib.buildMonthlyTrend(data.reports, data.respondents, 6, NOW);
  assert.deepEqual(trend.map((point) => point.key), ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  const october = trend.find((point) => point.key === "2026-10");
  assert.equal(october.reports, 2);
  assert.equal(october.newRespondents, 2);
  assert.equal(october.riskRate, 1);
  const november = trend.find((point) => point.key === "2026-11");
  assert.equal(november.riskRate, 0.5);
  assert.equal(lib.chinaMonthKey("2026-10-31T17:00:00Z"), "2026-11");
});

test("group comparison flags the riskier group and builds findings", () => {
  const data = dataset();
  const scoped = lib.scopeDataset(data, "all", NOW);
  const columns = lib.metricColumns(data.assessments, scoped.latest);
  assert.deepEqual(columns.map((column) => column.key), ["bsi::dep", "onb"]);
  const rows = lib.buildGroupComparison(scoped.respondents, scoped.latest, "category", columns);
  assert.deepEqual(rows.map((row) => row.value), ["一线业务", "职能支持", "未填写"]);
  assert.equal(rows[0].riskRate, 0.5);
  assert.equal(rows[0].cells["bsi::dep"].flaggedRate, 0.5);
  assert.equal(rows[1].cells["bsi::dep"].avgScore, 13);
  const overall = Object.fromEntries(columns.map((column) => [column.key, lib.metricCell(scoped.latest, column)]));
  const findings = lib.buildFindings({
    dataset: data,
    scoped,
    groupField: data.fields[2],
    groupRows: rows,
    columns,
    overallCells: overall,
  });
  assert.equal(findings[0].tone, "info");
  assert.match(findings[1].title, /2 人处于中高风险/);
  assert.match(findings.map((item) => item.title).join("|"), /「抑郁」是最突出的短板/);
});

test("assessment stats keep definition level order", () => {
  const data = dataset();
  const scoped = lib.scopeDataset(data, "all", NOW);
  const stats = lib.buildAssessmentStats(data.assessments[0], scoped.latest);
  assert.equal(stats.n, 3);
  assert.deepEqual(stats.dimensions[0].levels.map((item) => [item.level, item.count]), [["正常", 1], ["中度抑郁", 2]]);
  assert.equal(stats.dimensions[0].flaggedRate, 2 / 3);
  const onboarding = lib.buildAssessmentStats(data.assessments[1], scoped.latest);
  assert.equal(onboarding.avgScore, 40);
  assert.equal(onboarding.severity.none, 1);
});

test("archive rows include roster members who have not started", () => {
  const rows = lib.buildArchiveRows(dataset());
  assert.equal(rows.length, 5);
  const todo = rows.find((row) => row.key === "p9");
  assert.equal(todo.status, "todo");
  assert.equal(todo.displayName, "acme00009");
  assert.ok(lib.matchesKeyword(rows[0], "一线"));
  assert.ok(!lib.matchesKeyword(rows[0], "不存在"));
});

test("follow-up override changes report and respondent severity", () => {
  const data = dataset();
  const next = lib.applyFollowUp(data, "r2", {
    status: "following",
    severityOverride: "high",
    owner: "",
    note: "",
    updatedAt: null,
    updatedBy: "",
    history: [],
  });
  assert.equal(next.reports.find((item) => item.publicId === "r2").severity, "high");
  assert.equal(next.respondents.find((item) => item.key === "a1").severity, "high");
  assert.ok(lib.isOpenAlert(next.reports.find((item) => item.publicId === "r2")));
  const cleared = lib.applyFollowUp(next, "r2", {
    status: "resolved",
    severityOverride: null,
    owner: "",
    note: "",
    updatedAt: null,
    updatedBy: "",
    history: [],
  });
  assert.equal(cleared.reports.find((item) => item.publicId === "r2").severity, "ok");
  assert.equal(lib.formatPercent(0.12345), "12.3%");
  assert.equal(lib.formatScore(3.456), "3.46");
});
