import type { DeployTarget } from './types';

// flyctl must give up on a green machine that never turns healthy and roll it back itself: the
// deploy job's timeout kills flyctl mid-rollout instead, which strands the green machines.
const WAIT_TIMEOUT = '3m';

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
    WAIT_TIMEOUT,
  ];

  if (image !== null) {
    args.push('--image', image);
  }

  return args;
}
