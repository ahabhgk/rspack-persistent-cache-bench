import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { root, toPosix } from "./lib/paths.mjs";

export const DEFAULT_CASE_ID = "react-1k";

export const CASES = {
  "react-1k": {
    id: "react-1k",
    entry: "bench-cases/react-1k/src/index.jsx",
    editTarget: "bench-cases/react-1k/src/d0/d0/d0/f0.jsx"
  },
  "react-5k": {
    id: "react-5k",
    entry: "bench-cases/react-5k/src/index.jsx",
    editTarget: "bench-cases/react-5k/src/d0/d0/d0/f0.jsx"
  },
  "react-10k": {
    id: "react-10k",
    entry: "bench-cases/react-10k/src/index.jsx",
    editTarget: "bench-cases/react-10k/src/d0/d0/d0/f0.jsx"
  },
  "popular-libs": {
    id: "popular-libs",
    entry: "bench-cases/popular-libs/src/index.js"
  },
  "ui-components": {
    id: "ui-components",
    entry: "bench-cases/ui-components/src/entry.js",
    editTarget: "bench-cases/ui-components/src/hmr-marker.js"
  },
  "tailwind-hmr": {
    id: "tailwind-hmr",
    entry: "bench-cases/tailwind-hmr/src/main.js",
    nextEntry: "bench-cases/tailwind-hmr/src/next-main.js",
    nextCssImports: ["bench-cases/tailwind-hmr/src/style.css"],
    editTarget: "bench-cases/tailwind-hmr/src/component.tsx",
    editTargets: {
      utoo: "bench-cases/tailwind-hmr/src/main.js"
    },
    prepareScript: "scripts/prepare.mjs",
    generatedDirs: [
      "bench-cases/tailwind-hmr/src/.generated",
      "bench-cases/tailwind-hmr/public/.generated"
    ]
  },
  all: {
    id: "all",
    entry: "bench-cases/all/src/entry.js",
    editTarget: "bench-cases/all/src/entry.js"
  }
};

export function listCaseIds() {
  return Object.keys(CASES);
}

export function selectCases(caseIds) {
  return caseIds.map((id) => {
    const benchCase = getBenchCase(id);
    ensureCaseExists(benchCase);
    return benchCase;
  });
}

export function getBenchCase(id = process.env.BENCH_CASE || DEFAULT_CASE_ID) {
  const benchCase = CASES[id];
  if (!benchCase) {
    throw new Error(`unknown bench case "${id}". Expected one of: ${listCaseIds().join(", ")}`);
  }

  return {
    ...benchCase,
    safeId: safeCaseId(benchCase.id),
    entryAbs: path.join(root, benchCase.entry),
    nextEntryAbs: benchCase.nextEntry ? path.join(root, benchCase.nextEntry) : null,
    srcDirAbs: path.join(root, path.dirname(benchCase.entry)),
    caseRootAbs: path.join(root, path.dirname(path.dirname(benchCase.entry)))
  };
}

export function getBenchCaseByRoot(caseRoot) {
  const normalizedRoot = path.resolve(caseRoot);
  for (const id of listCaseIds()) {
    const benchCase = getBenchCase(id);
    if (benchCase.caseRootAbs === normalizedRoot) {
      return benchCase;
    }
  }

  throw new Error(`unknown bench case root: ${caseRoot}`);
}

export function safeCaseId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function outputDirFor(tool, benchCase = getBenchCase()) {
  return path.join(benchCase.caseRootAbs, ".bench-out", tool);
}

export function cacheDirFor(tool, benchCase = getBenchCase()) {
  return path.join(benchCase.caseRootAbs, ".bench-cache", tool);
}

export function nextDistDirFor(persistent, benchCase = getBenchCase()) {
  return path.relative(root, path.join(nextProjectDirAbs(benchCase.caseRootAbs), ".next", persistent ? "persistent" : "memory-cache"));
}

export function nextProjectDir(benchCase = getBenchCase()) {
  return path.relative(root, nextProjectDirAbs(benchCase.caseRootAbs));
}

export function configPathFor(tool, benchCase = getBenchCase()) {
  const configFile =
    tool === "next" ? "next.config.mjs" : tool === "utoo" ? "utoopack.config.mjs" : `${tool}.config.js`;
  return path.join(benchCase.caseRootAbs, configFile);
}

export function ensureCaseExists(benchCase) {
  if (!fs.existsSync(benchCase.entryAbs)) {
    throw new Error(`bench case entry does not exist: ${benchCase.entry}`);
  }
  if (benchCase.nextEntryAbs && !fs.existsSync(benchCase.nextEntryAbs)) {
    throw new Error(`bench case next entry does not exist: ${benchCase.nextEntry}`);
  }
  for (const tool of ["rspack", "webpack", "next", "utoo"]) {
    const configPath = configPathFor(tool, benchCase);
    if (!fs.existsSync(configPath)) {
      throw new Error(`bench case ${tool} config does not exist: ${path.relative(root, configPath)}`);
    }
  }
}

export function serializeCase(benchCase) {
  return {
    id: benchCase.id,
    safeId: benchCase.safeId,
    entry: benchCase.entry
  };
}

