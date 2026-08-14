import { implement } from '@orpc/server';
import type { ContentDocument } from '@vers/contract-activity';
import { activityContract } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import type { ServiceContext } from '@vers/service-runtime';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import { advanceActivity } from './handlers/advance-activity';
import { getActivityRewards } from './handlers/get-activity-rewards';
import { getAvatarProgression } from './handlers/get-avatar-progression';
import { getContentDocument } from './handlers/get-content-document';
import { getCurrentActivity } from './handlers/get-current-activity';
import { getLatestActivityProgress } from './handlers/get-latest-activity-progress';
import { getRevealedNodes } from './handlers/get-revealed-nodes';
import { resumeActivity } from './handlers/resume-activity';
import { revealNodes } from './handlers/reveal-nodes';
import { startActivity } from './handlers/start-activity';
import { stopActivity } from './handlers/stop-activity';
import { trackActivityProgress } from './handlers/track-activity-progress';
import { updateFailureAction } from './handlers/update-failure-action';

interface BuildActivityRouterDeps {
  readonly db: Kysely<DB>;
  readonly keysServiceURL: string;
  readonly keyVersion: number;
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
  readonly privateKey: CryptoKey;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
  readonly sendReplayWake: () => void;
  readonly simTimeCapMs: number;
}

/**
 * Assembles the activities service's oRPC router, closing each handler over the shared db client
 * (and, for `startActivity`, the memoized content-document loader new activities are minted
 * against, the key version, the keys origin, s2s signing key, and scope secret ref/version its
 * sealed content read uses; for `trackActivityProgress`, the offline-progress budget ceiling).
 */
export function buildActivityRouter(deps: BuildActivityRouterDeps) {
  const os = implement(activityContract).$context<ServiceContext>();

  return {
    advanceActivity: os.advanceActivity.handler((opts) =>
      advanceActivity(
        { db: deps.db, sendReplayWake: deps.sendReplayWake, simTimeCapMs: deps.simTimeCapMs },
        opts,
      ),
    ),
    getActivityRewards: os.getActivityRewards.handler((opts) => getActivityRewards(deps.db, opts)),
    getAvatarProgression: os.getAvatarProgression.handler((opts) =>
      getAvatarProgression({ db: deps.db, sendReplayWake: deps.sendReplayWake }, opts),
    ),
    getContentDocument: os.getContentDocument.handler((opts) =>
      getContentDocument({ loadContentDocument: deps.loadContentDocument }, opts),
    ),
    getCurrentActivity: os.getCurrentActivity.handler((opts) => getCurrentActivity(deps.db, opts)),
    getLatestActivityProgress: os.getLatestActivityProgress.handler((opts) =>
      getLatestActivityProgress(deps.db, opts),
    ),
    getRevealedNodes: os.getRevealedNodes.handler((opts) =>
      getRevealedNodes(
        {
          db: deps.db,
          keysServiceURL: deps.keysServiceURL,
          loadContentDocument: deps.loadContentDocument,
          privateKey: deps.privateKey,
          secretRef: deps.secretRef,
          secretVersion: deps.secretVersion,
        },
        opts,
      ),
    ),
    resumeActivity: os.resumeActivity.handler((opts) => resumeActivity(deps.db, opts)),
    revealNodes: os.revealNodes.handler((opts) =>
      revealNodes(
        {
          db: deps.db,
          keysServiceURL: deps.keysServiceURL,
          loadContentDocument: deps.loadContentDocument,
          privateKey: deps.privateKey,
          secretRef: deps.secretRef,
          secretVersion: deps.secretVersion,
        },
        opts,
      ),
    ),
    startActivity: os.startActivity.handler((opts) => startActivity(deps, opts)),
    stopActivity: os.stopActivity.handler((opts) =>
      stopActivity({ db: deps.db, sendReplayWake: deps.sendReplayWake }, opts),
    ),
    trackActivityProgress: os.trackActivityProgress.handler((opts) =>
      trackActivityProgress(
        { db: deps.db, sendReplayWake: deps.sendReplayWake, simTimeCapMs: deps.simTimeCapMs },
        opts,
      ),
    ),
    updateFailureAction: os.updateFailureAction.handler((opts) =>
      updateFailureAction(deps.db, opts),
    ),
  };
}

export type ActivityRouter = ReturnType<typeof buildActivityRouter>;
