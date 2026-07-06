import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectCases, listCaseIds } from "./cases.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const all = process.argv.includes("--all");

const paths = [".bench-cache", ".bench-next", ".bench-out", ".next", ".turbopack", ".results"];

if (all) {
  for (const benchCase of selectCases(listCaseIds())) {
    paths.push(
      path.relative(root, path.join(benchCase.caseRootAbs, ".bench-cache")),
      path.relative(root, path.join(benchCase.caseRootAbs, ".bench-next")),
      path.relative(root, path.join(benchCase.caseRootAbs, ".bench-out")),
      path.relative(root, path.join(benchCase.caseRootAbs, ".turbopack"))
    );
    for (const generatedDir of benchCase.generatedDirs ?? []) {
      paths.push(generatedDir);
    }
  }
}

for (const relativePath of paths) {
  fs.rmSync(path.join(root, relativePath), { recursive: true, force: true });
  console.log(`removed ${relativePath}`);
}
