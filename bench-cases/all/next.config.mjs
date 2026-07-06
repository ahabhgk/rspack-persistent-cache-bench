import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const caseDir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(caseDir, "../..");
const persistentCache = process.env.BENCH_PERSISTENT_CACHE === "1";
const nextProjectRoot = path.join(caseDir, ".bench-next", "project");
const nextShimDir = path.join(caseDir, "bench-shims", "next");
const emptyNodeModule = path.join(nextShimDir, "empty-node.js");
const lruFastShim = path.join(nextShimDir, "lru-fast.js");

export default {
  distDir: path.join(".next", persistentCache ? "persistent" : "memory-cache"),
  outputFileTracingRoot: workspaceRoot,
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      "@babel/runtime": toProjectPath(packageDir("babel-runtime-7-12")),
      "@babel/runtime/*": toProjectPath(path.join(packageDir("babel-runtime-7-12"), "*")),
      "@babel/runtime/helpers": toProjectPath(path.join(packageDir("babel-runtime-7-12"), "helpers")),
      "@babel/runtime/helpers/esm": toProjectPath(path.join(packageDir("babel-runtime-7-12"), "helpers", "esm")),
      "@internal": toProjectPath(path.join(caseDir, "src", "rome", "internal")),
      "@internal/*": toProjectPath(path.join(caseDir, "src", "rome", "internal", "*")),
      "lru-fast": toProjectPath(lruFastShim),
      react: toProjectPath(packageDir("react17")),
      "react-dom": toProjectPath(packageDir("react-dom17")),
      rome: toProjectPath(path.join(caseDir, "src", "rome", "internal", "virtual-packages", "rome")),
      rxjs: toProjectPath(packageDir("rxjs5")),
      "rxjs/*": toProjectPath(path.join(packageDir("rxjs5"), "*")),
      "styled-components": toProjectPath(packageDir("styled-components3")),
      ...nodeFallbackAliases()
    },
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
    rules: {
      "*.ts": swcTypeScriptRule(false),
      "*.tsx": swcTypeScriptRule(true)
    }
  },
  experimental: {
    externalDir: true,
    turbopackFileSystemCacheForBuild: persistentCache,
    turbopackFileSystemCacheForDev: persistentCache
  },
  typescript: {
    ignoreBuildErrors: true
  }
};

function packageDir(name) {
  return path.dirname(require.resolve(`${name}/package.json`));
}

function swcTypeScriptRule(tsx) {
  return {
    loaders: [
      {
        loader: "swc-loader",
        options: {
          jsc: {
            parser: {
              syntax: "typescript",
              tsx
            },
            transform: {
              react: {
                runtime: "classic"
              }
            }
          }
        }
      }
    ],
    as: "*.js"
  };
}

function nodeFallbackAliases() {
  const builtins = [
    "assert",
    "buffer",
    "child_process",
    "constants",
    "crypto",
    "events",
    "fs",
    "fs/promises",
    "inspector",
    "module",
    "net",
    "os",
    "path",
    "perf_hooks",
    "process",
    "readline",
    "stream",
    "stream/promises",
    "tty",
    "url",
    "util",
    "v8",
    "worker_threads",
    "zlib"
  ];
  const aliases = {};
  for (const name of builtins) {
    aliases[name] = toProjectPath(emptyNodeModule);
    aliases[`node:${name}`] = toProjectPath(emptyNodeModule);
  }
  return aliases;
}

function toProjectPath(absolutePath) {
  const relativePath = path.relative(nextProjectRoot, absolutePath).split(path.sep).join("/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}
