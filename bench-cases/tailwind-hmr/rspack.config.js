import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as rspackModule from "@rspack/core";

const caseDir = path.dirname(fileURLToPath(import.meta.url));
const configPath = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const rspack = rspackModule.default ?? rspackModule;
const isProd = process.env.NODE_ENV === "production";
const persistentCache = process.env.BENCH_PERSISTENT_CACHE === "1";
const entry = path.join(caseDir, "src", "main.js");

export default {
  devtool: isProd ? false : undefined,
  mode: isProd ? "production" : "development",
  target: ["web", "browserslist:Chrome >= 93"],
  context: caseDir,
  entry: {
    main: entry
  },
  output: {
    path: path.join(caseDir, ".bench-out", "rspack"),
    filename: "[name].js",
    publicPath: "/",
    clean: true,
    hotUpdateMainFilename: "[runtime].[fullhash].hot-update.json",
    hotUpdateChunkFilename: "[id].[fullhash].hot-update.js"
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        type: "asset/source",
        use: [
          {
            loader: require.resolve("@tailwindcss/webpack"),
            options: {
              base: caseDir
            }
          }
        ]
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
        buildDependencies: [configPath, entry, path.join(caseDir, "synthetic.config.json")]
      }
    : {
        type: "memory"
      },
  optimization: {
    minimize: isProd
  },
  plugins: isProd ? [] : [new rspack.HotModuleReplacementPlugin()],
  watchOptions: {
    aggregateTimeout: 0,
    ignored: ["**/node_modules/**", "**/.results/**", "**/.bench-cache/**", "**/.bench-out/**"]
  },
  stats: "errors-warnings"
};
