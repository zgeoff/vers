import type { ContainerExit } from './types';

interface RequestedStop {
  readonly container: string;
  readonly elapsedMs: number;
}

// a scheduled restart brings a crashed container back up, so the exits read before it join the
// final ones; the stop the outage asked for is the one exit left out
export function collectScenarioExits(
  finalExits: ReadonlyArray<ContainerExit>,
  exitsBeforeRestart: ReadonlyArray<ContainerExit>,
  requestedStop: RequestedStop | undefined,
): Array<ContainerExit> {
  const crashes = exitsBeforeRestart.filter(
    (exit) =>
      requestedStop === undefined ||
      exit.container !== requestedStop.container ||
      exit.elapsedMs < requestedStop.elapsedMs,
  );

  const seen = new Set<string>();

  return [...crashes, ...finalExits].filter((exit) => {
    const key = `${exit.container}@${exit.elapsedMs}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}
