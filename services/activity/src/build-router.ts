import { implement } from '@orpc/server';
import { activityContract } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { ServiceContext } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { getCurrentActivity } from './handlers/get-current-activity';
import { getLatestActivityProgress } from './handlers/get-latest-activity-progress';
import { resumeActivity } from './handlers/resume-activity';
import { startActivity } from './handlers/start-activity';
import { stopActivity } from './handlers/stop-activity';
import { trackActivityProgress } from './handlers/track-activity-progress';

interface BuildActivityRouterDeps {
  readonly contentVersion: string;
  readonly db: Kysely<DB>;
  readonly keyVersion: number;
  readonly simTimeCapMs: number;
}

/**
 * Assembles the activities service's oRPC router, closing each handler over the shared db client
 * (and, for `startActivity`, the content and key versions new activities are minted against; for
 * `trackActivityProgress`, the offline-progress budget ceiling).
 */
export function buildActivityRouter(deps: BuildActivityRouterDeps) {
  const os = implement(activityContract).$context<ServiceContext>();

  return {
    getCurrentActivity: os.getCurrentActivity.handler((opts) => getCurrentActivity(deps.db, opts)),
    getLatestActivityProgress: os.getLatestActivityProgress.handler((opts) =>
      getLatestActivityProgress(deps.db, opts),
    ),
    resumeActivity: os.resumeActivity.handler((opts) => resumeActivity(deps.db, opts)),
    startActivity: os.startActivity.handler((opts) => startActivity(deps, opts)),
    stopActivity: os.stopActivity.handler((opts) => stopActivity(deps.db, opts)),
    trackActivityProgress: os.trackActivityProgress.handler((opts) =>
      trackActivityProgress({ db: deps.db, simTimeCapMs: deps.simTimeCapMs }, opts),
    ),
  };
}

export type ActivityRouter = ReturnType<typeof buildActivityRouter>;
