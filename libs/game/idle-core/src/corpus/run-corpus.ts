import { CORPUS_CASES } from './corpus-cases';
import { digestCorpus } from './digest-corpus';
import { runCorpusCase } from './run-corpus-case';
import type { CorpusCase } from './types';

export interface CorpusCaseDigest {
  readonly digest: string;
  readonly id: string;
}

export function runCorpus(): Promise<Array<CorpusCaseDigest>> {
  return Promise.all(CORPUS_CASES.map((corpusCase) => digestCorpusCase(corpusCase)));
}

async function digestCorpusCase(corpusCase: Readonly<CorpusCase>): Promise<CorpusCaseDigest> {
  const canonical = await runCorpusCase(corpusCase.id);
  const digest = await digestCorpus(canonical);

  return { digest, id: corpusCase.id };
}
