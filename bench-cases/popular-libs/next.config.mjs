import path from "node:path";
import { fileURLToPath } from "node:url";

const caseDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(caseDir, "../..");
const persistentCache = process.env.BENCH_PERSISTENT_CACHE === "1";

export default {
  distDir: path.join(".next", persistentCache ? "persistent" : "memory-cache"),
  outputFileTracingRoot: workspaceRoot,
  reactStrictMode: true,
  experimental: {
    externalDir: true,
    turbopackFileSystemCacheForBuild: persistentCache,
    turbopackFileSystemCacheForDev: persistentCache
  },
  typescript: {
    ignoreBuildErrors: true
  }
};
