import type { ChangeSet, DeployTarget } from './types';

export const NO_TRUSTWORTHY_SHA_REASON = 'no trustworthy deployed SHA recorded on the fleet';

export function findStaleReason(target: DeployTarget, changes: ChangeSet | null): string | null {
  if (changes === null) {
    return NO_TRUSTWORTHY_SHA_REASON;
  }

  if (target.trigger.kind === 'turbo-affected') {
    if (changes.affectedPkgs.includes(target.trigger.pkg)) {
      return `${target.trigger.pkg} is affected by commits since the deployed SHA`;
    }

    return null;
  }

  const globs = target.trigger.globs.map((glob) => new Bun.Glob(glob));
  const changed = changes.changedPaths.find((path) => globs.some((glob) => glob.match(path)));

  if (changed !== undefined) {
    return `${changed} changed since the deployed SHA`;
  }

  return null;
}
