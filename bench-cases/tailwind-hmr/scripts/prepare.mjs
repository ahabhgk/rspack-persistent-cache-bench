import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "synthetic.config.json");
const manifestPath = path.join(root, "src", ".generated", "manifest.json");

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function isGeneratedReady() {
  if (!(await exists(manifestPath))) {
    return false;
  }

  const config = await readJson(configPath);
  const manifest = await readJson(manifestPath);
  const expected = {
    codeModules: config.codeModules,
    cssModules: config.cssModules,
    svgAssets: config.svgAssets,
    localeFiles: config.localeFiles,
    localeTotalBytes: config.localeTotalBytes
  };

  for (const [key, value] of Object.entries(expected)) {
    if (manifest[key] !== value) {
      return false;
    }
  }

  return (
    (await exists(path.join(root, "src", ".generated", "index.js"))) &&
    (await exists(path.join(root, "src", ".generated", "modules", "module-00000.js"))) &&
    (await exists(path.join(root, "public", ".generated", "locale-000.json")))
  );
}

if (!(await isGeneratedReady())) {
  await import(`${pathToFileURL(path.join(root, "scripts", "generate.mjs")).href}?t=${Date.now()}`);
}
