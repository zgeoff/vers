import { expect, test } from 'bun:test';
import { buildSimulationInput } from '../../core/build-simulation-input';
import { CORPUS_CONTENT } from '../../corpus/corpus-content';
import { ActivityFailureAction } from '../../types';
import { createMockCorpusCase } from './create-mock-corpus-case';

test('it builds a default corpus case', () => {
  const corpusCase = createMockCorpusCase();

  expect(corpusCase).toStrictEqual({
    contentID: 'baseline',
    durationMs: expect.toBeNumber(),
    failureAction: ActivityFailureAction.Abort,
    id: expect.toBeString(),
    source: expect.toBeObject(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const corpusCase = createMockCorpusCase({
    contentID: 'fast-attack',
    durationMs: 30_000,
    failureAction: ActivityFailureAction.Retry,
    id: 'override-case',
  });

  expect(corpusCase).toMatchObject({
    contentID: 'fast-attack',
    durationMs: 30_000,
    failureAction: ActivityFailureAction.Retry,
    id: 'override-case',
  });
});

test.each([['baseline'], ['fast-attack']] as const)(
  'it builds a source whose content version matches the %s content',
  (contentID) => {
    const corpusCase = createMockCorpusCase({ contentID });

    expect(() => buildSimulationInput(CORPUS_CONTENT[contentID], corpusCase.source)).not.toThrow();
  },
);
