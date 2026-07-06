import fs from "node:fs";
import path from "node:path";
import { serializeCase } from "../cases.mjs";
import { formatNumber, formatPackageVersions, renderTable } from "./format.mjs";
import { root } from "./paths.mjs";
import { collectPackageVersions, collectSystemInfo } from "./system.mjs";

export function createReport({ createdAt = new Date().toISOString(), metrics, caseResults, options }) {
  const report = {
    createdAt,
    kind: "combined",
    metrics: metrics.map((metric) => metric.id),
    system: collectSystemInfo(),
    packageVersions: collectPackageVersions(),
    options: {
      metrics: metrics.map((metric) => metric.id),
      tools: options.tools,
      caseIds: options.caseIds,
      runs: options.runs,
      edits: options.edits,
      sampleIntervalMs: options.sampleIntervalMs,
      memoryMode: options.memoryMode,
      devMemoryMode: options.devMemoryMode,
      resolvedBuildMemoryMode: options.resolvedBuildMemoryMode,
      resolvedDevMemoryMode: options.resolvedDevMemoryMode
    },
    cases: caseResults
  };

  if (caseResults.length === 1) {
    report.case = caseResults[0].case;
    report.results = caseResults[0].runResults;
  }

  return report;
}

export function printReport(report, metrics) {
  for (const caseResult of report.cases) {
    console.log(`\nSummary: ${caseResult.case.id}`);
    for (const run of selectRunsForMetrics(metrics)) {
      const runMetrics = metrics.filter((metric) => metric.run === run);
      console.log(`\n${run}:`);
      console.log(renderRunTable(caseResult, run, runMetrics));
    }
  }
}

export function writeReport(report, metrics) {
  const resultsDir = path.join(root, ".results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const stamp = report.createdAt.replaceAll(":", "-").replace(".", "-");
  const jsonPath = path.join(resultsDir, `benchmark-${stamp}.json`);
  const mdPath = path.join(resultsDir, `benchmark-${stamp}.md`);

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report, metrics));
  console.log(`\nwrote ${path.relative(root, jsonPath)}`);
  console.log(`wrote ${path.relative(root, mdPath)}`);

  for (const caseResult of report.cases) {
    const caseReport = createSingleCaseReport(report, caseResult);
    const caseJsonPath = path.join(resultsDir, `benchmark-${stamp}-${caseResult.case.safeId}.json`);
    const caseMdPath = path.join(resultsDir, `benchmark-${stamp}-${caseResult.case.safeId}.md`);
    fs.writeFileSync(caseJsonPath, `${JSON.stringify(caseReport, null, 2)}\n`);
    fs.writeFileSync(caseMdPath, renderMarkdown(caseReport, metrics));
    console.log(`wrote ${path.relative(root, caseJsonPath)}`);
    console.log(`wrote ${path.relative(root, caseMdPath)}`);
  }
}

function createSingleCaseReport(report, caseResult) {
  return {
    ...report,
    case: caseResult.case,
    results: caseResult.runResults,
    cases: [caseResult]
  };
}

function renderMarkdown(report, metrics) {
  return `# Persistent Cache Benchmark

- Created: ${report.createdAt}
- Metrics: ${report.metrics.join(", ")}
- Node: ${report.system.node}
- Platform: ${report.system.platform}/${report.system.arch}
- CPUs: ${report.system.cpus}
- Total memory: ${formatNumber(report.system.totalMemoryMb)} MB
- Cases: ${report.cases.map((caseResult) => caseResult.case.id).join(", ")}
- Packages: ${formatPackageVersions(report.packageVersions)}

${report.cases.map((caseResult) => renderCaseMarkdown(caseResult, metrics)).join("\n\n")}
`;
}

function renderCaseMarkdown(caseResult, metrics) {
  const sections = [
    `## Case: ${caseResult.case.id}

- ID: ${caseResult.case.id}
- Entry: ${caseResult.case.entry}${caseResult.editTarget ? `\n- Dev edit target: ${caseResult.editTarget}` : ""}`
  ];

  for (const run of selectRunsForMetrics(metrics)) {
    const runMetrics = metrics.filter((metric) => metric.run === run);
    sections.push(`### Run: ${run}\n\n${renderRunTable(caseResult, run, runMetrics)}`);
  }

  return sections.join("\n\n");
}

export function createCaseResult(benchCase) {
  return {
    case: serializeCase(benchCase),
    runResults: {}
  };
}

function renderRunTable(caseResult, run, metrics) {
  const rows = [
    ["tool", ...metrics.map((metric) => metric.label)],
    ["---", ...metrics.map(() => "---:")]
  ];

  for (const result of caseResult.runResults[run]?.results ?? []) {
    rows.push([result.label, ...metrics.map((metric) => metric.read(result))]);
  }

  return renderTable(rows);
}

function selectRunsForMetrics(metrics) {
  const runs = [];
  const seen = new Set();
  for (const metric of metrics) {
    if (seen.has(metric.run)) {
      continue;
    }
    seen.add(metric.run);
    runs.push(metric.run);
  }
  return runs;
}
