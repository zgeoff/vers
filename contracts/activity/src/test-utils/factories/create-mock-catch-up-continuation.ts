import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { CatchUpContinuation } from '../../catch-up-continuation-schema';
import type { CheckpointBatchEntry } from '../../checkpoint-batch-entry-schema';

interface CreateMockCatchUpContinuationOverrides extends Partial<CatchUpContinuation> {
  /**
   * How many checkpoint entries the default `checkpoints` array carries. Ignored when
   * `checkpoints` is itself overridden. Default 1.
   */
  readonly checkpointCount?: number;
}

export function createMockCatchUpContinuation(
  overrides: Readonly<CreateMockCatchUpContinuationOverrides> = {},
): CatchUpContinuation {
  const { checkpointCount, ...continuationOverrides } = overrides;

  return {
    buildSnapshot: { level: 1, xp: 0 },
    checkpoints: Array.from({ length: checkpointCount ?? 1 }, (_unused, index) =>
      createMockCheckpointBatchEntry(index + 1),
    ),
    id: `act_${createId()}`,
    startKey: `continue_${createId()}`,
    ...continuationOverrides,
  };
}

function createMockCheckpointBatchEntry(version: number): CheckpointBatchEntry {
  return {
    hash: buildSeed(),
    payload: {
      chainIndex: faker.number.int({ max: 1000, min: 0 }),
      entropySource: 'server-key',
      nextSeed: buildSeed(),
      seed: buildSeed(),
      time: faker.number.int({ max: 60_000, min: 0 }),
      type: 'progress',
    },
    prevHash: buildSeed(),
    version,
  };
}

function buildSeed(): string {
  return faker.string.alphanumeric({ casing: 'lower', length: 16 });
}
