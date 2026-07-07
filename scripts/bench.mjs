import { DEFAULT_CASE_ID, listCaseIds, prepareCase, selectCases } from "./cases.mjs";
import { createCaseResult, createReport, printReport, writeReport } from "./lib/report.mjs";
import { resolveBuildMemoryMode, resolveDevMemoryMode } from "./lib/process.mjs";
import { BUILD_TARGETS, DEFAULT_TOOL_IDS, DEV_TARGETS, ensureToolBins, TOOL_IDS } from "./lib/tools.mjs";
import { DEFAULT_METRIC_IDS, listMetricIds, selectMetrics } from "./metrics/registry.mjs";
import { selectRuns } from "./runs/registry.mjs";

const options = parseArgs(process.argv.slice(2));
await main(options);

async function main(opts) {
  if (opts.listCases) {
    console.log(listCaseIds().join("\n"));
    return;
  }

  if (opts.listMetrics) {
    console.log(listMetricIds().join("\n"));
    return;
  }

  if (opts.help) {
    printHelpAndExit();
  }

  const metrics = selectMetrics(opts.metricIds);
  const runs = selectRuns(metrics);
  const selectedCases = selectCases(opts.caseIds);

  if (runs.some((run) => run.id === "prod")) {
    ensureToolBins(opts.tools, BUILD_TARGETS);
    opts.resolvedBuildMemoryMode = await resolveBuildMemoryMode(opts.memoryMode);
    console.log(`prod memory mode: ${opts.resolvedBuildMemoryMode}`);
  }

  if (runs.some((run) => run.id === "dev")) {
    ensureToolBins(opts.tools, DEV_TARGETS);
    const requestedDevMemoryMode = opts.devMemoryMode ?? (opts.memoryMode === "time" ? "auto" : opts.memoryMode);
    opts.resolvedDevMemoryMode = resolveDevMemoryMode(requestedDevMemoryMode);
    console.log(`dev memory mode: ${opts.resolvedDevMemoryMode}`);
  }

  const caseResults = [];
  for (const benchCase of selectedCases) {
    const caseResult = createCaseResult(benchCase);
    console.log(`\nCase: ${benchCase.id}`);
    await prepareCase(benchCase, { verbose: opts.verbose });

    for (const run of runs) {
      console.log(`\n=== Run: ${run.title} ===`);
      const runResult = await run.run({ benchCase, options: opts });
      caseResult.runResults[run.id] = runResult;
      if (runResult.editTarget) {
        caseResult.editTarget = runResult.editTarget;
      }
      if (runResult.editTargets) {
        caseResult.editTargets = runResult.editTargets;
      }
    }

    caseResults.push(caseResult);
  }

  const report = createReport({ metrics, caseResults, options: opts });
  printReport(report, metrics);
  writeReport(report, metrics);
}

