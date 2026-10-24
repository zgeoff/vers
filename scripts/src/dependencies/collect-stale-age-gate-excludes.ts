import invariant from 'tiny-invariant';
import { z } from 'zod';
import type { DependencyGateFinding } from './types';

const FIRST_PARTY_SCOPE = '@zgeoff/';
const installSchema = z.object({ minimumReleaseAgeExcludes: z.array(z.string()).default([]) });

const bunfigSchema = z.object({
  install: installSchema.default({ minimumReleaseAgeExcludes: [] }),
});

export function collectStaleAgeGateExcludes(
  bunfig: string,
  today: string,
): Array<DependencyGateFinding> {
  const excludes = bunfigSchema.parse(Bun.TOML.parse(bunfig)).install.minimumReleaseAgeExcludes;
  const removalDates = collectRemovalDates(bunfig);

  return excludes
    .filter((name) => !name.startsWith(FIRST_PARTY_SCOPE))
    .flatMap((name) => {
      const removalDate = removalDates.get(name);

      if (removalDate === undefined) {
        return [{ entry: name, problem: 'the age-gate exclude has no dated removal comment' }];
      }

      if (removalDate < today) {
        return [
          { entry: name, problem: `the age-gate exclude was due for removal on ${removalDate}` },
        ];
      }

      return [];
    });
}

// The shared audit-fix workflow writes this comment for each exclude it adds, and removes the
// exclude once the date passes.
const removalCommentPattern =
  /^# (?<name>\S+) \S+ \(published [^)]*\) ages past the gate ~(?<date>\d{4}-\d{2}-\d{2}) — remove then/gmu;

function collectRemovalDates(bunfig: string): Map<string, string> {
  const removalDates = new Map<string, string>();

  for (const match of bunfig.matchAll(removalCommentPattern)) {
    const name = match.groups?.['name'];
    const date = match.groups?.['date'];

    invariant(name !== undefined && date !== undefined, 'the removal comment pattern names both');

    const latest = removalDates.get(name);

    if (latest === undefined || date > latest) {
      removalDates.set(name, date);
    }
  }

  return removalDates;
}
