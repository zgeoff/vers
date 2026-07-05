import type { Timings } from '~/types';

/**
 * Returns a Server-Timing header string for the given timings.
 * @param timings - The Timings object to include in the header.
 * @returns The Server-Timing header string.
 */
export function getServerTimingHeader(timings?: Timings) {
  if (!timings) {
    return '';
  }

  return Object.entries(timings)
    .map(([key, timingMetrics]) => {
      let duration = 0;

      for (const timingMetric of timingMetrics) {
        const time = timingMetric.time ?? performance.now() - timingMetric.start;

        duration += time;
      }

      const description = timingMetrics
        .map((t) => t.description)
        .filter(Boolean)
        .join(' & ');

      return [
        key.replaceAll(/(?<separator>:| |@|=|;|,|\/|\\)/g, '_'),
        description ? `desc=${JSON.stringify(description)}` : null,
        `dur=${duration.toFixed(1)}`,
      ]
        .filter(Boolean)
        .join(';');
    })
    .join(',');
}
