import { expect, test } from 'bun:test';
import { runCorpus } from './run-corpus';
import { runCorpusCase } from './run-corpus-case';

test('it assigns the corpus runners onto globalThis on import', async () => {
  await import('./register-corpus-global');

  expect(globalThis.runCorpus).toBe(runCorpus);
  expect(globalThis.runCorpusCase).toBe(runCorpusCase);
});
