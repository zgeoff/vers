import { faker } from '@faker-js/faker';
import type { CheckpointBatchEntry, CheckpointPayload } from '@vers/contract-activity';

interface CreateMockCheckpointBatchEntryOverrides {
  readonly hash?: string;
  readonly payload?: Partial<CheckpointPayload>;
  readonly prevHash?: string;
  readonly version?: number;
}

export function createMockCheckpointBatchEntry(
  overrides: CreateMockCheckpointBatchEntryOverrides = {},
): CheckpointBatchEntry {
  return {
    hash: overrides.hash ?? buildSeed(),
    payload: {
      chainIndex: faker.number.int({ max: 1000, min: 0 }),
      entropySource: 'server-key',
      nextSeed: buildSeed(),
      seed: buildSeed(),
      time: faker.number.int({ max: 60_000, min: 0 }),
      type: 'progress',
      ...overrides.payload,
    },
    prevHash: overrides.prevHash ?? buildSeed(),
    version: overrides.version ?? faker.number.int({ max: 1000, min: 1 }),
  };
}

function buildSeed(): string {
  return faker.string.alphanumeric({ casing: 'lower', length: 16 });
}
