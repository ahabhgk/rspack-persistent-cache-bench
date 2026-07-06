import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(path.join(root, "synthetic.config.json"), "utf8"),
);
const generatedRoot = path.join(root, "src/.generated");
const publicRoot = path.join(root, "public/.generated");

const pad = (value, width = 5) => String(value).padStart(width, "0");

const classFor = (index, offset) => {
  const colors = ["blue", "slate", "emerald", "rose", "amber", "violet"];
  const steps = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
  const spacing = ["0", "1", "2", "3", "4", "5", "6", "8", "10", "12"];
  return [
    `text-${colors[(index + offset) % colors.length]}-${steps[(index + offset) % steps.length]}`,
    `bg-${colors[(index + offset + 2) % colors.length]}-${steps[(index + offset + 3) % steps.length]}`,
    `p-${spacing[(index + offset) % spacing.length]}`,
    `m-${spacing[(index + offset + 4) % spacing.length]}`,
    `rounded-${offset % 2 === 0 ? "md" : "lg"}`,
  ].join(" ");
};

const moduleSource = (index) => {
  const route = index % config.routes;
  const payload = Array.from({ length: config.payloadEntriesPerModule }, (_, offset) => {
    const marker = `module-${pad(index)}-${pad(offset, 4)}`;
    return `${marker} ${classFor(index, offset)} ${"x".repeat(48)}`;
  });
  return [
    `export const routeId = "route-${pad(route, 4)}";`,
    `export const moduleId = "module-${pad(index)}";`,
    `export const classes = ${JSON.stringify(payload)};`,
    "export function renderSyntheticToken() {",
    "  return classes[(classes.length + moduleId.length) % classes.length];",
    "}",
    "",
  ].join("\n");
};

const generateModules = async () => {
  const moduleDirectory = path.join(generatedRoot, "modules");
  await mkdir(moduleDirectory, { recursive: true });
  const imports = [];
  for (let index = 0; index < config.codeModules; index += 1) {
    const fileName = `module-${pad(index)}.js`;
    await writeFile(path.join(moduleDirectory, fileName), moduleSource(index));
    imports.push(`import "./modules/${fileName}";`);
  }
  await writeFile(
    path.join(generatedRoot, "index.js"),
    [
      ...imports,
      "",
      `export const generatedModuleCount = ${config.codeModules};`,
      "",
    ].join("\n"),
  );
};

const generateCssModules = async () => {
  const cssDirectory = path.join(generatedRoot, "styles");
  await mkdir(cssDirectory, { recursive: true });
  for (let index = 0; index < config.cssModules; index += 1) {
    await writeFile(
      path.join(cssDirectory, `style-${pad(index, 4)}.module.css`),
      [
        `.panel${index} {`,
        `  color: var(--color-${["blue", "emerald", "rose", "amber"][index % 4]}-500);`,
        "  padding: 1rem;",
        "}",
        "",
      ].join("\n"),
    );
  }
};

const generateSvgs = async () => {
  const svgDirectory = path.join(generatedRoot, "svg");
  await mkdir(svgDirectory, { recursive: true });
  for (let index = 0; index < config.svgAssets; index += 1) {
    await writeFile(
      path.join(svgDirectory, `icon-${pad(index, 4)}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 ${index % 16}h14v1H1z"/></svg>\n`,
    );
  }
};

const generateLocales = async () => {
  await mkdir(publicRoot, { recursive: true });
  const bytesPerFile = Math.floor(config.localeTotalBytes / config.localeFiles);
  const remainder = config.localeTotalBytes % config.localeFiles;
  for (let index = 0; index < config.localeFiles; index += 1) {
    const targetBytes = bytesPerFile + (index < remainder ? 1 : 0);
    const prefix = `{"locale":"synthetic-${pad(index, 3)}","payload":"`;
    const suffix = '"}\n';
    const payloadBytes = Math.max(0, targetBytes - Buffer.byteLength(prefix) - Buffer.byteLength(suffix));
    await writeFile(
      path.join(publicRoot, `locale-${pad(index, 3)}.json`),
      `${prefix}${"x".repeat(payloadBytes)}${suffix}`,
    );
  }
};

await rm(generatedRoot, { recursive: true, force: true });
await rm(publicRoot, { recursive: true, force: true });
await mkdir(generatedRoot, { recursive: true });
await generateModules();
await generateCssModules();
await generateSvgs();
await generateLocales();
await writeFile(
  path.join(generatedRoot, "manifest.json"),
  `${JSON.stringify(
    {
      codeModules: config.codeModules,
      cssModules: config.cssModules,
      svgAssets: config.svgAssets,
      localeFiles: config.localeFiles,
      localeTotalBytes: config.localeTotalBytes,
    },
    null,
    2,
  )}\n`,
);

process.stdout.write(
  `Generated ${config.codeModules.toLocaleString()} JS modules, ${config.svgAssets.toLocaleString()} SVGs, ${config.cssModules.toLocaleString()} CSS modules, and ${(config.localeTotalBytes / 1024 / 1024).toFixed(1)} MiB of locale JSON.\n`,
);
