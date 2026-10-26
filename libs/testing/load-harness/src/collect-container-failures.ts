import { formatContainerExit } from './format-container-exit';
import type { ScenarioSummary } from './types';

// bun test cannot reproduce a leak that only Node's fetch has, such as app-web dying at its V8 heap
// limit, so the load run is that regression check and fails on any exit instead of only reporting it
export function collectContainerFailures(summaries: ReadonlyArray<ScenarioSummary>): Array<string> {
  return summaries.flatMap((summary) =>
    summary.exits.map(
      (exit) =>
        `${summary.name}: ${exit.container} ${formatContainerExit(exit)} at ${(exit.elapsedMs / 1000).toFixed(1)} s`,
    ),
  );
}
