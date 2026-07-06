import fs from "node:fs";
import path from "node:path";
import { cacheDirFor, nextDistDirFor, nextProjectDir, outputDirFor } from "../cases.mjs";
import { bin, root } from "./paths.mjs";

export const TOOL_IDS = ["rspack", "webpack", "next", "utoo"];

export const BUILD_TARGETS = {
  rspack: {
    label: "Rspack",
    binary: () => bin("rspack"),
    cwd: (benchCase) => benchCase.caseRootAbs,
    command: () => [bin("rspack"), ["build", "--config", "rspack.config.js"]],
    outputDirs: (benchCase) => [path.relative(root, outputDirFor("rspack", benchCase))],
    cacheDirs: (benchCase) => [path.relative(root, cacheDirFor("rspack", benchCase))]
  },
  webpack: {
    label: "webpack",
    binary: () => bin("webpack"),
    cwd: (benchCase) => benchCase.caseRootAbs,
    command: () => [bin("webpack"), ["--config", "webpack.config.js"]],
    outputDirs: (benchCase) => [path.relative(root, outputDirFor("webpack", benchCase))],
    cacheDirs: (benchCase) => [path.relative(root, cacheDirFor("webpack", benchCase))]
  },
  utoo: {
    label: "Utoo",
    binary: () => bin("up"),
    cwd: (benchCase) => benchCase.caseRootAbs,
    command: () => [bin("up"), ["build"]],
    outputDirs: (benchCase) => [path.relative(root, outputDirFor("utoo", benchCase))],
    cacheDirs: (benchCase) =>
      benchCase.id === "all"
        ? [
            path.relative(root, path.join(benchCase.caseRootAbs, ".turbopack")),
            path.relative(root, cacheDirFor("utoo", benchCase))
          ]
        : [path.relative(root, path.join(benchCase.caseRootAbs, ".turbopack"))]
  },
  next: {
    label: "Next.js Turbopack",
    binary: () => bin("next"),
    cwd: (benchCase) => path.join(root, nextProjectDir(benchCase)),
    command: () => [bin("next"), ["build", ".", "--turbopack", "--experimental-build-mode=compile"]],
    outputDirs: (benchCase) => [
      nextDistDirFor(false, benchCase),
      nextDistDirFor(true, benchCase)
    ],
    cacheDirs: (benchCase) => [path.join(nextDistDirFor(true, benchCase), "cache")],
    keepPersistentOutputBetweenRuns: true
  }
};

export const DEV_TARGETS = {
  rspack: {
    label: "Rspack watch",
    binary: BUILD_TARGETS.rspack.binary,
    cwd: BUILD_TARGETS.rspack.cwd,
    command: () => [bin("rspack"), ["build", "--watch", "--config", "rspack.config.js"]],
    outputDirs: BUILD_TARGETS.rspack.outputDirs,
    cacheDirs: BUILD_TARGETS.rspack.cacheDirs
  },
  webpack: {
    label: "webpack watch",
    binary: BUILD_TARGETS.webpack.binary,
    cwd: BUILD_TARGETS.webpack.cwd,
    command: () => [bin("webpack"), ["--watch", "--config", "webpack.config.js"]],
    outputDirs: BUILD_TARGETS.webpack.outputDirs,
    cacheDirs: BUILD_TARGETS.webpack.cacheDirs
  },
  utoo: {
    label: "Utoo dev",
    binary: BUILD_TARGETS.utoo.binary,
    cwd: BUILD_TARGETS.utoo.cwd,
    command: () => [bin("up"), ["dev"]],
    outputDirs: BUILD_TARGETS.utoo.outputDirs,
    cacheDirs: BUILD_TARGETS.utoo.cacheDirs
  },
  next: {
    label: "Next.js Turbopack dev",
    binary: BUILD_TARGETS.next.binary,
    cwd: BUILD_TARGETS.next.cwd,
    command: ({ port }) => [bin("next"), ["dev", ".", "--turbopack", "--port", String(port)]],
    outputDirs: BUILD_TARGETS.next.outputDirs,
    cacheDirs: BUILD_TARGETS.next.cacheDirs
  }
};

export function cleanTarget(target, benchCase, { persistent, removeCache }) {
  for (const relativeDir of target.outputDirs(benchCase)) {
    if (persistent && !removeCache && target.keepPersistentOutputBetweenRuns) {
      continue;
    }
    const shouldRemove = persistent ? !relativeDir.includes("memory-cache") : !relativeDir.includes("persistent");
    if (shouldRemove) {
      fs.rmSync(path.join(root, relativeDir), { recursive: true, force: true });
    }
  }

  if (removeCache) {
    for (const relativeDir of target.cacheDirs(benchCase)) {
      fs.rmSync(path.join(root, relativeDir), { recursive: true, force: true });
    }
  }
}

export function ensureToolBins(tools, targets) {
  const missing = [];
  for (const tool of tools) {
    const command = targets[tool].binary();
    if (!fs.existsSync(command)) {
      missing.push(path.relative(root, command));
    }
  }

  if (missing.length > 0) {
    throw new Error(`missing dependencies: ${missing.join(", ")}\nRun npm install first.`);
  }
}