function parseArgs(args) {
  const opts = {
    metricIds: DEFAULT_METRIC_IDS,
    tools: DEFAULT_TOOL_IDS,
    caseIds: listCaseIds(),
    runs: 3,
    edits: 5,
    editDelayMs: 0,
    sampleIntervalMs: 50,
    memoryMode: "auto",
    devMemoryMode: null,
    readyTimeoutMs: 120000,
    rebuildTimeoutMs: 120000,
    requestTimeoutMs: 120000,
    verbose: false,
    listCases: false,
    listMetrics: false,
    help: false
  };

  for (const arg of args) {
    if (arg.startsWith("--metrics=")) {
      opts.metricIds = parseCsv(arg.slice("--metrics=".length));
    } else if (arg.startsWith("--tools=")) {
      opts.tools = parseCsv(arg.slice("--tools=".length));
    } else if (arg.startsWith("--case=")) {
      opts.caseIds = [arg.slice("--case=".length).trim()].filter(Boolean);
    } else if (arg.startsWith("--cases=")) {
      opts.caseIds = parseCsv(arg.slice("--cases=".length));
    } else if (arg.startsWith("--runs=")) {
      opts.runs = parsePositiveInt(arg.slice("--runs=".length), "runs");
    } else if (arg.startsWith("--edits=")) {
      opts.edits = parsePositiveInt(arg.slice("--edits=".length), "edits");
    } else if (arg.startsWith("--edit-delay-ms=")) {
      opts.editDelayMs = parseNonNegativeInt(arg.slice("--edit-delay-ms=".length), "edit-delay-ms");
    } else if (arg.startsWith("--sample-interval-ms=")) {
      opts.sampleIntervalMs = parsePositiveInt(arg.slice("--sample-interval-ms=".length), "sample-interval-ms");
    } else if (arg.startsWith("--memory-mode=")) {
      opts.memoryMode = arg.slice("--memory-mode=".length);
    } else if (arg.startsWith("--dev-memory-mode=")) {
      opts.devMemoryMode = arg.slice("--dev-memory-mode=".length);
    } else if (arg.startsWith("--ready-timeout-ms=")) {
      opts.readyTimeoutMs = parsePositiveInt(arg.slice("--ready-timeout-ms=".length), "ready-timeout-ms");
    } else if (arg.startsWith("--rebuild-timeout-ms=")) {
      opts.rebuildTimeoutMs = parsePositiveInt(arg.slice("--rebuild-timeout-ms=".length), "rebuild-timeout-ms");
    } else if (arg.startsWith("--request-timeout-ms=")) {
      opts.requestTimeoutMs = parsePositiveInt(arg.slice("--request-timeout-ms=".length), "request-timeout-ms");
    } else if (arg === "--verbose") {
      opts.verbose = true;
    } else if (arg === "--list-cases") {
      opts.listCases = true;
    } else if (arg === "--list-metrics") {
      opts.listMetrics = true;
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (opts.metricIds.length === 0) {
    throw new Error("at least one metric is required");
  }
  selectMetrics(opts.metricIds);

  if (opts.tools.length === 0) {
    throw new Error("at least one tool is required");
  }
  for (const tool of opts.tools) {
    if (!TOOL_IDS.includes(tool)) {
      throw new Error(`unknown tool "${tool}". Expected one of: ${TOOL_IDS.join(", ")}`);
    }
  }

  if (opts.caseIds.length === 0) {
    throw new Error("at least one case is required");
  }
  for (const id of opts.caseIds) {
    if (!listCaseIds().includes(id)) {
      throw new Error(`unknown case "${id}". Expected one of: ${listCaseIds().join(", ")}`);
    }
  }

  if (!["auto", "time", "ps", "off"].includes(opts.memoryMode)) {
    throw new Error("--memory-mode must be one of: auto, time, ps, off");
  }
  if (opts.devMemoryMode != null && !["auto", "pidusage", "ps", "off"].includes(opts.devMemoryMode)) {
    throw new Error("--dev-memory-mode must be one of: auto, pidusage, ps, off");
  }

  return opts;
}

function parseCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return parsed;
}

function printHelpAndExit() {
  console.log(`Usage: npm run bench -- [options]

Options:
  --metrics=<ids>              Comma-separated metric ids
  --tools=rspack,webpack,next,utoo
                              Tools to run (default: ${DEFAULT_TOOL_IDS.join(",")})
  --case=${DEFAULT_CASE_ID}             Single bench case
  --cases=react-5k,react-10k  Comma-separated bench cases
  --list-cases                Print available bench cases
  --list-metrics              Print available metric ids
  --runs=3                    Measured production build runs per mode
  --edits=5                   Dev file edits per cache mode
  --sample-interval-ms=50     Build ps RSS polling interval
  --memory-mode=auto          Build RSS mode: auto, time, ps, or off
  --dev-memory-mode=auto      Dev RSS mode: auto, pidusage, ps alias, or off
  --edit-delay-ms=0           Delay after each dev edit before waiting/requesting
  --ready-timeout-ms=120000   Initial dev compile timeout
  --rebuild-timeout-ms=120000 Watch rebuild timeout
  --request-timeout-ms=120000 Next dev HTTP request timeout
  --verbose                   Stream tool output

Default metrics: ${DEFAULT_METRIC_IDS.join(",")}
Default cases: all cases printed by --list-cases
`);
  process.exit(0);
}
