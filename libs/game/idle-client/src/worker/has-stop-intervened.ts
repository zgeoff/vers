import type { WorkerContext } from './types';

/**
 * Whether a player stop landed since the caller captured the epoch — the one question every
 * lifecycle flow asks after an await before installing a simulation, recording a pending
 * continuation, or adopting a server row. A yes means the stop owns the runtime: the flow
 * abandons its install, and a row it minted itself is stopped back durably.
 */
export function hasStopIntervened(context: WorkerContext, entryEpoch: number): boolean {
  return context.getStopEpoch() !== entryEpoch;
}
