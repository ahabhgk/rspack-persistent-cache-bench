import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function bin(name) {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  return path.join(root, "node_modules/.bin", `${name}${suffix}`);
}

export function toPosix(value) {
  return value.split(path.sep).join("/");
}
