import type { LighthouseProbe } from './types';

export interface LighthouseScores {
  readonly performance: number | null;
}

export function findLighthouseFinding(
  probe: Readonly<LighthouseProbe>,
  scores: Readonly<LighthouseScores>,
): string | null {
  if (scores.performance === null) {
    return 'lighthouse produced no performance score';
  }

  if (scores.performance < probe.minPerformanceScore) {
    return `performance score ${formatScore(scores.performance)} is under the ${formatScore(probe.minPerformanceScore)} minimum`;
  }

  return null;
}

function formatScore(score: number): string {
  return score.toFixed(2);
}
