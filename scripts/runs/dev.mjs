import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { performance } from "node:perf_hooks";
import puppeteer from "puppeteer";
import { resolveEditTarget, writeNextCaseFiles } from "../cases.mjs";
import { average, averageDefined, formatNumber, lastLines, percentile } from "../lib/format.mjs";
import {
  delay,
  getFreePort,
  measureProcessRssMbAtCpuIdle,
  startManagedProcess,
  stopManagedProcess,
  waitForOutput
} from "../lib/process.mjs";
import { root } from "../lib/paths.mjs";
import { cleanTarget, DEV_TARGETS } from "../lib/tools.mjs";

const BUNDLER_DONE_PATTERN = /compiled (successfully|with)|compiled in|webpack compiled|rspack compiled/i;
const NEXT_READY_PATTERN = /(ready in|started server)/i;
const UTOO_READY_PATTERN = /Local:\s+(?:\x1b\[[\d;]*m)*http:\/\/localhost:(\d+)/i;
const DEV_COMPILE_DURATION_PATTERNS = [
  /\[bench compile\]\s+([0-9.]+)\s*(ms|s)\b/gi,
  /\bCompiled in\s+([0-9.]+)\s*(ms|s)\b/gi,
  /\b(?:Rspack|webpack|Webpack)\s+compiled(?: successfully| with [^\n]*)?\s+in\s+([0-9.]+)\s*(ms|s)\b/gi,
  /[✓✔]\s+Compiled[^\n]*?\bin\s+([0-9.]+)\s*(ms|s)\b/gi
];

export const devRun = {
  id: "dev",
  title: "dev",
  run: runDev
};

export async function runDev({ benchCase, options }) {
  const editTargets = new Map();
  for (const tool of options.tools) {
    editTargets.set(tool, await resolveEditTarget(benchCase, tool));
  }
  const editTargetSummary = summarizeEditTargets(editTargets);
  printEditTargetSummary(editTargetSummary);

  const results = [];
  for (const tool of options.tools) {
    if (tool === "next") {
      writeNextCaseFiles(benchCase, { importMode: "static" });
    }
    results.push(await benchTool(tool, options, benchCase, editTargets.get(tool)));
  }

  return {
    ...editTargetSummary,
    results
  };
}

function summarizeEditTargets(editTargets) {
  const entries = [...editTargets].map(([tool, editTarget]) => [tool, path.relative(root, editTarget)]);
  const uniqueTargets = new Set(entries.map(([, editTarget]) => editTarget));
  if (uniqueTargets.size === 1) {
    return { editTarget: entries[0][1] };
  }
  return { editTargets: Object.fromEntries(entries) };
}

function printEditTargetSummary(summary) {
  if (summary.editTarget) {
    console.log(`edit target: ${summary.editTarget}`);
    return;
  }

  console.log("edit targets:");
  for (const [tool, editTarget] of Object.entries(summary.editTargets)) {
    console.log(`  - ${tool}: ${editTarget}`);
  }
}

async function benchTool(tool, options, benchCase, editTarget) {
  const target = DEV_TARGETS[tool];
  console.log(`\n[${target.label}] measuring memory-cache dev rebuilds`);
  cleanTarget(target, benchCase, { persistent: false, removeCache: true });
  const memoryCache = await runDevSession(tool, target, false, options, benchCase, editTarget);

  console.log(`[${target.label}] measuring persistent-cache dev rebuilds`);
  cleanTarget(target, benchCase, { persistent: true, removeCache: true });
  const persistent = await runDevSession(tool, target, true, options, benchCase, editTarget);

  return summarizeTool(tool, target.label, memoryCache, persistent);
}

async function runDevSession(tool, target, persistentCache, options, benchCase, editTarget) {
  const port = await getFreePort();
  const [command, args] = target.command({ benchCase, port });
  const readyPattern = readyPatternForTool(tool);
  const phase = persistentCache ? "persistent-cache" : "memory-cache";
  const editSession = createEditSession(editTarget);
  if (tool === "utoo") {
    await waitForPortClosed(3000, 10000);
  }
  const startedAt = performance.now();
  const state = startManagedProcess(command, args, {
    cwd: target.cwd?.(benchCase),
    env: createEnv(benchCase, persistentCache, port),
    verbose: options.verbose
  });

  let browser = null;
  let page = null;
  let serverPort = null;
  try {
    const readyOutput = await waitForOutput(state, readyPattern, options.readyTimeoutMs, `${target.label} ready`);
    serverPort = tool === "utoo" ? parseUtooPort(readyOutput) : port;
    const url = `http://127.0.0.1:${serverPort}/`;

    browser = await puppeteer.launch(createBrowserLaunchOptions());
    page = await browser.newPage();
    attachVerbosePageLogging(page, options, target.label);
    const pageHmrReady = waitForInitialPageHmrReady(page, tool, options.requestTimeoutMs);
    await openDevPage(page, url, tool, benchCase, options.requestTimeoutMs);
    const initialCompileMs = performance.now() - startedAt;
    const edits = [];

    await waitBeforeFirstEdit(pageHmrReady, tool, benchCase);

    for (let editIndex = 0; editIndex < options.edits; editIndex += 1) {
      const marker = editSession.createMarker(editIndex + 1);
      const outputCursor = state.output.length;
      const markerDone = waitForPageHmrMarker(page, marker, options.rebuildTimeoutMs, state, target.label);
      const editStartedAt = editSession.apply(marker);
      if (options.editDelayMs > 0) {
        await delay(options.editDelayMs);
      }
      const clientDateNow = await markerDone;
      let compileDurationMs = parseLastDevCompileDurationMs(state.output.slice(outputCursor));
      if (compileDurationMs == null) {
        await delay(50);
        compileDurationMs = parseLastDevCompileDurationMs(state.output.slice(outputCursor));
      }
      const browserDurationMs = clientDateNow - editStartedAt;
      edits.push({
        index: editIndex + 1,
        compileDurationMs,
        browserDurationMs,
        durationMs: browserDurationMs
      });
      console.log(
        `  - ${phase} edit ${editIndex + 1}/${options.edits}: build ${formatNumber(compileDurationMs)}ms, run ${formatNumber(browserDurationMs)}ms`
      );
    }

    await closePage(page);
    page = null;
    editSession.restore();
    const rssMb = await measureDevRss(state, options);
    return {
      tool,
      persistentCache,
      mode: phase,
      port: serverPort,
      initialCompileMs,
      edits,
      peakRssMb: rssMb,
      rssMb,
      rssMode: "pidusage-after-cpu-idle",
      memoryMode: options.resolvedDevMemoryMode
    };
  } finally {
    await closePage(page);
    await closeBrowser(browser);
    await stopManagedProcess(state);
    if (tool === "utoo" && serverPort != null) {
      await waitForPortClosed(serverPort, 10000);
    }
    editSession.restore();
  }
}

function readyPatternForTool(tool) {
  if (tool === "next") {
    return NEXT_READY_PATTERN;
  }
  if (tool === "utoo") {
    return UTOO_READY_PATTERN;
  }
  return BUNDLER_DONE_PATTERN;
}

async function openDevPage(page, url, tool, benchCase, timeoutMs) {
  const response = await page.goto(url, {
    timeout: timeoutMs,
    waitUntil: "domcontentloaded"
  });
  if (response != null && !response.ok()) {
    throw new Error(`dev page request failed: ${response.status()} ${response.statusText()} ${url}`);
  }

  await page.waitForSelector("body", { timeout: timeoutMs });
  if (shouldWaitForRenderedRoot(tool, benchCase)) {
    await page.waitForSelector("#root > *, #react-root > *", { timeout: timeoutMs });
  }
}

function shouldWaitForRenderedRoot(tool, benchCase) {
  if (tool === "next") {
    return false;
  }
  return benchCase.id.startsWith("react-") || benchCase.id === "all";
}

function waitForPageHmrMarker(page, marker, timeoutMs, processState, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timed out waiting for ${label} browser HMR marker ${marker}\n${lastLines(processState.output, 80)}`));
    }, timeoutMs);

    const onConsole = (event) => {
      const clientDateNow = parseHmrConsole(event.text(), marker);
      if (clientDateNow == null) {
        return;
      }
      cleanup();
      resolve(clientDateNow);
    };

    const onClose = () => {
      cleanup();
      reject(new Error(`page closed before browser HMR marker ${marker}`));
    };

    const cleanup = () => {
      clearTimeout(timer);
      page.off("console", onConsole);
      page.off("close", onClose);
    };

    page.on("console", onConsole);
    page.on("close", onClose);
  });
}

function attachVerbosePageLogging(page, options, label) {
  if (!options.verbose) {
    return;
  }

  page.on("console", (event) => {
    const text = event.text();
    if (event.type() === "log" && !/\[HMR\]|\[bench\]|bench hmr/i.test(text)) {
      return;
    }
    console.log(`[${label} browser] ${event.type()} ${text}`);
  });
  page.on("pageerror", (error) => {
    console.log(`[${label} browser] error ${error.stack || error.message}`);
  });
}

function waitForInitialPageHmrReady(page, tool, timeoutMs) {
  if (tool !== "utoo") {
    return null;
  }
  return waitForPageConsole(page, (text) => /\[HMR\]\s+connected/i.test(text), timeoutMs);
}

function createBrowserLaunchOptions() {
  if (process.env.GITHUB_ACTIONS !== "true" && process.env.CI !== "true" && process.env.CI !== "1") {
    return {};
  }

  return {
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  };
}

async function waitBeforeFirstEdit(pageHmrReady, tool, benchCase) {
  if (pageHmrReady != null) {
    await pageHmrReady;
  }

  const settleDelayMs = tool === "utoo" ? 10000 : 1000;
  await delay(settleDelayMs);
}

function waitForPageConsole(page, predicate, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const onConsole = (event) => {
      if (!predicate(event.text())) {
        return;
      }
      cleanup();
      resolve(true);
    };

    const onClose = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      clearTimeout(timer);
      page.off("console", onConsole);
      page.off("close", onClose);
    };

    page.on("console", onConsole);
    page.on("close", onClose);
  });
}

function parseHmrConsole(text, marker) {
  if (!text.includes("bench hmr") || !text.includes(marker)) {
    return null;
  }

  const markerTimestampMatch = text.match(new RegExp(`${escapeRegExp(marker)}\\s+(\\d{10,})`));
  if (markerTimestampMatch) {
    return Number(markerTimestampMatch[1]);
  }

  const timestamps = text.match(/\d{10,}/g);
  return timestamps == null ? null : Number(timestamps[timestamps.length - 1]);
}

function createEditSession(file) {
  const original = fs.readFileSync(file, "utf8");
  return {
    createMarker(index) {
      return `bench-dev-edit-${process.pid}-${Date.now()}-${index}`;
    },
    apply(marker) {
      const markerSource = renderEditMarker(file, marker);
      fs.writeFileSync(file, `${original}${markerSource}`);
      return Date.now();
    },
    restore() {
      fs.writeFileSync(file, original);
    }
  };
}

function renderEditMarker(file, marker) {
  if (/\.[cm]?[jt]sx?$/.test(file)) {
    return `\nconsole.log("bench hmr", "${marker}", Date.now());\n`;
  }
  return `\n/* ${marker} */\n`;
}

async function measureDevRss(state, options) {
  return measureProcessRssMbAtCpuIdle(state.child.pid, {
    memoryMode: options.resolvedDevMemoryMode
  });
}

async function closePage(page) {
  if (page == null || page.isClosed()) {
    return;
  }
  await page.close().catch(() => {});
}

async function closeBrowser(browser) {
  if (browser == null) {
    return;
  }
  await browser.close().catch(() => {});
}

function parseUtooPort(output) {
  const match = output.match(/http:\/\/localhost:(\d+)/i);
  if (!match) {
    throw new Error(`unable to parse Utoo dev server port`);
  }
  return Number(match[1]);
}

function createEnv(benchCase, persistentCache, port) {
  return {
    ...process.env,
    BENCH_CASE: benchCase.id,
    BENCH_DEV_PORT: String(port),
    BENCH_PERSISTENT_CACHE: persistentCache ? "1" : "0",
    CI: "1",
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1"
  };
}

function summarizeTool(tool, label, memoryCache, persistent) {
  const memoryCacheCompileMs = averageDefined(memoryCache.edits.map((edit) => edit.compileDurationMs));
  const persistentCompileMs = averageDefined(persistent.edits.map((edit) => edit.compileDurationMs));
  const memoryCacheEditMs = average(memoryCache.edits.map((edit) => edit.browserDurationMs ?? edit.durationMs));
  const persistentEditMs = average(persistent.edits.map((edit) => edit.browserDurationMs ?? edit.durationMs));
  const compileSavedMs =
    memoryCacheCompileMs != null && persistentCompileMs != null ? memoryCacheCompileMs - persistentCompileMs : null;
  const compileSavedPercent =
    compileSavedMs != null && memoryCacheCompileMs != null && memoryCacheCompileMs > 0
      ? (compileSavedMs / memoryCacheCompileMs) * 100
      : null;
  const editSavedMs = memoryCacheEditMs - persistentEditMs;
  const editSavedPercent = memoryCacheEditMs > 0 ? (editSavedMs / memoryCacheEditMs) * 100 : null;
  const initialSavedMs = memoryCache.initialCompileMs - persistent.initialCompileMs;
  const initialSavedPercent =
    memoryCache.initialCompileMs > 0 ? (initialSavedMs / memoryCache.initialCompileMs) * 100 : null;
  const rssDeltaMb =
    memoryCache.peakRssMb != null && persistent.peakRssMb != null
      ? persistent.peakRssMb - memoryCache.peakRssMb
      : null;

  return {
    tool,
    label,
    memoryCache: {
      ...memoryCache,
      averageCompileMs: memoryCacheCompileMs,
      p50CompileMs: percentileDefined(memoryCache.edits.map((edit) => edit.compileDurationMs), 0.5),
      p95CompileMs: percentileDefined(memoryCache.edits.map((edit) => edit.compileDurationMs), 0.95),
      averageEditMs: memoryCacheEditMs,
      p50EditMs: percentile(memoryCache.edits.map((edit) => edit.browserDurationMs ?? edit.durationMs), 0.5),
      p95EditMs: percentile(memoryCache.edits.map((edit) => edit.browserDurationMs ?? edit.durationMs), 0.95)
    },
    persistent: {
      ...persistent,
      averageCompileMs: persistentCompileMs,
      p50CompileMs: percentileDefined(persistent.edits.map((edit) => edit.compileDurationMs), 0.5),
      p95CompileMs: percentileDefined(persistent.edits.map((edit) => edit.compileDurationMs), 0.95),
      averageEditMs: persistentEditMs,
      p50EditMs: percentile(persistent.edits.map((edit) => edit.browserDurationMs ?? edit.durationMs), 0.5),
      p95EditMs: percentile(persistent.edits.map((edit) => edit.browserDurationMs ?? edit.durationMs), 0.95)
    },
    comparison: {
      initialSavedMs,
      initialSavedPercent,
      compileSavedMs,
      compileSavedPercent,
      editSavedMs,
      editSavedPercent,
      rssDeltaMb
    }
  };
}

function percentileDefined(values, quantile) {
  const defined = values.filter((value) => value != null);
  return defined.length > 0 ? percentile(defined, quantile) : null;
}

function parseLastDevCompileDurationMs(output) {
  let latest = null;
  for (const pattern of DEV_COMPILE_DURATION_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of output.matchAll(pattern)) {
      const value = Number(match[1]);
      if (!Number.isFinite(value)) {
        continue;
      }
      const durationMs = match[2].toLowerCase() === "s" ? value * 1000 : value;
      if (latest == null || match.index > latest.index) {
        latest = { index: match.index, durationMs };
      }
    }
  }
  return latest?.durationMs ?? null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function waitForPortClosed(port, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (!(await isPortOpen(port))) {
      return;
    }
    await delay(100);
  }
  throw new Error(`timed out waiting for localhost:${port} to close`);
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(100, () => {
      socket.destroy();
      resolve(false);
    });
  });
}
