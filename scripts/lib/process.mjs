import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import pidusage from "pidusage";
import { lastLines } from "./format.mjs";
import { root } from "./paths.mjs";

const execFileAsync = promisify(execFile);

export async function runMeasuredCommand(command, args, { cwd = root, env, verbose, memoryMode, sampleIntervalMs }) {
  const wrapped = wrapCommandForMemory(command, args, memoryMode);
  const startedAt = performance.now();
  const child = spawn(wrapped.command, wrapped.args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    stdout += text;
    if (verbose) {
      process.stdout.write(text);
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderr += text;
    if (verbose) {
      process.stderr.write(text);
    }
  });

  const sampler = startRssSampler(child.pid, { memoryMode: wrapped.memoryMode, sampleIntervalMs });
  const exit = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal }));
  });
  let peakRssMb = await sampler.stop();

  if (wrapped.memoryMode.startsWith("time-")) {
    const timeRssMb = parseTimePeakRssMb(stderr, wrapped.memoryMode);
    if (timeRssMb != null) {
      peakRssMb = Math.max(peakRssMb ?? 0, timeRssMb);
    }
  }

  return {
    exit,
    stdout,
    stderr,
    durationMs: performance.now() - startedAt,
    peakRssMb: peakRssMb || null,
    memoryMode: wrapped.memoryMode
  };
}

export async function resolveBuildMemoryMode(memoryMode) {
  if (memoryMode === "off" || memoryMode === "ps") {
    return memoryMode;
  }

  const timeMode = await detectUsrTimeMode();
  if (memoryMode === "time") {
    if (timeMode == null) {
      throw new Error("requested --memory-mode=time, but /usr/bin/time RSS output is not available");
    }
    return timeMode;
  }

  return timeMode ?? "ps";
}

export function resolveDevMemoryMode(memoryMode) {
  if (memoryMode === "off" || memoryMode === "pidusage") {
    return memoryMode;
  }
  if (memoryMode === "ps") {
    return "pidusage";
  }
  if (memoryMode === "auto") {
    return "pidusage";
  }
  throw new Error("--dev-memory-mode must be one of: auto, pidusage, ps, off");
}

export async function detectUsrTimeMode() {
  if (!fs.existsSync("/usr/bin/time")) {
    return null;
  }

  const mode = process.platform === "darwin" ? "time-darwin" : process.platform === "linux" ? "time-linux" : null;
  if (mode == null) {
    return null;
  }

  const args =
    mode === "time-darwin"
      ? ["-l", process.execPath, "-e", ""]
      : ["-v", process.execPath, "-e", ""];

  try {
    const { stderr } = await execFileAsync("/usr/bin/time", args, {
      cwd: root,
      maxBuffer: 1024 * 1024
    });
    return parseTimePeakRssMb(stderr, mode) != null ? mode : null;
  } catch {
    return null;
  }
}

export function wrapCommandForMemory(command, args, memoryMode) {
  if (memoryMode === "time-darwin") {
    return {
      command: "/usr/bin/time",
      args: ["-l", command, ...args],
      memoryMode
    };
  }

  if (memoryMode === "time-linux") {
    return {
      command: "/usr/bin/time",
      args: ["-v", command, ...args],
      memoryMode
    };
  }

  return { command, args, memoryMode };
}

export function parseTimePeakRssMb(stderr, memoryMode) {
  if (memoryMode === "time-darwin") {
    const match = stderr.match(/^\s*(\d+)\s+maximum resident set size/m);
    return match ? Number(match[1]) / 1024 / 1024 : null;
  }

  if (memoryMode === "time-linux") {
    const match = stderr.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
    return match ? Number(match[1]) / 1024 : null;
  }

  return null;
}

export function startManagedProcess(command, args, { cwd = root, env, verbose }) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32"
  });

  const state = {
    child,
    output: "",
    waiters: new Set(),
    closed: false,
    exit: null,
    exitPromise: null
  };

  const appendOutput = (chunk, stream) => {
    const text = chunk.toString();
    state.output += text;
    if (verbose) {
      stream.write(text);
    }
    checkWaiters(state);
  };

  child.stdout.on("data", (chunk) => appendOutput(chunk, process.stdout));
  child.stderr.on("data", (chunk) => appendOutput(chunk, process.stderr));
  child.on("error", (error) => {
    state.closed = true;
    state.exit = { error };
    rejectWaiters(state, error);
  });
  state.exitPromise = new Promise((resolve) => {
    child.on("close", (code, signal) => {
      state.closed = true;
      state.exit = { code, signal };
      const exitError = new Error(`process exited with ${code ?? signal}\n${lastLines(state.output, 80)}`);
      rejectWaiters(state, exitError);
      resolve(state.exit);
    });
  });

  return state;
}

export function waitForOutput(state, pattern, timeoutMs, description, fromIndex = 0) {
  return new Promise((resolve, reject) => {
    const waiter = {
      pattern,
      fromIndex,
      description,
      resolve,
      reject,
      timer: null
    };

    waiter.timer = setTimeout(() => {
      state.waiters.delete(waiter);
      reject(new Error(`timed out waiting for ${description}\n${lastLines(state.output, 80)}`));
    }, timeoutMs);

    state.waiters.add(waiter);
    checkWaiter(state, waiter);
  });
}

