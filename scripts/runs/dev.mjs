import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { resolveEditTarget, writeNextCaseFiles } from "../cases.mjs";
import { average, formatNumber, percentile } from "../lib/format.mjs";
import {
  delay,
  fetchResource,
  getFreePort,
  startManagedProcess,
  startRssSampler,
  stopManagedProcess,
  waitForOutput
} from "../lib/process.mjs";
import { root } from "../lib/paths.mjs";
import { cleanTarget, DEV_TARGETS } from "../lib/tools.mjs";

const BUNDLER_DONE_PATTERN = /compiled (successfully|with)|compiled in|webpack compiled|rspack compiled/i;
const NEXT_READY_PATTERN = /(ready in|started server)/i;
const UTOO_READY_PATTERN = /Local:\s+(?:\x1b\[[\d;]*m)*http:\/\/localhost:(\d+)/i;

export const devRun = {
  id: "dev",
  title: "dev",
  run: runDev
};

export async function runDev({ benchCase, options }) {
  const editTarget = await resolveEditTarget(benchCase);
  console.log(`edit target: ${path.relative(root, editTarget)}`);

  const results = [];
  for (const tool of options.tools) {
    if (tool === "next") {
      writeNextCaseFiles(benchCase, { importMode: "static" });
    }
    results.push(await benchTool(tool, options, benchCase, editTarget));
  }

  return {
    editTarget: path.relative(root, editTarget),
    results
  };
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
  if (tool === "next") {
    return runNextDevSession(target, persistentCache, options, benchCase, editTarget);
  }
  if (tool === "utoo") {
    return runUtooDevSession(target, persistentCache, options, benchCase, editTarget);
  }
  return runWatchSession(tool, target, persistentCache, options, benchCase, editTarget);
}

async function runWatchSession(tool, target, persistentCache, options, benchCase, editTarget) {
  const [command, args] = target.command({ benchCase });
  const phase = persistentCache ? "persistent-cache" : "memory-cache";
  const editSession = createEditSession(editTarget);
  const startedAt = performance.now();
  const state = startManagedProcess(command, args, {
    cwd: target.cwd?.(benchCase),
    env: createEnv(benchCase, persistentCache),
    verbose: options.verbose
  });
  const sampler = startRssSampler(state.child.pid, {
    memoryMode: options.resolvedDevMemoryMode,
    sampleIntervalMs: options.sampleIntervalMs
  });

  try {
    await waitForOutput(state, BUNDLER_DONE_PATTERN, options.readyTimeoutMs, `${target.label} initial compile`);
    const initialCompileMs = performance.now() - startedAt;
    const edits = [];

    for (let editIndex = 0; editIndex < options.edits; editIndex += 1) {
      const outputStart = state.output.length;
      const rebuildDone = waitForOutput(
        state,
        BUNDLER_DONE_PATTERN,
        options.rebuildTimeoutMs,
        `${target.label} rebuild ${editIndex + 1}`,
        outputStart
      );
      const editStartedAt = performance.now();
      editSession.apply(editIndex + 1);
      if (options.editDelayMs > 0) {
        await delay(options.editDelayMs);
      }
      await rebuildDone;
      const durationMs = performance.now() - editStartedAt;
      edits.push({ index: editIndex + 1, durationMs });
      console.log(`  - ${phase} edit ${editIndex + 1}/${options.edits}: ${formatNumber(durationMs)}ms`);
    }

    return {
      tool,
      persistentCache,
      mode: phase,
      initialCompileMs,
      edits,
      peakRssMb: await sampler.stop(),
      memoryMode: options.resolvedDevMemoryMode
    };
  } finally {
    await stopManagedProcess(state);
    editSession.restore();
    await sampler.stop();
  }
}

async function runNextDevSession(target, persistentCache, options, benchCase, editTarget) {
  const port = await getFreePort();
  const [command, args] = target.command({ benchCase, port });
  const phase = persistentCache ? "persistent-cache" : "memory-cache";
  const editSession = createEditSession(editTarget);
  const startedAt = performance.now();
  const state = startManagedProcess(command, args, {
    cwd: target.cwd?.(benchCase),
    env: createEnv(benchCase, persistentCache),
    verbose: options.verbose
  });
  const sampler = startRssSampler(state.child.pid, {
    memoryMode: options.resolvedDevMemoryMode,
    sampleIntervalMs: options.sampleIntervalMs
  });
  const url = `http://127.0.0.1:${port}/`;

  try {
    await waitForOutput(state, NEXT_READY_PATTERN, options.readyTimeoutMs, `${target.label} ready`);
    const initialPage = await fetchNextClientAssets(url, options.requestTimeoutMs);
    const initialCompileMs = performance.now() - startedAt;
    const edits = [];

    for (let editIndex = 0; editIndex < options.edits; editIndex += 1) {
      const editStartedAt = performance.now();
      editSession.apply(editIndex + 1);
      if (options.editDelayMs > 0) {
        await delay(options.editDelayMs);
      }
      await fetchNextClientAssets(url, options.requestTimeoutMs, `${Date.now()}_${editIndex}`);
      const durationMs = performance.now() - editStartedAt;
      edits.push({ index: editIndex + 1, durationMs });
      console.log(`  - ${phase} edit ${editIndex + 1}/${options.edits}: ${formatNumber(durationMs)}ms`);
    }

    return {
      tool: "next",
      persistentCache,
      mode: phase,
      port,
      nextAssetCount: initialPage.assets.length,
      initialCompileMs,
      edits,
      peakRssMb: await sampler.stop(),
      memoryMode: options.resolvedDevMemoryMode
    };
  } finally {
    await stopManagedProcess(state);
    editSession.restore();
    await sampler.stop();
  }
}

async function runUtooDevSession(target, persistentCache, options, benchCase, editTarget) {
  const [command, args] = target.command({ benchCase });
  const phase = persistentCache ? "persistent-cache" : "memory-cache";
  const editSession = createEditSession(editTarget);
  const startedAt = performance.now();
  const state = startManagedProcess(command, args, {
    cwd: target.cwd?.(benchCase),
    env: createEnv(benchCase, persistentCache),
    verbose: options.verbose
  });
  const sampler = startRssSampler(state.child.pid, {
    memoryMode: options.resolvedDevMemoryMode,
    sampleIntervalMs: options.sampleIntervalMs
  });

  try {
    const readyOutput = await waitForOutput(state, UTOO_READY_PATTERN, options.readyTimeoutMs, `${target.label} ready`);
    const port = parseUtooPort(readyOutput);
    const url = `http://127.0.0.1:${port}/`;
    const initialPage = await fetchUtooClientAssets(url, options.requestTimeoutMs);
    const initialCompileMs = performance.now() - startedAt;
    const edits = [];

    for (let editIndex = 0; editIndex < options.edits; editIndex += 1) {
      const outputStart = state.output.length;
      const rebuildDone = waitForOutput(
        state,
        BUNDLER_DONE_PATTERN,
        options.rebuildTimeoutMs,
        `${target.label} rebuild ${editIndex + 1}`,
        outputStart
      );
      const editStartedAt = performance.now();
      editSession.apply(editIndex + 1);
      if (options.editDelayMs > 0) {
        await delay(options.editDelayMs);
      }
      await rebuildDone;
      const durationMs = performance.now() - editStartedAt;
      edits.push({ index: editIndex + 1, durationMs });
      console.log(`  - ${phase} edit ${editIndex + 1}/${options.edits}: ${formatNumber(durationMs)}ms`);
    }

    return {
      tool: "utoo",
      persistentCache,
      mode: phase,
      port,
      utooAssetCount: initialPage.assets.length,
      initialCompileMs,
      edits,
      peakRssMb: await sampler.stop(),
      memoryMode: options.resolvedDevMemoryMode
    };
  } finally {
    await stopManagedProcess(state);
    editSession.restore();
    await sampler.stop();
  }
}

async function fetchNextClientAssets(url, timeoutMs, cacheKey = "") {
  const pageChunkUrl = new URL("/_next/static/chunks/pages/index.js", url);
  if (cacheKey) {
    pageChunkUrl.searchParams.set("bench_edit", cacheKey);
  }

  const pageChunkSource = await fetchResource(pageChunkUrl.href, timeoutMs, "*/*");
  const assetPaths = new Set(parseNextPageChunkAssets(pageChunkSource));
  const assets = [...assetPaths]
    .filter((assetPath) => /\.(js|css)(?:[?#]|$)/.test(assetPath))
    .map((assetPath) => {
      const assetUrl = new URL(assetPath.startsWith("/") ? assetPath : `/_next/${assetPath}`, url);
      if (cacheKey) {
        assetUrl.searchParams.set("bench_edit", cacheKey);
      }
      return assetUrl.href;
    });

  if (assets.length === 0) {
    throw new Error(`Next.js dev page chunk did not contain client assets for /`);
  }

  for (const assetUrl of assets) {
    await fetchResource(assetUrl, timeoutMs, "*/*");
  }
  return { assets };
}

function parseNextPageChunkAssets(source) {
  const match = source.match(/__turbopack_load_page_chunks__\("\/",\s*(\[[\s\S]*?\])\s*\)/);
  if (!match) {
    throw new Error(`unable to parse Next.js dev page chunk asset list`);
  }
  return JSON.parse(match[1]);
}

async function fetchUtooClientAssets(url, timeoutMs, cacheKey = "") {
  const pageUrl = new URL("/", url);
  if (cacheKey) {
    pageUrl.searchParams.set("bench_edit", cacheKey);
  }

  const html = await fetchResource(pageUrl.href, timeoutMs, "text/html,*/*");
  const assets = parseHtmlAssetUrls(html).map((assetPath) => {
    const assetUrl = new URL(assetPath, url);
    if (cacheKey) {
      assetUrl.searchParams.set("bench_edit", cacheKey);
    }
    return assetUrl.href;
  });

  if (assets.length === 0) {
    throw new Error(`Utoo dev page did not contain JS/CSS assets for /`);
  }

  for (const assetUrl of assets) {
    await fetchResource(assetUrl, timeoutMs, "*/*");
  }
  return { assets };
}

function parseHtmlAssetUrls(html) {
  const assets = new Set();
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
    const assetPath = match[1];
    if (/\.(?:js|css)(?:[?#]|$)/.test(assetPath)) {
      assets.add(assetPath);
    }
  }
  return [...assets];
}

function parseUtooPort(output) {
  const match = output.match(/http:\/\/localhost:(\d+)/i);
  if (!match) {
    throw new Error(`unable to parse Utoo dev server port`);
  }
  return Number(match[1]);
}

function createEditSession(file) {
  const original = fs.readFileSync(file, "utf8");
  return {
    apply(index) {
      const marker = `\n/* bench-dev-edit ${process.pid} ${Date.now()} ${index} */\n`;
      fs.writeFileSync(file, `${original}${marker}`);
    },
    restore() {
      fs.writeFileSync(file, original);
    }
  };
}

function createEnv(benchCase, persistentCache) {
  return {
    ...process.env,
    BENCH_CASE: benchCase.id,
    BENCH_PERSISTENT_CACHE: persistentCache ? "1" : "0",
    CI: "1",
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1"
  };
}

function summarizeTool(tool, label, memoryCache, persistent) {
  const memoryCacheEditMs = average(memoryCache.edits.map((edit) => edit.durationMs));
  const persistentEditMs = average(persistent.edits.map((edit) => edit.durationMs));
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
      averageEditMs: memoryCacheEditMs,
      p50EditMs: percentile(memoryCache.edits.map((edit) => edit.durationMs), 0.5),
      p95EditMs: percentile(memoryCache.edits.map((edit) => edit.durationMs), 0.95)
    },
    persistent: {
      ...persistent,
      averageEditMs: persistentEditMs,
      p50EditMs: percentile(persistent.edits.map((edit) => edit.durationMs), 0.5),
      p95EditMs: percentile(persistent.edits.map((edit) => edit.durationMs), 0.95)
    },
    comparison: {
      initialSavedMs,
      initialSavedPercent,
      editSavedMs,
      editSavedPercent,
      rssDeltaMb
    }
  };
}
