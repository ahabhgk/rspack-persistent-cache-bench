import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const caseDir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const isProd = process.env.NODE_ENV === "production";
const persistentCache = process.env.BENCH_PERSISTENT_CACHE === "1";
const babelRuntimeDir = path.dirname(require.resolve("babel-runtime-7-12/package.json"));
const react17Dir = path.dirname(require.resolve("react17/package.json"));
const reactDom17Dir = path.dirname(require.resolve("react-dom17/package.json"));
const rxjs5Dir = path.dirname(require.resolve("rxjs5/package.json"));
const styledComponents3Dir = path.dirname(require.resolve("styled-components3/package.json"));

export default {
  mode: isProd ? "production" : "development",
  target: "Chrome >= 93",
  sourceMaps: !isProd,
  tracing: false,
  persistentCaching: persistentCache,
  stats: false,
  entry: [
    {
      import: "./src/index.js",
      html: {
        template: "./index.html"
      }
    }
  ],
  output: {
    path: ".bench-out/utoo",
    filename: "[name].js",
    chunkFilename: "[name].js",
    publicPath: "/",
    clean: true
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias: {
      "@babel/runtime": babelRuntimeDir,
      ...collectBabelRuntimeAliases(),
      "@internal": path.join(caseDir, "src", "rome", "internal"),
      react: react17Dir,
      "react-dom": reactDom17Dir,
      rxjs: rxjs5Dir,
      "rxjs/observable/from": path.join(rxjs5Dir, "observable", "from.js"),
      "rxjs/observable/fromPromise": path.join(rxjs5Dir, "observable", "fromPromise.js"),
      "rxjs/observable/range": path.join(rxjs5Dir, "observable", "range.js"),
      "rxjs/observable": path.join(rxjs5Dir, "observable"),
      "rxjs/operators/bufferCount": path.join(rxjs5Dir, "operators", "bufferCount.js"),
      "rxjs/operators/concatMap": path.join(rxjs5Dir, "operators", "concatMap.js"),
      "rxjs/operators/map": path.join(rxjs5Dir, "operators", "map.js"),
      "rxjs/operators/tap": path.join(rxjs5Dir, "operators", "tap.js"),
      "rxjs/operators": path.join(rxjs5Dir, "operators"),
      "rxjs/BehaviorSubject": path.join(rxjs5Dir, "BehaviorSubject.js"),
      "rxjs/Observable": path.join(rxjs5Dir, "Observable.js"),
      "rxjs/ReplaySubject": path.join(rxjs5Dir, "ReplaySubject.js"),
      "rxjs/Subscriber": path.join(rxjs5Dir, "Subscriber.js"),
      "rxjs/Subscription": path.join(rxjs5Dir, "Subscription.js"),
      "rxjs/Subject": path.join(rxjs5Dir, "Subject.js"),
      rome: path.join(caseDir, "src", "rome", "internal", "virtual-packages", "rome"),
      "styled-components": styledComponents3Dir
    }
  },
  module: {
    rules: {
      "*.ts": swcTypeScriptRule(false),
      "*.tsx": swcTypeScriptRule(true)
    }
  },
  react: {
    runtime: "classic"
  },
  optimization: {
    minify: isProd,
    concatenateModules: isProd,
    removeUnusedExports: isProd,
    removeUnusedImports: isProd
  },
  devServer: {
    hot: true,
    host: "127.0.0.1"
  },
  nodePolyfill: true
};

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

function collectBabelRuntimeAliases() {
  const source = fs.readFileSync(path.join(caseDir, "src", "babel-runtime.js"), "utf8");
  const aliases = {};
  for (const match of source.matchAll(/["'](@babel\/runtime\/[^"']+)["']/g)) {
    const specifier = match[1];
    const replacement = `babel-runtime-7-12/${specifier.slice("@babel/runtime/".length)}`;
    aliases[specifier] = require.resolve(replacement);
  }
  return aliases;
}
