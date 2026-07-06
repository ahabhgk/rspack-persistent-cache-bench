import { devRun } from "./dev.mjs";
import { prodRun } from "./prod.mjs";

export const RUNS = {
  prod: prodRun,
  dev: devRun
};

export function selectRuns(metrics) {
  const selected = [];
  const seen = new Set();

  for (const metric of metrics) {
    if (seen.has(metric.run)) {
      continue;
    }
    seen.add(metric.run);
    selected.push(RUNS[metric.run]);
  }

  return selected;
}
