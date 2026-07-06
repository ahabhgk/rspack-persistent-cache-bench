import { writeNextCaseFiles } from "../cases.mjs";
import { average, averageDefined, lastLines } from "../lib/format.mjs";
import { runMeasuredCommand } from "../lib/process.mjs";
import { BUILD_TARGETS, cleanTarget } from "../lib/tools.mjs";

export const prodRun = {
  id: "prod",
  title: "prod",
  run: runProd
};

export async function runProd({ benchCase, options }) {
  if (options.tools.includes("next")) {
    writeNextCaseFiles(benchCase, { importMode: "static" });
  }

  const results = [];
  for (const tool of options.tools) {
    results.push(await benchTool(tool, options, benchCase));
  }

  return { results };
}

async function benchTool(tool, options, benchCase) {
  const target = BUILD_TARGETS[tool];
  console.log(`\n[${target.label}] measuring memory-cache builds`);

  const memoryCacheRuns = [];
  for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
    cleanTarget(target, benchCase, { persistent: false, removeCache: true });
    memoryCacheRuns.push(
      await runBuild(tool, target, false, `memory-cache ${runIndex + 1}/${options.runs}`, options, benchCase)
    );
  }

  console.log(`[${target.label}] warming persistent cache`);
  cleanTarget(target, benchCase, { persistent: true, removeCache: true });
  const warmup = await runBuild(tool, target, true, "persistent warmup", options, benchCase);

  console.log(`[${target.label}] measuring persistent-cache builds`);
  const persistentRuns = [];
  for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
    cleanTarget(target, benchCase, { persistent: true, removeCache: false });
    persistentRuns.push(
      await runBuild(tool, target, true, `persistent ${runIndex + 1}/${options.runs}`, options, benchCase)
    );
  }

  return summarizeTool(tool, target.label, memoryCacheRuns, warmup, persistentRuns);
}

async function runBuild(tool, target, persistentCache, phase, options, benchCase) {
  const [command, args] = target.command({ benchCase });
  const env = {
    ...process.env,
    BENCH_CASE: benchCase.id,
    BENCH_PERSISTENT_CACHE: persistentCache ? "1" : "0",
    CI: "1",
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1"
  };

  console.log(`  - ${phase}`);
  const result = await runMeasuredCommand(command, args, {
    cwd: target.cwd?.(benchCase),
    env,
    verbose: options.verbose,
    memoryMode: options.resolvedBuildMemoryMode,
    sampleIntervalMs: options.sampleIntervalMs
  });

  if (result.exit.code !== 0) {
    const tail = lastLines(`${result.stdout}\n${result.stderr}`, 80);
    throw new Error(`${target.label} ${phase} failed with code ${result.exit.code ?? result.exit.signal}\n${tail}`);
  }

  return {
    tool,
    phase,
    persistentCache,
    durationMs: result.durationMs,
    peakRssMb: result.peakRssMb,
    memoryMode: result.memoryMode
  };
}

function summarizeTool(tool, label, memoryCacheRuns, warmup, persistentRuns) {
  const memoryCacheTimeMs = average(memoryCacheRuns.map((run) => run.durationMs));
  const persistentTimeMs = average(persistentRuns.map((run) => run.durationMs));
  const memoryCacheRssMb = averageDefined(memoryCacheRuns.map((run) => run.peakRssMb));
  const persistentRssMb = averageDefined(persistentRuns.map((run) => run.peakRssMb));
  const timeSavedMs = memoryCacheTimeMs - persistentTimeMs;
  const timeSavedPercent = memoryCacheTimeMs > 0 ? (timeSavedMs / memoryCacheTimeMs) * 100 : null;
  const rssDeltaMb =
    memoryCacheRssMb != null && persistentRssMb != null ? persistentRssMb - memoryCacheRssMb : null;

  return {
    tool,
    label,
    memoryCache: {
      runs: memoryCacheRuns,
      averageDurationMs: memoryCacheTimeMs,
      averagePeakRssMb: memoryCacheRssMb
    },
    persistent: {
      warmup,
      runs: persistentRuns,
      averageDurationMs: persistentTimeMs,
      averagePeakRssMb: persistentRssMb
    },
    comparison: {
      timeSavedMs,
      timeSavedPercent,
      rssDeltaMb
    }
  };
}
