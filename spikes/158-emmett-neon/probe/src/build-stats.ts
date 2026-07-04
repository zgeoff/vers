export type LatencyStats = {
  count: number;
  min: number;
  p50: number;
  p95: number;
  max: number;
  mean: number;
};

/** Latency summary over millisecond samples; percentiles by nearest-rank. */
export function buildStats(samples: number[]): LatencyStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (quantile: number) => sorted[Math.min(sorted.length - 1, Math.ceil(quantile * sorted.length) - 1)] ?? 0;
  return {
    count: sorted.length,
    min: round(sorted[0] ?? 0),
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    max: round(sorted[sorted.length - 1] ?? 0),
    mean: round(sorted.reduce((sum, sample) => sum + sample, 0) / Math.max(1, sorted.length)),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
