const IMAGE_REGISTRY = 'registry.fly.io';

interface ImageRef {
  readonly label: string;
  readonly ref: string;
}

/**
 * Derives the registry coordinates a build for this app and commit pushes to: `label` is the tag
 * passed to flyctl's `--image-label`, `ref` the full deployable image reference. Both ends of the
 * split rollout derive the same value — the build phase pushes to it, the cutover deploys from it
 * — so no ref needs to travel between them.
 */
export function buildImageRef(app: string, sha: string): ImageRef {
  const label = `deployment-${sha}`;

  return { label, ref: `${IMAGE_REGISTRY}/${app}:${label}` };
}
