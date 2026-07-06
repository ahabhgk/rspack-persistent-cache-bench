import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { root } from "./paths.mjs";

const PACKAGE_NAMES = [
  "@rspack/core",
  "@rspack/cli",
  "@swc/core",
  "swc-loader",
  "@utoo/pack-cli",
  "webpack",
  "webpack-cli",
  "next",
  "react",
  "react-dom"
];

export function collectSystemInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpus: os.cpus().length,
    totalMemoryMb: os.totalmem() / 1024 / 1024
  };
}

export function collectPackageVersions() {
  const versions = {};

  for (const packageName of PACKAGE_NAMES) {
    const packageJsonPath = path.join(root, "node_modules", packageName, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      versions[packageName] = null;
      continue;
    }
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    versions[packageName] = packageJson.version;
  }

  return versions;
}
