import type { DevToolsTarget } from './types';

export function formatTargetTable(targets: ReadonlyArray<DevToolsTarget>): string {
  const typeWidth = Math.max(0, ...targets.map((target) => target.type.length));
  const idWidth = Math.max(0, ...targets.map((target) => target.id.length));
  const urlWidth = Math.max(0, ...targets.map((target) => target.url.length));

  return targets
    .map((target) =>
      `${target.type.padEnd(typeWidth)}  ${target.id.padEnd(idWidth)}  ${target.url.padEnd(urlWidth)}  ${target.title}`.trimEnd(),
    )
    .join('\n');
}
