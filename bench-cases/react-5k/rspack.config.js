import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as rspackModule from "@rspack/core";
import createBenchCompileTimingPlugin from "../../scripts/lib/bench-compile-timing-plugin.cjs";

const caseDir = path.dirname(fileURLToPath(import.meta.url));
const configPath = fileURLToPath(import.meta.url);
const rspack = rspackModule.default ?? rspackModule;
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
    path: path.join(caseDir, ".bench-out", "rspack"),
    filename: "[name].js",
    publicPath: "/",
    clean: true
  },
  resolve: {
    extensions: ["...", ".tsx", ".ts", ".jsx"]
  },
  module: {
    defaultRules: [
      "...",
      {
        test: /\.css$/,
        type: "css/auto"
      }
    ],
    rules: [
      {
        test: /\.(js|ts|tsx|jsx)$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            detectSyntax: "auto",
            jsc: {
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
        type: "persistent",
        storage: {
          type: "filesystem",
          directory: path.join(caseDir, ".bench-cache", "rspack")
        },
        buildDependencies: [configPath, entry]
      }
    : {
        type: "memory"
      },
  optimization: {
    minimize: isProd
  },
  plugins: isProd
    ? []
    : [
        new rspack.HtmlRspackPlugin({ templateContent: renderDevHtml() }),
        new rspack.HotModuleReplacementPlugin(),
        createBenchCompileTimingPlugin()
      ],
  devServer: {
    hot: true,
    host: "127.0.0.1",
    port: Number(process.env.BENCH_DEV_PORT) || undefined
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

function renderDevHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Benchmark</title></head><body><div id="react-root"></div><div id="root"></div></body></html>`;
}
