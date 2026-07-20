import type { EnvGap, EnvKeySource } from './types';

/**
 * Reports, per source, the required keys the source's available set doesn't cover; sources with
 * full coverage produce no entry, so an empty result means every requirement is satisfied.
 */
export function findEnvGaps(
  required: ReadonlyArray<string>,
  sources: ReadonlyArray<EnvKeySource>,
): Array<EnvGap> {
  const gaps: Array<EnvGap> = [];

  for (const source of sources) {
    const missing = required.filter((key) => !source.available.has(key));

    if (missing.length > 0) {
      gaps.push({ label: source.label, missing });
    }
  }

  return gaps;
}
