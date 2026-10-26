// nearest-rank percentile; an empty set reads as zero, the value a report shows for no samples
export function buildPercentile(values: ReadonlyArray<number>, quantile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = values.toSorted((left, right) => left - right);
  const rank = Math.ceil(quantile * sorted.length);

  return sorted[Math.min(sorted.length, Math.max(rank, 1)) - 1] ?? 0;
}
