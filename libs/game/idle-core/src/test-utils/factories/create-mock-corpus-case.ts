import { faker } from '@faker-js/faker';
import type { CorpusCase } from '../../corpus/types';
import { ActivityFailureAction } from '../../types';
import { createMockSimulationInputSource } from './create-mock-simulation-input-source';

export function createMockCorpusCase(overrides: Partial<CorpusCase> = {}): CorpusCase {
  return {
    contentID: 'baseline',
    durationMs: faker.number.int({ max: 60_000, min: 1000 }),
    failureAction: ActivityFailureAction.Abort,
    id: faker.string.alphanumeric({ casing: 'lower', length: 12 }),
    source: createMockSimulationInputSource(),
    ...overrides,
  };
}
