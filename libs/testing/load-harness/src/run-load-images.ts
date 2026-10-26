import path from 'node:path';
import { loadDeployManifest } from '@vers/scripts';
import { $ } from 'bun';
import invariant from 'tiny-invariant';
import { buildLoadImageRefs } from './build-load-image-refs';
import { LOAD_STACK_APPS } from './load-stack-apps';
import type { LoadEngineVersions } from './types';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');

// builds each pipeline app from the Dockerfile its deploy manifest entry names, so the stack runs
// the binaries a deploy would push; the retained provider is the replay image under another hash
export async function runLoadImages(
  versions: Readonly<LoadEngineVersions>,
  tag: string,
): Promise<void> {
  const manifest = await loadDeployManifest();

  const refs = buildLoadImageRefs(tag);

  for (const app of LOAD_STACK_APPS) {
    const target = manifest.apps.find((candidate) => candidate.app === app.manifestApp);
    const ref = refs[`LOAD_IMAGE_${app.envName}`];

    invariant(
      target?.dockerfile !== undefined,
      `${app.manifestApp} has a dockerfile in the manifest`,
    );

    invariant(ref !== undefined, 'every stack app has an image ref');

    const engineHash = app.retained ? versions.retained : versions.current;

    const result =
      await $`docker build -q -f ${target.dockerfile} --build-arg SIM_ENGINE_HASH=${engineHash} --build-arg VITE_SIM_ENGINE_HASH=${engineHash} -t ${ref} .`
        .cwd(REPO_ROOT)
        .quiet()
        .nothrow();

    if (result.exitCode !== 0) {
      throw new Error(`building ${ref} failed: ${result.stderr.toString().trim()}`);
    }
  }
}
