import invariant from 'tiny-invariant';
import { buildSimulationInput } from '../core/build-simulation-input';
import { runSimulation } from '../core/run-simulation';
import { buildCanonicalCaseOutput } from './build-canonical-case-output';
import { CORPUS_CASES } from './corpus-cases';
import { CORPUS_CONTENT } from './corpus-content';

export async function runCorpusCase(id: string): Promise<string> {
  const corpusCase = CORPUS_CASES.find((candidate) => candidate.id === id);

  invariant(corpusCase, `unknown corpus case id: ${id}`);

  const content = CORPUS_CONTENT[corpusCase.contentID];

  const input = buildSimulationInput(content, corpusCase.source, {
    failureAction: corpusCase.failureAction,
  });

  const result = await runSimulation(input.activity, input.avatar, {
    duration: corpusCase.durationMs,
  });

  return buildCanonicalCaseOutput(corpusCase, result);
}
