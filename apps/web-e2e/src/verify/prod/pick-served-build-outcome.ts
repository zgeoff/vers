import { findStaleReason } from '@vers/scripts';
import type { ChangeSet, DeployTarget } from '@vers/scripts';

export interface ServedBuildRead {
  // the commit the web app's /health serves, or null when it serves none
  readonly served: string | null;
  readonly main: string;

  // what changed from the served commit to main, or null when this clone lacks the served commit
  readonly changes: ChangeSet | null;
}

export type ServedBuildOutcome =
  | { readonly kind: 'current'; readonly served: string }
  | { readonly kind: 'failed'; readonly message: string };

// The served build matches main by the rule `deploy verify` applies: the same commit, a descendant,
// or an older commit that nothing the web app's deploy trigger watches has changed since.
export function pickServedBuildOutcome(
  web: DeployTarget,
  read: ServedBuildRead,
): ServedBuildOutcome {
  if (read.served === null) {
    return { kind: 'failed', message: 'The web app serves no commit on /health.' };
  }

  const staleReason = findStaleReason(web, read.changes);

  return staleReason === null
    ? { kind: 'current', served: read.served }
    : {
        kind: 'failed',
        message: `The web app serves ${read.served}, which is stale against main ${read.main}: ${staleReason}.`,
      };
}
