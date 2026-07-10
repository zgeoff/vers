import type { WorkerContext } from './types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerContext's `connections` field is a ReadonlySet, which this rule doesn't recognize as a readonly type
export function handleSimulationRestarted(_context: WorkerContext) {
  //
}
