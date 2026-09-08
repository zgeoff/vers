import type { DevToolsTarget } from './types';

interface PickConfig {
  readonly attached: ReadonlySet<string>;
  readonly workerURL?: string;
}

export function pickCaptureTargets(
  targets: ReadonlyArray<DevToolsTarget>,
  config: PickConfig,
): Array<DevToolsTarget> {
  return targets.filter(
    (target) =>
      target.type === 'shared_worker' &&
      !config.attached.has(target.id) &&
      (config.workerURL === undefined || target.url.includes(config.workerURL)),
  );
}
