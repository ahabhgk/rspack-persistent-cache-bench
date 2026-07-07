import path from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import createBenchCompileTimingPlugin from "../../scripts/lib/bench-compile-timing-plugin.cjs";

const caseDir = path.dirname(fileURLToPath(import.meta.url));
const configPath = fileURLToPath(import.meta.url);
const isProd = process.env.NODE_ENV === "production";
const persistentCache = process.env.BENCH_PERSISTENT_CACHE === "1";
const targetBrowser = "Chrome >= 93";
const entry = path.join(caseDir, "src", "entry.js");

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
    publicPath: "/",
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
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false
        }
      },
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
  plugins: isProd
    ? []
    : [
        new HtmlWebpackPlugin({ templateContent: renderDevHtml() }),
        new webpack.HotModuleReplacementPlugin(),
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

function renderDevHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Benchmark</title></head><body><div id="react-root"></div><div id="root"></div></body></html>`;
}
