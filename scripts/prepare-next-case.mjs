import { getBenchCaseByRoot, writeNextCaseFiles } from "./cases.mjs";

const options = parseArgs(process.argv.slice(2));
const benchCase = getBenchCaseByRoot(process.cwd());
writeNextCaseFiles(benchCase, { importMode: options.importMode });

function parseArgs(args) {
  const options = {
    importMode: "dynamic"
  };

  for (const arg of args) {
    if (arg.startsWith("--import-mode=")) {
      options.importMode = arg.slice("--import-mode=".length);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!["dynamic", "static"].includes(options.importMode)) {
    throw new Error("--import-mode must be one of: dynamic, static");
  }

  return options;
}
