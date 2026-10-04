import type { SimulationInputSource } from '../core/build-simulation-input';
import type { ActivityCheckpoint, ActivityFailureAction } from '../types';

export type CorpusContentID = 'baseline' | 'fast-attack';

export interface CorpusCase {
  readonly contentID: CorpusContentID;
  readonly durationMs: number;
  readonly failureAction: ActivityFailureAction;
  readonly id: string;
  readonly source: SimulationInputSource;
}

export interface CorpusSimulationResult {
  readonly checkpoints: ReadonlyArray<ActivityCheckpoint>;
  readonly elapsed: number;
  readonly haltedOnDurationCap?: boolean;
}
