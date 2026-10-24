import { DEPLOY_BOUNDS } from './deploy-bounds';
import type { DeployTarget } from './types';

export function buildDeployArgs(
  target: DeployTarget,
  sha: string,
  image: string | null,
): ReadonlyArray<string> {
  const args = [
    'deploy',
    '--config',
    `${target.configDir}/fly.toml`,
    '--env',
    `GIT_SHA=${sha}`,
    '--wait-timeout',
    `${DEPLOY_BOUNDS.waitTimeoutMinutes}m`,
  ];

  if (image !== null) {
    args.push('--image', image);
  }

  return args;
}
