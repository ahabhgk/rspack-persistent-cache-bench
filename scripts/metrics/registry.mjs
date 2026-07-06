import { formatMb, formatNumber, formatSigned } from "../lib/format.mjs";

export const DEFAULT_METRIC_IDS = [
  "prod_build_duration_memory",
  "prod_build_duration_persistent",
  "prod_build_duration_saved",
  "prod_peak_rss_memory",
  "prod_peak_rss_persistent",
  "prod_peak_rss_delta",
  "dev_build_duration_memory",
  "dev_build_duration_persistent",
  "dev_build_duration_saved",
  "dev_peak_rss_memory",
  "dev_peak_rss_persistent",
  "dev_peak_rss_delta"
];

export const METRICS = {
  prod_build_duration_memory: {
    id: "prod_build_duration_memory",
    run: "prod",
    label: "不开启构建耗时",
    read: (result) => `${formatNumber(result.memoryCache.averageDurationMs / 1000)}s`
  },
  prod_build_duration_persistent: {
    id: "prod_build_duration_persistent",
    run: "prod",
    label: "开启后构建耗时",
    read: (result) => `${formatNumber(result.persistent.averageDurationMs / 1000)}s`
  },
  prod_build_duration_saved: {
    id: "prod_build_duration_saved",
    run: "prod",
    label: "构建耗时减少",
    read: (result) =>
      `${formatSigned(result.comparison.timeSavedMs / 1000)}s (${formatSigned(result.comparison.timeSavedPercent)}%)`
  },
  prod_peak_rss_memory: {
    id: "prod_peak_rss_memory",
    run: "prod",
    label: "不开启内存占用",
    read: (result) => formatMb(result.memoryCache.averagePeakRssMb)
  },
  prod_peak_rss_persistent: {
    id: "prod_peak_rss_persistent",
    run: "prod",
    label: "开启后内存占用",
    read: (result) => formatMb(result.persistent.averagePeakRssMb)
  },
  prod_peak_rss_delta: {
    id: "prod_peak_rss_delta",
    run: "prod",
    label: "内存占用增加",
    read: (result) => formatMb(result.comparison.rssDeltaMb, true)
  },
  dev_build_duration_memory: {
    id: "dev_build_duration_memory",
    run: "dev",
    label: "不开启构建耗时",
    read: (result) => `${formatNumber(result.memoryCache.averageEditMs)}ms`
  },
  dev_build_duration_persistent: {
    id: "dev_build_duration_persistent",
    run: "dev",
    label: "开启后构建耗时",
    read: (result) => `${formatNumber(result.persistent.averageEditMs)}ms`
  },
  dev_build_duration_saved: {
    id: "dev_build_duration_saved",
    run: "dev",
    label: "构建耗时减少",
    read: (result) =>
      `${formatSigned(result.comparison.editSavedMs)}ms (${formatSigned(result.comparison.editSavedPercent)}%)`
  },
  dev_peak_rss_memory: {
    id: "dev_peak_rss_memory",
    run: "dev",
    label: "不开启内存占用",
    read: (result) => formatMb(result.memoryCache.peakRssMb)
  },
  dev_peak_rss_persistent: {
    id: "dev_peak_rss_persistent",
    run: "dev",
    label: "开启后内存占用",
    read: (result) => formatMb(result.persistent.peakRssMb)
  },
  dev_peak_rss_delta: {
    id: "dev_peak_rss_delta",
    run: "dev",
    label: "内存占用增加",
    read: (result) => formatMb(result.comparison.rssDeltaMb, true)
  }
};

export function listMetricIds() {
  return Object.keys(METRICS);
}

export function selectMetrics(metricIds) {
  for (const id of metricIds) {
    if (!METRICS[id]) {
      throw new Error(`unknown metric "${id}". Expected one of: ${listMetricIds().join(", ")}`);
    }
  }

  return metricIds.map((id) => METRICS[id]);
}
