const IMAGE_REGISTRY = 'registry.fly.io';

interface ImageRef {
  readonly label: string;
  readonly ref: string;
}

export function buildImageRef(app: string, sha: string): ImageRef {
  const label = `deployment-${sha}`;

  return { label, ref: `${IMAGE_REGISTRY}/${app}:${label}` };
}
