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
    invocation: collectInvocationInfo(),
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
  const stamp = report.createdAt.replaceAll(":", "-").replace(".", "-");
  const runDir = path.join(resultsDir, `benchmark-${stamp}-${createRunSlug(report)}`);
  const jsonPath = path.join(runDir, "report.json");
  const mdPath = path.join(runDir, "summary.md");

  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report, metrics));

  console.log(`\nwrote ${path.relative(root, mdPath)}`);
  console.log(`wrote ${path.relative(root, jsonPath)}`);
}

function renderMarkdown(report, metrics) {
  return `# Persistent Cache Benchmark

- Created: ${report.createdAt}
- Package script: ${formatOptional(report.invocation.packageScript)}
- Script command: ${formatOptional(report.invocation.packageScriptCommand)}
- Node args: ${formatArgs(report.invocation.argv)}
- Metrics: ${report.metrics.join(", ")}
- Tools: ${report.options.tools.join(", ")}
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
- Entry: ${caseResult.case.entry}${renderCaseEditTarget(caseResult)}`
  ];

  for (const run of selectRunsForMetrics(metrics)) {
    const runMetrics = metrics.filter((metric) => metric.run === run);
    sections.push(`### Run: ${run}\n\n${renderRunTable(caseResult, run, runMetrics)}`);
  }

  return sections.join("\n\n");
}

function renderCaseEditTarget(caseResult) {
  if (caseResult.editTarget) {
    return `\n- Dev edit target: ${caseResult.editTarget}`;
  }
  if (caseResult.editTargets) {
    const editTargets = Object.entries(caseResult.editTargets)
      .map(([tool, editTarget]) => `${tool}: ${editTarget}`)
      .join(", ");
    return `\n- Dev edit targets: ${editTargets}`;
  }
  return "";
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

function collectInvocationInfo() {
  return {
    packageScript: process.env.npm_lifecycle_event ?? null,
    packageScriptCommand: process.env.npm_lifecycle_script ?? null,
    argv: process.argv.slice(2)
  };
}

function createRunSlug(report) {
  const script = safePathSegment(report.invocation.packageScript ?? "node");
  const cases = report.cases.length === 1 ? safePathSegment(report.cases[0].case.safeId) : `${report.cases.length}cases`;
  const tools = report.options.tools.map(safePathSegment).join("-");

  return [script, cases, tools].filter(Boolean).join("-");
}

function safePathSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function formatOptional(value) {
  return value ? `\`${value}\`` : "n/a";
}

function formatArgs(args) {
  return args.length > 0 ? `\`${args.join(" ")}\`` : "none";
}