export async function stopManagedProcess(state) {
  if (state.closed) {
    return state.exit;
  }

  killChild(state.child, "SIGTERM");
  const exit = await Promise.race([
    state.exitPromise,
    delay(5000).then(() => null)
  ]);
  if (exit != null) {
    return exit;
  }

  killChild(state.child, "SIGKILL");
  return Promise.race([
    state.exitPromise,
    delay(5000).then(() => null)
  ]);
}

export function startRssSampler(pid, { memoryMode, sampleIntervalMs }) {
  let peakRssMb = 0;
  let running = false;
  let stopped = memoryMode !== "ps" || pid == null;
  let timer = null;

  const sample = async () => {
    if (stopped || running || pid == null) {
      return;
    }
    running = true;
    try {
      const rss = await getProcessTreeRssMb(pid);
      if (rss != null) {
        peakRssMb = Math.max(peakRssMb, rss);
      }
    } finally {
      running = false;
    }
  };

  if (!stopped) {
    void sample();
    timer = setInterval(sample, sampleIntervalMs);
  }

  return {
    async stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (!stopped) {
        await sample();
      }
      stopped = true;
      return peakRssMb || null;
    }
  };
}

export async function measureProcessTreeRssMbAtIdle(
  rootPid,
  { memoryMode, timeoutMs = 30000, idleIntervalMs = 200, cpuThreshold = 0 }
) {
  if (memoryMode !== "ps" || rootPid == null || process.platform === "win32") {
    return null;
  }

  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const stats = await getProcessTreeStats(rootPid);
    if (stats == null || stats.cpu <= cpuThreshold) {
      break;
    }
    await delay(idleIntervalMs);
  }

  const stats = await getProcessTreeStats(rootPid);
  return stats == null ? null : roundMb(stats.rssMb);
}

export async function measureProcessRssMbAtCpuIdle(
  pid,
  { memoryMode, timeoutMs = 30000, idleIntervalMs = 200, cpuThreshold = 0 }
) {
  if (memoryMode !== "pidusage" || pid == null) {
    return null;
  }

  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const info = await safePidusage(pid);
    if (info == null || info.cpu <= cpuThreshold) {
      break;
    }
    await delay(idleIntervalMs);
  }

  const info = await safePidusage(pid);
  return info == null ? null : roundMb(info.memory / 1024 / 1024);
}

async function safePidusage(pid) {
  try {
    return await pidusage(pid);
  } catch {
    return null;
  }
}

export async function getProcessTreeRssMb(rootPid) {
  const stats = await getProcessTreeStats(rootPid);
  return stats?.rssMb ?? null;
}

export async function getProcessTreeStats(rootPid) {
  if (process.platform === "win32") {
    return null;
  }

  try {
    const { stdout } = await execFileAsync("ps", ["-axo", "pid=,ppid=,rss=,%cpu="], {
      maxBuffer: 10 * 1024 * 1024
    });
    const rows = stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [pidText, ppidText, rssText, cpuText] = line.trim().split(/\s+/);
        return {
          pid: Number(pidText),
          ppid: Number(ppidText),
          rssKb: Number(rssText),
          cpu: Number(cpuText)
        };
      })
      .filter(
        (row) =>
          Number.isFinite(row.pid) &&
          Number.isFinite(row.ppid) &&
          Number.isFinite(row.rssKb) &&
          Number.isFinite(row.cpu)
      );

    const rowsByPid = new Map();
    const childrenByParent = new Map();
    for (const row of rows) {
      rowsByPid.set(row.pid, row);
      const children = childrenByParent.get(row.ppid) ?? [];
      children.push(row);
      childrenByParent.set(row.ppid, children);
    }

    const queue = [rootPid];
    const seen = new Set();
    let totalKb = 0;
    let totalCpu = 0;

    while (queue.length > 0) {
      const pid = queue.shift();
      if (seen.has(pid)) {
        continue;
      }
      seen.add(pid);
      const row = rowsByPid.get(pid);
      if (row) {
        totalKb += row.rssKb;
        totalCpu += row.cpu;
      }
      for (const child of childrenByParent.get(pid) ?? []) {
        queue.push(child.pid);
      }
    }

    return {
      rssMb: totalKb / 1024,
      cpu: totalCpu
    };
  } catch {
    return null;
  }
}

function roundMb(value) {
  return Math.round(value * 1000) / 1000;
}

export async function fetchResource(url, timeoutMs, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept
      }
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`request failed: ${response.status} ${response.statusText}\n${lastLines(body, 40)}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address != null ? address.port : null;
      server.close(() => {
        if (port == null) {
          reject(new Error("failed to allocate a local port"));
        } else {
          resolve(port);
        }
      });
    });
  });
}

export function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function checkWaiters(state) {
  for (const waiter of [...state.waiters]) {
    checkWaiter(state, waiter);
  }
}

function checkWaiter(state, waiter) {
  const text = state.output.slice(waiter.fromIndex);
  if (!waiter.pattern.test(text)) {
    return;
  }
  clearTimeout(waiter.timer);
  state.waiters.delete(waiter);
  waiter.resolve(text);
}

function rejectWaiters(state, error) {
  for (const waiter of [...state.waiters]) {
    clearTimeout(waiter.timer);
    state.waiters.delete(waiter);
    waiter.reject(error);
  }
}

function killChild(child, signal) {
  if (child.pid == null) {
    return;
  }

  try {
    if (process.platform === "win32") {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Already stopped.
    }
  }
}
