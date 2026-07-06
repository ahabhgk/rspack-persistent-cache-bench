import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const caseDir = path.dirname(fileURLToPath(import.meta.url));
const configPath = fileURLToPath(import.meta.url);
const isProd = process.env.NODE_ENV === "production";
const persistentCache = process.env.BENCH_PERSISTENT_CACHE === "1";
const targetBrowser = "Chrome >= 93";
const entry = resolveEntry();

export default {
  devtool: isProd ? false : undefined,
  mode: isProd ? "production" : "development",
  target: ["web", `browserslist:${targetBrowser}`],
  context: caseDir,
  entry: {
    main: entry
  },
  output: {
    path: path.join(caseDir, ".bench-out", "webpack"),
    filename: "[name].js",
    clean: true
  },
  resolve: {
    extensions: ["...", ".tsx", ".ts", ".jsx"]
  },
  experiments: {
    css: true
  },
  module: {
    rules: [
      {
        test: /\.(js|ts|tsx|jsx)$/,
        use: {
          loader: "swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "typescript",
                tsx: true
              },
              transform: {
                react: {
                  runtime: "automatic",
                  development: !isProd
                }
              }
            }
          }
        }
      }
    ]
  },
  cache: persistentCache
    ? {
        type: "filesystem",
        cacheDirectory: path.join(caseDir, ".bench-cache", "webpack"),
        buildDependencies: {
          config: [configPath, entry]
        }
      }
    : {
        type: "memory"
      },
  optimization: {
    minimize: isProd
  },
  watchOptions: {
    ignored: /node_modules/
  },
  stats: "errors-warnings"
};

function resolveEntry() {
  for (const relativeEntry of ["src/index.jsx", "src/index.js"]) {
    const entryPath = path.join(caseDir, relativeEntry);
    if (fs.existsSync(entryPath)) {
      return entryPath;
    }
  }
  throw new Error(`Unable to find case entry under ${caseDir}`);
}
