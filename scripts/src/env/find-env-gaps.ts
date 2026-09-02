import type { EnvGap, EnvKeySource } from './types';

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
