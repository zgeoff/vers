import { runFlyctl } from '../utils/run-flyctl';
import { buildDeployArgs } from './build-deploy-args';
import type { DeployTarget } from './types';

export async function applyDeploy(
  target: DeployTarget,
  sha: string,
  image: string | null,
): Promise<void> {
  await runFlyctl(buildDeployArgs(target, sha, image), { inherit: true });
}
