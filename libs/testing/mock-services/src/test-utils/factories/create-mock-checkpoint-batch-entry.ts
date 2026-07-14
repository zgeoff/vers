import { faker } from '@faker-js/faker';
import type { CheckpointBatchEntry } from '@vers/contract-activity';

/**
 * A structurally valid `trackActivityProgress` batch entry; hashes are random hex, not a real
 * chain digest.
 */
export function createMockCheckpointBatchEntry(
  overrides: Readonly<Partial<CheckpointBatchEntry>> = {},
): CheckpointBatchEntry {
  return {
    hash: buildMockHash(),
    payload: {
      chainIndex: 0,
      entropySource: 'server-key',
      nextSeed: buildMockHash().slice(0, 32),
      seed: buildMockHash().slice(0, 32),
      time: 0,
      type: 'tick',
    },
    prevHash: buildMockHash(),
    version: 1,
    ...overrides,
  };
}

function buildMockHash(): string {
  return faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' });
}
