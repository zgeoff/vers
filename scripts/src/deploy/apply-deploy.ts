import { runFlyctl } from '../utils/run-flyctl';
import { buildDeployArgs } from './build-deploy-args';
import { DEPLOY_BOUNDS } from './deploy-bounds';
import type { DeployTarget } from './types';

const MS_PER_MINUTE = 60_000;

export async function applyDeploy(
  target: DeployTarget,
  sha: string,
  image: string | null,
): Promise<void> {
  await runFlyctl(buildDeployArgs(target, sha, image), {
    inherit: true,
    interrupt: {
      afterMs: DEPLOY_BOUNDS.interruptAfterMinutes * MS_PER_MINUTE,
      graceMs: DEPLOY_BOUNDS.interruptGraceMinutes * MS_PER_MINUTE,
    },
  });
}
