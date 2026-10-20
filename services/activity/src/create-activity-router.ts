import { implement } from '@orpc/server';
import type { ContentDocument } from '@vers/contract-activity';
import { activityContract } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import type { ServiceContext } from '@vers/service-runtime';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import { advanceActivity } from './handlers/advance-activity';
import { readActivityRewards } from './handlers/read-activity-rewards';
import { readAvatarProgression } from './handlers/read-avatar-progression';
import { readContentDocument } from './handlers/read-content-document';
import { readCurrentActivity } from './handlers/read-current-activity';
import { readLatestActivityProgress } from './handlers/read-latest-activity-progress';
import { readRevealedNodes } from './handlers/read-revealed-nodes';
import { resumeActivity } from './handlers/resume-activity';
import { revealNodes } from './handlers/reveal-nodes';
import { stopActivity } from './handlers/stop-activity';
import { trackActivityProgress } from './handlers/track-activity-progress';
import { updateFailureAction } from './handlers/update-failure-action';

interface CreateActivityRouterDeps {
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

export function createActivityRouter(deps: CreateActivityRouterDeps) {
  const os = implement(activityContract).$context<ServiceContext>();

  return {
    advanceActivity: os.advanceActivity.handler((opts) =>
      advanceActivity(
        {
          db: deps.db,
          keyVersion: deps.keyVersion,
          keysServiceURL: deps.keysServiceURL,
          loadContentDocument: deps.loadContentDocument,
          privateKey: deps.privateKey,
          secretRef: deps.secretRef,
          secretVersion: deps.secretVersion,
          sendReplayWake: deps.sendReplayWake,
          simTimeCapMs: deps.simTimeCapMs,
        },
        opts,
      ),
    ),
    getActivityRewards: os.getActivityRewards.handler((opts) => readActivityRewards(deps.db, opts)),
    getAvatarProgression: os.getAvatarProgression.handler((opts) =>
      readAvatarProgression({ db: deps.db, sendReplayWake: deps.sendReplayWake }, opts),
    ),
    getContentDocument: os.getContentDocument.handler((opts) =>
      readContentDocument({ loadContentDocument: deps.loadContentDocument }, opts),
    ),
    getCurrentActivity: os.getCurrentActivity.handler((opts) => readCurrentActivity(deps.db, opts)),
    getLatestActivityProgress: os.getLatestActivityProgress.handler((opts) =>
      readLatestActivityProgress(deps.db, opts),
    ),
    getRevealedNodes: os.getRevealedNodes.handler((opts) =>
      readRevealedNodes(
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
          keyVersion: deps.keyVersion,
          keysServiceURL: deps.keysServiceURL,
          loadContentDocument: deps.loadContentDocument,
          privateKey: deps.privateKey,
          secretRef: deps.secretRef,
          secretVersion: deps.secretVersion,
        },
        opts,
      ),
    ),
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

export type ActivityRouter = ReturnType<typeof createActivityRouter>;