export async function prepareCase(benchCase, { verbose = false } = {}) {
  if (!benchCase.prepareScript) {
    return;
  }

  const scriptPath = path.join(benchCase.caseRootAbs, benchCase.prepareScript);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`bench case prepare script does not exist: ${path.relative(root, scriptPath)}`);
  }

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: benchCase.caseRootAbs,
      env: process.env,
      stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"]
    });
    let output = "";
    if (!verbose) {
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString();
      });
    }
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`prepare ${benchCase.id} failed with ${code ?? signal}\n${output}`));
      }
    });
  });
}

export async function resolveEditTarget(benchCase, tool = null) {
  const editTargetPath = (tool == null ? null : benchCase.editTargets?.[tool]) ?? benchCase.editTarget;
  if (editTargetPath) {
    const editTarget = path.join(root, editTargetPath);
    if (fs.existsSync(editTarget)) {
      return editTarget;
    }
  }

  return benchCase.entryAbs;
}

export function writeNextCaseFiles(benchCase, { importMode = "dynamic" } = {}) {
  ensureCaseExists(benchCase);

  const nextProjectRoot = nextProjectDirAbs(benchCase.caseRootAbs);
  const nextPagesDir = path.join(nextProjectRoot, "pages");

  fs.rmSync(path.join(nextProjectRoot, "app"), { recursive: true, force: true });
  fs.rmSync(nextPagesDir, { recursive: true, force: true });
  fs.rmSync(path.join(nextProjectRoot, "components"), { recursive: true, force: true });
  fs.mkdirSync(nextPagesDir, { recursive: true });
  fs.writeFileSync(path.join(nextProjectRoot, "next.config.mjs"), renderNextConfigProxy());
  if (fs.existsSync(path.join(benchCase.caseRootAbs, "postcss.config.mjs"))) {
    fs.writeFileSync(path.join(nextProjectRoot, "postcss.config.mjs"), renderNextPostcssConfigProxy());
  } else {
    fs.rmSync(path.join(nextProjectRoot, "postcss.config.mjs"), { force: true });
  }
  fs.writeFileSync(path.join(nextProjectRoot, "package.json"), renderNextPackageJson());
  fs.writeFileSync(path.join(nextProjectRoot, "instrumentation-client.js"), renderNextInstrumentationClient(benchCase, importMode));
  fs.writeFileSync(path.join(nextPagesDir, "_app.jsx"), renderNextPagesApp(benchCase));
  fs.writeFileSync(path.join(nextPagesDir, "index.jsx"), renderNextPagesIndex());
}

function nextProjectDirAbs(caseRoot) {
  return path.join(caseRoot, ".bench-next", "project");
}

function renderNextConfigProxy() {
  return `export { default } from "../../next.config.mjs";
`;
}

function renderNextPostcssConfigProxy() {
  return `export { default } from "../../postcss.config.mjs";
`;
}

function renderNextPackageJson() {
  return `{
  "private": true,
  "type": "module"
}
`;
}

function renderNextPagesApp(benchCase) {
  const cssImports = (benchCase.nextCssImports ?? [])
    .map((importPath) =>
      `import "${toNextProjectRelativeImport(path.join(root, importPath), path.join(nextProjectDirAbs(benchCase.caseRootAbs), "pages"))}";`
    )
    .join("\n");

  return `${cssImports ? `${cssImports}\n\n` : ""}export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
`;
}

function renderNextPagesIndex() {
  return `export default function Page() {
  return (
    <main id="root" />
  );
}
`;
}

function renderNextInstrumentationClient(benchCase, importMode) {
  const importPaths = getNextImportPaths(benchCase, nextProjectDirAbs(benchCase.caseRootAbs));

  if (importMode === "static") {
    const staticImports = importPaths
      .map((importPath, index) => `import * as BenchCaseModule${index} from "${importPath}";`)
      .join("\n");
    const moduleNames = importPaths.map((_, index) => `BenchCaseModule${index}`).join(", ");

    return `${staticImports}

const loadedModules = [${moduleNames}];

self.__BENCH_LOADED_MODULES__ = loadedModules;
`;
  }

  const imports = importPaths
    .map((importPath) => `      import("${importPath}")`)
    .join(",\n");

  return `Promise.all([
${imports}
]).then((loadedModules) => {
  self.__BENCH_LOADED_MODULES__ = loadedModules;
});
`;
}

function getNextImportPaths(benchCase, fromDir) {
  if (benchCase.nextEntryAbs) {
    return [toNextProjectRelativeImport(benchCase.nextEntryAbs, fromDir)];
  }

  if (benchCase.id.startsWith("react-")) {
    const srcDir = path.dirname(benchCase.entryAbs);
    return fs
      .readdirSync(srcDir)
      .filter((file) => /^f\d+\.jsx$/.test(file))
      .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0))
      .map((file) => toNextProjectRelativeImport(path.join(srcDir, file), fromDir));
  }

  return [toNextProjectRelativeImport(benchCase.entryAbs, fromDir)];
}

function toNextProjectRelativeImport(file, fromDir) {
  return toPosix(path.relative(fromDir, file));
}
