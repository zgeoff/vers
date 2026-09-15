import { faker } from '@faker-js/faker';
import { CORPUS_CONTENT } from '../../corpus/corpus-content';
import type { CorpusCase } from '../../corpus/types';
import { ActivityFailureAction } from '../../types';
import { createMockSimulationInputSource } from './create-mock-simulation-input-source';

export function createMockCorpusCase(overrides: Partial<CorpusCase> = {}): CorpusCase {
  const contentID = overrides.contentID ?? 'baseline';

  return {
    contentID,
    durationMs: faker.number.int({ max: 60_000, min: 1000 }),
    failureAction: ActivityFailureAction.Abort,
    id: faker.string.alphanumeric({ casing: 'lower', length: 12 }),
    source: createMockSimulationInputSource({
      contentVersion: CORPUS_CONTENT[contentID].contentVersion,
    }),
    ...overrides,
  };
}
