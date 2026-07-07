const isProd = process.env.NODE_ENV === "production";
const persistentCache = process.env.BENCH_PERSISTENT_CACHE === "1";

export default {
  mode: isProd ? "production" : "development",
  target: "Chrome >= 93",
  sourceMaps: !isProd,
  tracing: false,
  persistentCaching: persistentCache,
  stats: false,
  entry: [
    {
      import: "./src/entry.js",
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
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  module: {
    rules: {}
  },
  react: {
    runtime: "automatic"
  },
  optimization: {
    minify: isProd,
    concatenateModules: isProd,
    removeUnusedExports: isProd,
    removeUnusedImports: isProd
  },
  devServer: {
    hot: true,
    host: "127.0.0.1",
    port: Number(process.env.BENCH_DEV_PORT) || undefined
  }
};
