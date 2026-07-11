import { runFlyctl } from '../utils/run-flyctl';
import type { DeployTarget } from './types';

/**
 * Runs the target's `flyctl deploy`, stamping the commit SHA into machine env
 * as `GIT_SHA` — the marker every staleness decision reads back. Build args
 * are forwarded from the environment only when set, so local runs without
 * CI secrets still deploy.
 */
export async function applyDeploy(target: DeployTarget, sha: string): Promise<void> {
  const args = ['deploy', '--config', `${target.configDir}/fly.toml`, '--env', `GIT_SHA=${sha}`];

  if (target.dockerfile !== undefined) {
    args.push('--remote-only', '--dockerfile', target.dockerfile);
  }

  for (const name of target.buildArgsFromEnv ?? []) {
    const value = process.env[name];

    if (value !== undefined && value !== '') {
      args.push('--build-arg', `${name}=${value}`);
    }
  }

  await runFlyctl(args, { inherit: true });
}
