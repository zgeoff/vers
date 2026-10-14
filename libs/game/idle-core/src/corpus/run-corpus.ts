import { buildCorpusDigest } from './build-corpus-digest';
import { CORPUS_CASES } from './corpus-cases';
import { runCorpusCase } from './run-corpus-case';
import type { CorpusCase } from './types';

export interface CorpusCaseDigest {
  readonly digest: string;
  readonly id: string;
}

export function runCorpus(): Promise<Array<CorpusCaseDigest>> {
  return Promise.all(CORPUS_CASES.map((corpusCase) => buildCorpusCaseDigest(corpusCase)));
}

async function buildCorpusCaseDigest(corpusCase: Readonly<CorpusCase>): Promise<CorpusCaseDigest> {
  const canonical = await runCorpusCase(corpusCase.id);
  const digest = await buildCorpusDigest(canonical);

  return { digest, id: corpusCase.id };
}
