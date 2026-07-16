import invariant from 'tiny-invariant';
import { runFlyctl } from '../utils/run-flyctl';
import { buildImageRef } from './build-image-ref';
import type { DeployTarget } from './types';

/**
 * Builds the target's image on Fly's remote builder and pushes it to the registry without
 * touching machines, returning the pushed ref. The tag is pinned to the commit SHA, so the
 * cutover — and any later rollback — deploys the exact artifact this step produced, and a re-run
 * of the same commit overwrites its own tag rather than minting a new one. Build args are
 * forwarded from the environment only when set, so local runs without CI secrets still build.
 */
export async function applyBuild(target: DeployTarget, sha: string): Promise<string> {
  invariant(target.dockerfile !== undefined, `${target.app} has no dockerfile to build`);

  const image = buildImageRef(target.app, sha);

  const args = [
    'deploy',
    '--config',
    `${target.configDir}/fly.toml`,
    '--remote-only',
    '--dockerfile',
    target.dockerfile,
    '--build-only',
    '--push',
    '--image-label',
    image.label,
  ];

  for (const name of target.buildArgsFromEnv ?? []) {
    const value = process.env[name];

    if (value !== undefined && value !== '') {
      args.push('--build-arg', `${name}=${value}`);
    }
  }

  await runFlyctl(args, { inherit: true });

  return image.ref;
}
