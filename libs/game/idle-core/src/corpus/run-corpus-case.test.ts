import { expect, test } from 'bun:test';
import { parseCanonicalCaseOutput } from './parse-canonical-case-output';
import { runCorpusCase } from './run-corpus-case';

test('it returns a parseable canonical string for a known case id', async () => {
  const canonicalString = await runCorpusCase('clean-completion');

  expect(parseCanonicalCaseOutput(canonicalString).id).toBe('clean-completion');
});

test('it throws for an id the corpus does not define', async () => {
  await expect(runCorpusCase('not-a-real-case')).toReject();
});
