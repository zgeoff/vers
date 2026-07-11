import type { ChangeSet, DeployTarget } from './types';

/**
 * Decides whether a target's deployed state is behind HEAD, returning the
 * human-readable reason or null when it's current. A null change set (no
 * recorded deploy SHA, or one this repo doesn't contain) is always stale:
 * the fleet's state can't be trusted, so a redeploy is the safe answer.
 */
export function findStaleReason(target: DeployTarget, changes: ChangeSet | null): string | null {
  if (changes === null) {
    return 'no trustworthy deployed SHA recorded on the fleet';
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
