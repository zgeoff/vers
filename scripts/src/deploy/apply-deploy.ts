import { runFlyctl } from '../utils/run-flyctl';
import type { DeployTarget } from './types';

export async function applyDeploy(
  target: DeployTarget,
  sha: string,
  image: string | null,
): Promise<void> {
  const args = ['deploy', '--config', `${target.configDir}/fly.toml`, '--env', `GIT_SHA=${sha}`];

  if (image !== null) {
    args.push('--image', image);
  }

  await runFlyctl(args, { inherit: true });
}
