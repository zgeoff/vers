import { runFlyctl } from '../utils/run-flyctl';
import type { DeployTarget } from './types';

/**
 * Cuts the target's fleet over, stamping the commit SHA into machine env as `GIT_SHA` — the
 * marker every staleness decision reads back. With `image` set the rollout deploys that prebuilt
 * ref and builds nothing; with null it deploys the image named in the target's fly.toml, the path
 * for apps that ship a stock image. Rollback is this same call with a previous release's ref and
 * SHA.
 */
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
