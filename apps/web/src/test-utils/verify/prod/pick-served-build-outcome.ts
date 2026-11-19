import { findStaleReason } from '@vers/scripts';
import type { ChangeSet, DeployTarget } from '@vers/scripts';

export interface ServedBuildRead {
  readonly served: string | null;
  readonly main: string;

  readonly changes: ChangeSet | null;
}

export type ServedBuildOutcome =
  | { readonly kind: 'current'; readonly served: string }
  | { readonly kind: 'failed'; readonly message: string };

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
