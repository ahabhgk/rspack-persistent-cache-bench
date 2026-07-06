import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packages = [
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

for (const packageName of packages) {
  const packageJsonPath = path.join(root, "node_modules", packageName, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`${packageName}: not installed`);
    continue;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  console.log(`${packageName}: ${packageJson.version}`);
}

const npm = spawnSync("npm", ["--version"], { encoding: "utf8" });
if (npm.status === 0) {
  console.log(`npm: ${npm.stdout.trim()}`);
}

console.log(`node: ${process.version}`);
