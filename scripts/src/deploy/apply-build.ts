import invariant from 'tiny-invariant';
import { FlyctlError } from '../utils/flyctl-error';
import { runFlyctl } from '../utils/run-flyctl';
import { BUILD_BOUNDS } from './build-bounds';
import { buildImageRef } from './build-image-ref';
import type { DeployTarget } from './types';

interface BuildBounds {
  readonly attempts: number;
  readonly stallAfterSeconds: number;
  readonly stallGraceSeconds: number;
}

const MS_PER_SECOND = 1000;

export async function applyBuild(
  target: DeployTarget,
  sha: string,
  bounds: BuildBounds = BUILD_BOUNDS,
): Promise<string> {
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

  // flyctl gives the remote build and its push no deadline of its own, so an upload that never
  // gets a response holds the leg until the job times out
  const stallInterrupt = {
    afterMs: bounds.stallAfterSeconds * MS_PER_SECOND,
    graceMs: bounds.stallGraceSeconds * MS_PER_SECOND,
  };

  for (let attempt = 1; ; attempt += 1) {
    try {
      await runFlyctl(args, { inherit: true, stallInterrupt });

      return image.ref;
    } catch (error) {
      if (!(error instanceof FlyctlError) || error.stalledAfterMs === null) {
        throw error;
      }

      if (attempt >= bounds.attempts) {
        throw new Error(
          `the build of ${target.app} stalled on each of its ${bounds.attempts} attempts`,
          { cause: error },
        );
      }

      console.error(
        `${error.message}\nretrying the build of ${target.app} (attempt ${attempt + 1} of ${bounds.attempts})`,
      );
    }
  }
}
