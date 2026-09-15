import { expect, test } from 'bun:test';
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
