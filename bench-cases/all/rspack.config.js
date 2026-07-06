const path = require("node:path");

const caseDir = __dirname;
const configPath = __filename;
const isProd = process.env.NODE_ENV === "production";
const persistentCache = process.env.BENCH_PERSISTENT_CACHE === "1";
const targetBrowser = "Chrome >= 93";
const entry = path.join(caseDir, "src", "index.js");
const babelRuntimeDir = path.dirname(require.resolve("babel-runtime-7-12/package.json"));
const react17Dir = path.dirname(require.resolve("react17/package.json"));
const reactDom17Dir = path.dirname(require.resolve("react-dom17/package.json"));
const rxjs5Dir = path.dirname(require.resolve("rxjs5/package.json"));
const styledComponents3Dir = path.dirname(require.resolve("styled-components3/package.json"));

module.exports = {
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
    clean: true
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias: {
      "@babel/runtime": babelRuntimeDir,
      "@internal": path.join(caseDir, "src", "rome", "internal"),
      react: react17Dir,
      "react-dom": reactDom17Dir,
      rxjs: rxjs5Dir,
      rome: path.join(caseDir, "src", "rome", "internal", "virtual-packages", "rome"),
      "styled-components": styledComponents3Dir
    },
    fallback: nodeFallbacks()
  },
  module: {
    parser: {
      javascript: {
        exportsPresence: "warn",
        importExportsPresence: "warn",
        reexportExportsPresence: "warn"
      }
    },
    rules: [
      {
        test: /\.(js|ts|tsx|jsx)$/,
        resolve: {
          fullySpecified: false
        },
        use: {
          loader: "builtin:swc-loader",
          options: {
            detectSyntax: "auto",
            jsc: {
              transform: {
                react: {
                  runtime: "classic",
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
    sideEffects: false,
    minimize: isProd
  },
  ignoreWarnings: [
    {
      message: /export.+was not found|only default export is available soon/
    }
  ],
  watchOptions: {
    ignored: /node_modules/
  },
  stats: "errors-warnings"
};

function nodeFallbacks() {
  return Object.fromEntries(
    [
      "assert",
      "buffer",
      "child_process",
      "cluster",
      "constants",
      "crypto",
      "dgram",
      "dns",
      "domain",
      "events",
      "fs",
      "http",
      "https",
      "inspector",
      "module",
      "net",
      "os",
      "path",
      "process",
      "punycode",
      "querystring",
      "readline",
      "stream",
      "string_decoder",
      "timers",
      "tls",
      "tty",
      "url",
      "util",
      "vm",
      "worker_threads",
      "zlib"
    ].map((name) => [name, false])
  );
}
