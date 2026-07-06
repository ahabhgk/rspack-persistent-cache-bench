export function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function averageDefined(values) {
  const defined = values.filter((value) => value != null);
  return defined.length > 0 ? average(defined) : null;
}

export function percentile(values, quantile) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index];
}

export function renderTable(rows) {
  if (rows.length === 2) {
    rows.push(Array.from({ length: rows[0].length }, () => "n/a"));
  }
  return rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
}

export function formatMb(value, signed = false) {
  if (value == null) {
    return "n/a";
  }
  return `${signed ? formatSigned(value) : formatNumber(value)} MB`;
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) {
    return "n/a";
  }
  return value.toFixed(2);
}

export function formatSigned(value) {
  if (value == null || Number.isNaN(value)) {
    return "n/a";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

export function formatPackageVersions(packageVersions) {
  return Object.entries(packageVersions)
    .map(([name, version]) => `${name}@${version ?? "not-installed"}`)
    .join(", ");
}

export function lastLines(text, count) {
  return text.split(/\r?\n/).slice(-count).join("\n");
}
