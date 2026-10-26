import { LOAD_STACK_APPS } from './load-stack-apps';

export function buildLoadImageRefs(tag: string): Record<string, string> {
  return Object.fromEntries(
    LOAD_STACK_APPS.map((app) => [
      `LOAD_IMAGE_${app.envName}`,
      `vers-load/${app.envName.toLowerCase().replaceAll('_', '-')}:${tag}`,
    ]),
  );
}
